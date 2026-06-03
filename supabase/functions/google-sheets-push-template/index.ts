import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function getValidAccessToken(supabase: any, connection: any) {
  if (connection.token_expires_at && new Date(connection.token_expires_at) > new Date()) {
    return connection.access_token;
  }
  const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET')!;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  await supabase.from('drive_connections').update({
    access_token: data.access_token,
    token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', connection.id);
  return data.access_token;
}

async function ensureFolder(accessToken: string, parentId: string | null, folderName: string): Promise<string> {
  // Search for existing folder
  let q = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) q += ` and '${parentId}' in parents`;

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const body: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) body.parents = [parentId];

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const created = await createRes.json();
  if (!createRes.ok) throw new Error(`Folder creation failed: ${JSON.stringify(created)}`);
  return created.id;
}

function buildHeaderRow(headers: string[]) {
  return {
    values: headers.map(h => ({
      userEnteredValue: { stringValue: h },
      userEnteredFormat: {
        backgroundColor: { red: 0.2, green: 0.4, blue: 0.9, alpha: 1 },
        textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
      },
    })),
  };
}

function buildDataRow(cells: (string | number)[], numberCols: number[] = []) {
  return {
    values: cells.map((cell, idx) => {
      if (numberCols.includes(idx) && typeof cell === 'number') {
        return { userEnteredValue: { numberValue: cell } };
      }
      return { userEnteredValue: { stringValue: String(cell || '') } };
    }),
  };
}

/**
 * Apply a saved column_config to a built sheets array.
 * - Drops sub-sheets whose title is not in `config.objects` (when provided).
 * - For each remaining sheet, filters columns by header string against `config.columns[title]`.
 * Required identifier columns are force-included so syncs still match rows correctly.
 */
function applyColumnConfig(sheets: any[], config: any): any[] {
  if (!config || typeof config !== 'object') return sheets;
  const allowedTitles: Set<string> | null = Array.isArray(config.objects) && config.objects.length > 0
    ? new Set(config.objects)
    : null;
  const columnMap: Record<string, string[]> = (config.columns && typeof config.columns === 'object') ? config.columns : {};

  const ALWAYS_KEEP = new Set([
    'RAID', 'Account RAID', 'Account Name', 'SS Invoice #',
    'Recouply Invoice Ref (DO NOT EDIT)', 'Recouply Payment Ref (DO NOT EDIT)',
    'Recouply Contract Ref (DO NOT EDIT)', 'Recouply Contract Ref',
    'Primary Contract Ref', 'Linked Contract Ref', 'Contract Name',
  ]);

  return sheets
    .filter((s) => !allowedTitles || allowedTitles.has(s.properties?.title))
    .map((s) => {
      const title = s.properties?.title;
      const allowed = columnMap[title];
      if (!Array.isArray(allowed) || allowed.length === 0) return s;
      const allowedSet = new Set<string>([...allowed, ...Array.from(ALWAYS_KEEP)]);

      const rowData = s.data?.[0]?.rowData ?? [];
      if (rowData.length === 0) return s;
      const headerRow = rowData[0];
      const headerStrings: string[] = (headerRow.values || []).map(
        (v: any) => v.userEnteredValue?.stringValue ?? '',
      );
      const keepIdx: number[] = headerStrings
        .map((h, i) => (allowedSet.has(h) ? i : -1))
        .filter((i) => i >= 0);
      if (keepIdx.length === 0 || keepIdx.length === headerStrings.length) return s;

      const filterRow = (row: any) => ({
        values: keepIdx.map((i) => row.values?.[i] ?? { userEnteredValue: { stringValue: '' } }),
      });
      const newRowData = rowData.map(filterRow);

      return {
        ...s,
        data: [{ ...s.data[0], rowData: newRowData }],
      };
    });
}

