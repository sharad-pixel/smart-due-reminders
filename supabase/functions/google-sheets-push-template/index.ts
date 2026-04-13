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

    // Support batch: templateTypes = ['accounts','invoices','payments'] or single templateType
    const typesToCreate: string[] = templateTypes 
      ? templateTypes.filter((t: string) => ['accounts', 'invoices', 'payments'].includes(t))
      : templateType && ['accounts', 'invoices', 'payments'].includes(templateType) 
        ? [templateType] 
        : [];

    if (typesToCreate.length === 0) {
      return new Response(JSON.stringify({ error: 'templateType(s) must be accounts, invoices, or payments' }), {
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