// Shared contract sheet builder used by both push-template and incremental sync.
export async function buildContractsSheets(supabase: any, userId: string, _businessName: string) {
  const { data: contracts } = await supabase
    .from('live_contract_imports')
    .select('id, account_id, contract_name, file_name, contract_type, status, staging_status, debtor_id, contract_value, effective_date, term_end_date, industry, product_description, confidence, metrics_jsonb, created_at, updated_at, published_at, debtors(reference_id, company_name)')
    .eq('account_id', userId)
    .order('created_at', { ascending: false });

  const ids = (contracts || []).map((c: any) => c.id);
  const fieldsByImport = new Map<string, Map<string, string>>();
  const schedulesByImport = new Map<string, any[]>();
  const flagsByImport = new Map<string, any[]>();
  const datesByImport = new Map<string, any[]>();
  const checklistByImport = new Map<string, Map<string, any>>();

  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const [f, s, fl, d, ch] = await Promise.all([
      supabase.from('live_contract_extracted_fields').select('import_id, field_key, field_value').in('import_id', chunk),
      supabase.from('contract_invoice_schedules').select('import_id, scheduled_date, expected_due_date, amount, currency, billing_type, description, status, service_period_start, service_period_end, payment_terms').in('import_id', chunk).order('scheduled_date', { ascending: true }),
      supabase.from('contract_risk_flags').select('import_id, flag_type, severity, description, resolved, source_field, created_at').in('import_id', chunk),
      supabase.from('contract_critical_dates').select('import_id, date_type, due_date, status, risk_level, notice_days, alert_enabled, alert_lead_days').in('import_id', chunk).order('due_date', { ascending: true }),
      supabase.from('live_contract_checklist_items').select('import_id, item_key, status, source, evidence, notes').in('import_id', chunk),
    ]);
    for (const r of (f.data || [])) {
      if (!fieldsByImport.has(r.import_id)) fieldsByImport.set(r.import_id, new Map());
      fieldsByImport.get(r.import_id)!.set(r.field_key, r.field_value);
    }
    for (const r of (s.data || [])) {
      if (!schedulesByImport.has(r.import_id)) schedulesByImport.set(r.import_id, []);
      schedulesByImport.get(r.import_id)!.push(r);
    }
    for (const r of (fl.data || [])) {
      if (!flagsByImport.has(r.import_id)) flagsByImport.set(r.import_id, []);
      flagsByImport.get(r.import_id)!.push(r);
    }
    for (const r of (d.data || [])) {
      if (!datesByImport.has(r.import_id)) datesByImport.set(r.import_id, []);
      datesByImport.get(r.import_id)!.push(r);
    }
    for (const r of (ch.data || [])) {
      if (!checklistByImport.has(r.import_id)) checklistByImport.set(r.import_id, new Map());
      checklistByImport.get(r.import_id)!.set(r.item_key, r);
    }
  }

  // Links: get all where primary OR linked matches our contracts
  const { data: links } = ids.length
    ? await supabase.from('live_contract_links').select('primary_import_id, linked_import_id, link_type, notes, created_at').or(`primary_import_id.in.(${ids.join(',')}),linked_import_id.in.(${ids.join(',')})`)
    : { data: [] as any[] };

  const primaryOf = new Map<string, { id: string; type: string }>();
  for (const l of (links || [])) {
    primaryOf.set(l.linked_import_id, { id: l.primary_import_id, type: l.link_type });
  }
  const nameById = new Map((contracts || []).map((c: any) => [c.id, c.contract_name || c.file_name || '']));

  const CHECKLIST_KEYS = ['fully_executed', 'terms_identified', 'performance_obligations_defined', 'term_dates_defined', 'risk_factors_assessed'];

  // ========= 1) Contracts Master =========
  const masterHeaders = [
    'Recouply Contract Ref (DO NOT EDIT)', 'Contract Name', 'File Name', 'Contract Type', 'Status', 'Staging Status',
    'Account RAID', 'Account Name', 'Industry',
    'Counterparty', 'Contract Value', 'Currency',
    'Effective Date', 'Term End Date', 'Term (Months)',
    'MRR', 'ARR', 'ACV', 'TCV', 'Recurring TCV', 'Services TCV', 'One-time TCV',
    'Payment Terms', 'Billing Frequency', 'Auto Renewal', 'Renewal Term', 'Notice Period',
    'Primary Contract Ref', 'Link Type to Primary',
    'High/Critical Risks', 'Medium Risks', 'Total Risks',
    'Readiness: Fully Executed', 'Readiness: Terms', 'Readiness: Performance Obligations', 'Readiness: Term Dates', 'Readiness: Risk Factors', 'Readiness %',
    'Schedule Lines Count', 'Critical Dates Count',
    'AI Confidence', 'Product/Description', 'Created At', 'Updated At', 'Published At'
  ];
  const masterNumberCols = [10, 14, 15, 16, 17, 18, 19, 20, 21, 29, 30, 31, 37, 38, 39, 40];

  const masterRows = (contracts || []).map((c: any) => {
    const f = fieldsByImport.get(c.id) || new Map();
    const m = c.metrics_jsonb || {};
    const flags = flagsByImport.get(c.id) || [];
    const unresolved = flags.filter((x: any) => !x.resolved);
    const high = unresolved.filter((x: any) => x.severity === 'high' || x.severity === 'critical').length;
    const med = unresolved.filter((x: any) => x.severity === 'medium').length;
    const ch = checklistByImport.get(c.id) || new Map();
    const checkVal = (k: string) => {
      const it = ch.get(k);
      return it ? `${it.status}${it.source === 'manual' ? ' (manual)' : ''}` : 'unknown';
    };
    const passCount = CHECKLIST_KEYS.filter((k) => ch.get(k)?.status === 'pass').length;
    const readinessPct = Math.round((passCount / CHECKLIST_KEYS.length) * 100);
    const link = primaryOf.get(c.id);
    let termMonths = '';
    if (c.effective_date && c.term_end_date) {
      const a = new Date(c.effective_date), b = new Date(c.term_end_date);
      termMonths = String(Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44))));
    }

    return [
      c.id || '', c.contract_name || '', c.file_name || '', c.contract_type || '', c.status || '', c.staging_status || '',
      c.debtors?.reference_id || '', c.debtors?.company_name || '', c.industry || '',
      f.get('counterparty') || f.get('customer_name') || c.debtors?.company_name || '',
      Number(c.contract_value || m.tcv || 0), m.currency || f.get('currency') || 'USD',
      c.effective_date || '', c.term_end_date || '', termMonths,
      Number(m.mrr || 0), Number(m.arr || 0), Number(m.acv || 0),
      Number(m.tcv || 0), Number(m.recurringTcv || 0), Number(m.servicesTcv || 0), Number(m.oneTimeTcv || 0),
      f.get('payment_terms') || '', f.get('billing_frequency') || '',
      f.get('auto_renewal') || '', f.get('renewal_term') || '', f.get('notice_period') || '',
      link ? link.id : '', link ? link.type : '',
      high, med, flags.length,
      checkVal('fully_executed'), checkVal('terms_identified'), checkVal('performance_obligations_defined'),
      checkVal('term_dates_defined'), checkVal('risk_factors_assessed'), readinessPct,
      (schedulesByImport.get(c.id) || []).length,
      (datesByImport.get(c.id) || []).length,
      Number(c.confidence || 0), c.product_description || '',
      c.created_at || '', c.updated_at || '', c.published_at || '',
    ];
  });

  // ========= 2) Schedule Lines / Performance Obligations =========
  const schedHeaders = ['Recouply Contract Ref', 'Contract Name', 'Account Name', 'Line #', 'Scheduled Date', 'Expected Due Date', 'Service Start', 'Service End', 'Amount', 'Currency', 'Billing Type', 'Description', 'Payment Terms', 'Status'];
  const schedNumberCols = [3, 8];
  const schedRows: (string | number)[][] = [];
  for (const c of (contracts || [])) {
    const items = schedulesByImport.get(c.id) || [];
    items.forEach((s: any, i: number) => {
      schedRows.push([
        c.id, c.contract_name || c.file_name || '', c.debtors?.company_name || '',
        i + 1, s.scheduled_date || '', s.expected_due_date || '',
        s.service_period_start || '', s.service_period_end || '',
        Number(s.amount || 0), s.currency || 'USD', s.billing_type || '',
        s.description || '', s.payment_terms || '', s.status || '',
      ]);
    });
  }

  // ========= 3) Risk Flags =========
  const riskHeaders = ['Recouply Contract Ref', 'Contract Name', 'Account Name', 'Flag Type', 'Severity', 'Resolved', 'Description', 'Source', 'Created At'];
  const riskRows: (string | number)[][] = [];
  for (const c of (contracts || [])) {
    const items = flagsByImport.get(c.id) || [];
    for (const r of items) {
      riskRows.push([
        c.id, c.contract_name || c.file_name || '', c.debtors?.company_name || '',
        r.flag_type || '', r.severity || '', r.resolved ? 'Yes' : 'No',
        r.description || '', r.source_field || '', r.created_at || '',
      ]);
    }
  }

  // ========= 4) Key Dates =========
  const dateHeaders = ['Recouply Contract Ref', 'Contract Name', 'Account Name', 'Date Type', 'Due Date', 'Status', 'Risk Level', 'Notice Days', 'Alert Enabled', 'Alert Lead Days'];
  const dateNumberCols = [7, 9];
  const dateRows: (string | number)[][] = [];
  for (const c of (contracts || [])) {
    const items = datesByImport.get(c.id) || [];
    for (const r of items) {
      dateRows.push([
        c.id, c.contract_name || c.file_name || '', c.debtors?.company_name || '',
        r.date_type || '', r.due_date || '', r.status || '', r.risk_level || '',
        Number(r.notice_days || 0), r.alert_enabled ? 'Yes' : 'No', Number(r.alert_lead_days || 0),
      ]);
    }
  }

  // ========= 5) Linked Contracts =========
  const linkHeaders = ['Primary Contract Ref', 'Primary Contract Name', 'Linked Contract Ref', 'Linked Contract Name', 'Link Type', 'Notes', 'Created At'];
  const linkRows: (string | number)[][] = (links || []).map((l: any) => [
    l.primary_import_id, nameById.get(l.primary_import_id) || '',
    l.linked_import_id, nameById.get(l.linked_import_id) || '',
    l.link_type || '', l.notes || '', l.created_at || '',
  ]);

  const sheets = [
    {
      properties: { title: 'Contracts', gridProperties: { frozenRowCount: 1 } },
      data: [{ startRow: 0, startColumn: 0, rowData: [
        buildHeaderRow(masterHeaders),
        ...masterRows.map((r) => buildDataRow(r, masterNumberCols)),
      ]}],
    },
    {
      properties: { title: 'Performance Obligations', gridProperties: { frozenRowCount: 1 } },
      data: [{ startRow: 0, startColumn: 0, rowData: [
        buildHeaderRow(schedHeaders),
        ...schedRows.map((r) => buildDataRow(r, schedNumberCols)),
      ]}],
    },
    {
      properties: { title: 'Risk Flags', gridProperties: { frozenRowCount: 1 } },
      data: [{ startRow: 0, startColumn: 0, rowData: [
        buildHeaderRow(riskHeaders),
        ...riskRows.map((r) => buildDataRow(r, [])),
      ]}],
    },
    {
      properties: { title: 'Key Dates', gridProperties: { frozenRowCount: 1 } },
      data: [{ startRow: 0, startColumn: 0, rowData: [
        buildHeaderRow(dateHeaders),
        ...dateRows.map((r) => buildDataRow(r, dateNumberCols)),
      ]}],
    },
    {
      properties: { title: 'Linked Contracts', gridProperties: { frozenRowCount: 1 } },
      data: [{ startRow: 0, startColumn: 0, rowData: [
        buildHeaderRow(linkHeaders),
        ...linkRows.map((r) => buildDataRow(r, [])),
      ]}],
    },
  ];

  return { sheets, rowCount: masterRows.length };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { templateType, templateTypes } = body;

    // Support batch: templateTypes = ['accounts','invoices','payments','contracts'] or single templateType
    const VALID_TYPES = ['accounts', 'invoices', 'payments', 'contracts'];
    const typesToCreate: string[] = templateTypes 
      ? templateTypes.filter((t: string) => VALID_TYPES.includes(t))
      : templateType && VALID_TYPES.includes(templateType) 
        ? [templateType] 
        : [];

    if (typesToCreate.length === 0) {
      return new Response(JSON.stringify({ error: 'templateType(s) must be accounts, invoices, payments, or contracts' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get drive connection
    const { data: connection } = await supabase
      .from('drive_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!connection) {
      return new Response(JSON.stringify({ error: 'No active Google Drive connection' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await getValidAccessToken(supabase, connection);

    // Get branding
    const { data: branding } = await supabase
      .from('branding_settings')
      .select('business_name')
      .eq('user_id', user.id)
      .maybeSingle();
    const businessName = branding?.business_name || 'Recouply';

    // Get org ID
    const { data: orgId } = await supabase.rpc('get_user_organization_id', { p_user_id: user.id });

    // Ensure folder structure
    const rootFolderId = connection.folder_id || null;
    const templatesFolderId = await ensureFolder(accessToken, rootFolderId, 'recouply.ai data center');
    const folderPath = `recouply.ai data center`;

    // Filter out already-existing templates
    const { data: existingTemplates } = await supabase
      .from('google_sheet_templates')
      .select('template_type')
      .eq('user_id', user.id)
      .eq('status', 'active');
    const existingSet = new Set((existingTemplates || []).map((t: any) => t.template_type));
    const toCreate = typesToCreate.filter((t: string) => !existingSet.has(t));

    if (toCreate.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        results: [],
        message: 'All templates already exist. Use sync instead.' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = [];

    for (const currentType of toCreate) {
      let sheetTitle: string;
      let sheets: any[];
      let rowCount = 0;

      if (currentType === 'accounts') {
        sheetTitle = `${businessName} - Accounts Master`;
        const { data: debtors } = await supabase
          .from('debtors')
          .select('reference_id, company_name, type, name, email, phone, address_line1, address_line2, city, state, postal_code, country, industry, external_customer_id, crm_account_id_external, payment_terms_default, notes, current_balance, integration_source, source_system, payment_score, payment_risk_tier')
          .eq('user_id', user.id)
          .eq('is_archived', false)
          .order('company_name', { ascending: true });

        const headers = [
          'RAID', 'Company Name', 'Type (B2B/B2C)', 'Contact Name', 'Contact Email', 'Contact Phone',
          'Address Line 1', 'Address Line 2', 'City', 'State', 'Postal Code', 'Country',
          'Industry', 'External Customer ID', 'CRM ID', 'Default Payment Terms',
          'Notes', 'Current Balance', 'Source', 'Risk Score', 'Risk Tier'
        ];
        const dataRows = (debtors || []).map((d: any) => [
          d.reference_id || '', d.company_name || '', d.type || 'B2B',
          d.name || '', d.email || '', d.phone || '',
          d.address_line1 || '', d.address_line2 || '', d.city || '', d.state || '',
          d.postal_code || '', d.country || '', d.industry || '',
          d.external_customer_id || '', d.crm_account_id_external || '',
          d.payment_terms_default || '', d.notes || '', d.current_balance || 0,
          d.integration_source || d.source_system || 'recouply',
          d.payment_score ?? '', d.payment_risk_tier || ''
        ]);
        rowCount = dataRows.length;
        sheets = [{
          properties: { title: 'Accounts', gridProperties: { frozenRowCount: 1 } },
          data: [{ startRow: 0, startColumn: 0, rowData: [
            buildHeaderRow(headers),
            ...dataRows.map(r => buildDataRow(r, [17, 19])),
          ]}],
        }];
      } else if (currentType === 'invoices') {
        sheetTitle = `${businessName} - Invoices Master`;
        const { data: invoices } = await supabase
          .from('invoices')
          .select('invoice_number, amount, amount_original, amount_outstanding, currency, issue_date, due_date, paid_date, status, po_number, product_description, payment_terms, notes, reference_id, integration_source, source_system, debtors(reference_id, company_name)')
          .eq('user_id', user.id)
          .in('status', ['Open', 'InPaymentPlan', 'PartiallyPaid'])
          .order('due_date', { ascending: false });

        const { data: paidInvoices } = await supabase
          .from('invoices')
          .select('invoice_number, amount, amount_original, amount_outstanding, currency, issue_date, due_date, paid_date, status, po_number, product_description, payment_terms, notes, reference_id, integration_source, source_system, debtors(reference_id, company_name)')
          .eq('user_id', user.id)
          .in('status', ['Paid', 'Canceled', 'Voided', 'Settled', 'FinalInternalCollections'])
          .order('due_date', { ascending: false })
          .limit(500);

        const headers = [
          'Account RAID', 'Account Name', 'SS Invoice #', 'Original Amount', 'Amount Outstanding',
          'Currency', 'Issue Date', 'Due Date', 'Status', 'PO Number', 'Product/Description',
          'Payment Terms', 'Paid Date', 'Notes', 'Recouply Invoice Ref (DO NOT EDIT)', 'Source'
        ];
        const openRows = (invoices || []).map((inv: any) => [
          inv.debtors?.reference_id || '', inv.debtors?.company_name || '',
          inv.invoice_number || '', inv.amount_original || inv.amount || 0,
          inv.amount_outstanding || inv.amount || 0,
          inv.currency || 'USD', inv.issue_date || '', inv.due_date || '', inv.status || 'Open',
          inv.po_number || '', inv.product_description || '', inv.payment_terms || '',
          inv.paid_date || '', inv.notes || '', inv.reference_id || '',
          inv.integration_source || inv.source_system || 'recouply'
        ]);
        const paidRows = (paidInvoices || []).map((inv: any) => [
          inv.debtors?.reference_id || '', inv.debtors?.company_name || '',
          inv.invoice_number || '', inv.amount_original || inv.amount || 0,
          inv.amount_outstanding || 0,
          inv.currency || 'USD', inv.issue_date || '', inv.due_date || '', inv.status || 'Paid',
          inv.po_number || '', inv.product_description || '', inv.payment_terms || '',
          inv.paid_date || '', inv.notes || '', inv.reference_id || '',
          inv.integration_source || inv.source_system || 'recouply'
        ]);
        rowCount = openRows.length;
        sheets = [
          {
            properties: { title: 'Open Invoices', gridProperties: { frozenRowCount: 1 } },
            data: [{ startRow: 0, startColumn: 0, rowData: [
              buildHeaderRow(headers),
              ...openRows.map(r => buildDataRow(r, [3, 4])),
            ]}],
          },
          {
            properties: { title: 'Paid Invoices', gridProperties: { frozenRowCount: 1 } },
            data: [{ startRow: 0, startColumn: 0, rowData: [
              buildHeaderRow(headers),
              ...paidRows.map(r => buildDataRow(r, [3, 4])),
            ]}],
          },
        ];
      } else if (currentType === 'contracts') {
        sheetTitle = `${businessName} - Contracts Master`;
        try {
          const built = await buildContractsSheets(supabase, user.id, businessName);
          sheets = built.sheets;
          rowCount = built.rowCount;
        } catch (err: any) {
          console.error('buildContractsSheets failed:', err?.message || err, err?.stack);
          throw new Error(`Contracts builder error: ${err?.message || String(err)}`);
        }
      } else {
        sheetTitle = `${businessName} - Payments Master`;

        // Fetch open invoices with line items for pre-populated payment template
        const { data: openInvoices } = await supabase
          .from('invoices')
          .select('id, invoice_number, amount, amount_outstanding, currency, reference_id, debtors(reference_id, company_name)')
          .eq('user_id', user.id)
          .in('status', ['Open', 'PartiallyPaid', 'InPaymentPlan', 'Disputed'])
          .order('due_date', { ascending: true });

        // Fetch line items for open invoices
        const openInvIds = (openInvoices || []).map((i: any) => i.id);
        const lineItemsByInvoice = new Map<string, any[]>();
        for (let i = 0; i < openInvIds.length; i += 100) {
          const chunk = openInvIds.slice(i, i + 100);
          const { data: items } = await supabase
            .from('invoice_line_items')
            .select('invoice_id, description, quantity, unit_price, line_total, sort_order, line_type')
            .in('invoice_id', chunk)
            .order('sort_order', { ascending: true });
          for (const item of (items || [])) {
            if (!lineItemsByInvoice.has(item.invoice_id)) lineItemsByInvoice.set(item.invoice_id, []);
            lineItemsByInvoice.get(item.invoice_id)!.push(item);
          }
        }

        // Payment Template headers (pre-populated + user-fillable)
        const templateHeaders = [
          'Account RAID', 'Account Name', 'SS Invoice #', 'Recouply Invoice Ref (DO NOT EDIT)',
          'Line #', 'Line Type', 'Line Description', 'Line Amount',
          'Invoice Total Outstanding', 'Currency',
          'Payment Amount', 'Payment Reference', 'Payment Date',
          'Recouply Payment Ref (DO NOT EDIT)', 'Source'
        ];

        const templateRows: (string | number)[][] = [];
        for (const inv of (openInvoices || [])) {
          const items = lineItemsByInvoice.get(inv.id);
          const baseRow = [
            inv.debtors?.reference_id || '', inv.debtors?.company_name || '',
            inv.invoice_number || '', inv.reference_id || '',
          ];
          if (items && items.length > 0) {
            for (let idx = 0; idx < items.length; idx++) {
              const li = items[idx];
              templateRows.push([
                ...baseRow,
                idx + 1, li.line_type || 'item', li.description || '', li.line_total || 0,
                inv.amount_outstanding || inv.amount || 0, inv.currency || 'USD',
                '', '', '', '', '',
              ]);
            }
          } else {
            templateRows.push([
              ...baseRow,
              '', '', '', inv.amount_outstanding || inv.amount || 0,
              inv.amount_outstanding || inv.amount || 0, inv.currency || 'USD',
              '', '', '', '', '',
            ]);
          }
        }

        // Recorded Payments sheet with existing payments
        const { data: existingPayments } = await supabase
          .from('payments')
          .select('reference_id, amount, currency, payment_date, reference, reconciliation_status, invoice_number_hint, notes, source_system, debtors(reference_id, company_name)')
          .eq('user_id', user.id)
          .order('payment_date', { ascending: false })
          .limit(1000);

        const recordedHeaders = [
          'Account RAID', 'Account Name', 'SS Invoice #', 'Payment Amount', 'Currency',
          'Payment Date', 'Payment Reference', 'Reconciliation Status',
          'Notes', 'Recouply Payment Ref (DO NOT EDIT)', 'Source'
        ];
        const recordedRows = (existingPayments || []).map((p: any) => [
          p.debtors?.reference_id || '', p.debtors?.company_name || '',
          p.invoice_number_hint || '', p.amount || 0, p.currency || 'USD',
          p.payment_date || '', p.reference || '',
          p.reconciliation_status || 'pending', p.notes || '', p.reference_id || '',
          p.source_system || 'recouply',
        ]);

        rowCount = templateRows.length;
        sheets = [
          {
            properties: { title: 'Payment Template', gridProperties: { frozenRowCount: 1 } },
            data: [{ startRow: 0, startColumn: 0, rowData: [
              buildHeaderRow(templateHeaders),
              ...templateRows.map(r => buildDataRow(r, [7, 8])),
            ]}],
          },
          {
            properties: { title: 'Recorded Payments', gridProperties: { frozenRowCount: 1 } },
            data: [{ startRow: 0, startColumn: 0, rowData: [
              buildHeaderRow(recordedHeaders),
              ...recordedRows.map(r => buildDataRow(r, [3])),
            ]}],
          },
        ];
      }

      // Apply previously-saved column_config (from any prior soft-deleted template of same type)
      let savedConfig: any = null;
      try {
        const { data: prior } = await supabase
          .from('google_sheet_templates')
          .select('column_config')
          .eq('user_id', user.id)
          .eq('template_type', currentType)
          .not('column_config', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (prior?.column_config && Object.keys(prior.column_config).length > 0) {
          savedConfig = prior.column_config;
          sheets = applyColumnConfig(sheets, savedConfig);
        }
      } catch (cfgErr) {
        console.warn('column_config lookup failed (non-fatal):', cfgErr);
      }

      // Create Google Sheet
      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties: { title: sheetTitle }, sheets }),
      });

      const sheetData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(`Failed to create ${currentType} sheet: ${sheetData.error?.message || JSON.stringify(sheetData)}`);
      }

      const spreadsheetId = sheetData.spreadsheetId;
      const spreadsheetUrl = sheetData.spreadsheetUrl;

      // Move sheet into folder
      const fileRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=parents&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const fileData = await fileRes.json();
      const previousParents = (fileData.parents || []).join(',');

      await fetch(
        `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?addParents=${templatesFolderId}&removeParents=${previousParents}&supportsAllDrives=true`,
        { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}` } }
      );

      // Save template record
      await supabase.from('google_sheet_templates').insert({
        user_id: user.id,
        organization_id: orgId,
        connection_id: connection.id,
        debtor_id: null,
        template_type: currentType,
        sheet_id: spreadsheetId,
        sheet_url: spreadsheetUrl,
        sheet_name: sheetTitle,
        drive_file_id: spreadsheetId,
        status: 'active',
        rows_synced: rowCount,
        folder_path: folderPath,
        last_push_at: new Date().toISOString(),
      });

      // Audit log
      await supabase.from('ingestion_audit_log').insert({
        user_id: user.id,
        organization_id: orgId,
        event_type: 'sheet_template_pushed',
        event_details: {
          template_type: currentType,
          sheet_id: spreadsheetId,
          rows: rowCount,
          folder_path: folderPath,
        },
      });

      results.push({
        templateType: currentType,
        spreadsheetId,
        spreadsheetUrl,
        sheetTitle,
        rowCount,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      results,
      folderPath,
      created: results.length,
      skipped: typesToCreate.length - toCreate.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('google-sheets-push-template error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
