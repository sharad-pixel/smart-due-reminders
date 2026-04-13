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
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: connection.refresh_token, grant_type: 'refresh_token' }),
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

function parseDate(val: string): string | null {
  if (!val || val.trim() === '') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return val.trim();
  const mdyMatch = val.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) return `${mdyMatch[3]}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`;
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

function getVal(row: any[], idx: number): string {
  return idx >= 0 && idx < row.length ? (row[idx] || '').toString().trim() : '';
}

async function readSheet(accessToken: string, spreadsheetId: string, range: string) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Sheets API: ${JSON.stringify(data)}`);
  return data.values || [];
}

async function batchUpdateSheet(accessToken: string, spreadsheetId: string, updates: any[]) {
  if (updates.length === 0) return;
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'RAW', data: updates }),
    }
  );
}

const CHUNK_SIZE = 50;

// --- Incremental push helpers ---

function rowToKey(row: any[], keyCol: number): string {
  return (row[keyCol] || '').toString().trim();
}

function rowsEqual(a: any[], b: any[]): boolean {
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i++) {
    if (String(a[i] ?? '') !== String(b[i] ?? '')) return false;
  }
  return true;
}

async function incrementalPush(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  colRange: string,
  headers: string[],
  newDataRows: any[][],
  keyCol: number,
) {
  // Read existing sheet rows
  const range = `'${sheetName}'!${colRange}`;
  let existingRows: any[][] = [];
  try {
    existingRows = await readSheet(accessToken, spreadsheetId, range);
  } catch { /* sheet might be empty */ }

  // If sheet is empty or has no data, do a full write
  if (existingRows.length <= 1) {
    const allRows = [headers, ...newDataRows];
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`, {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}` },
    });
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${sheetName}'!A1`)}?valueInputOption=RAW`,
      { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: allRows }) }
    );
    return { updated: 0, added: newDataRows.length, removed: 0, unchanged: 0, mode: 'full' };
  }

  // Build index of existing rows by key (skip header row 0)
  const existingByKey = new Map<string, { idx: number; row: any[] }>();
  for (let i = 1; i < existingRows.length; i++) {
    const key = rowToKey(existingRows[i], keyCol);
    if (key) existingByKey.set(key, { idx: i, row: existingRows[i] });
  }

  // Build index of new rows by key
  const newByKey = new Map<string, any[]>();
  for (const row of newDataRows) {
    const key = rowToKey(row, keyCol);
    if (key) newByKey.set(key, row);
  }

  const batchUpdates: { range: string; values: any[][] }[] = [];
  let updated = 0, unchanged = 0;

  // Check existing rows: update changed, mark removed
  const removedKeys: string[] = [];
  for (const [key, { idx, row }] of existingByKey) {
    const newRow = newByKey.get(key);
    if (!newRow) {
      removedKeys.push(key);
    } else if (!rowsEqual(row, newRow)) {
      batchUpdates.push({ range: `'${sheetName}'!A${idx + 1}`, values: [newRow] });
      updated++;
    } else {
      unchanged++;
    }
  }

  // Find new rows to append
  const toAppend: any[][] = [];
  for (const [key, row] of newByKey) {
    if (!existingByKey.has(key)) toAppend.push(row);
  }

  // If there are removed rows, we need to rewrite (can't delete individual rows via values API easily)
  if (removedKeys.length > 0) {
    // Rebuild: header + all new data
    const allRows = [headers, ...newDataRows];
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`, {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}` },
    });
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${sheetName}'!A1`)}?valueInputOption=RAW`,
      { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: allRows }) }
    );
    return { updated, added: toAppend.length, removed: removedKeys.length, unchanged, mode: 'rewrite' };
  }

  // Apply in-place updates in batch
  if (batchUpdates.length > 0) {
    // Batch in chunks of 100 to stay within API limits
    for (let i = 0; i < batchUpdates.length; i += 100) {
      const chunk = batchUpdates.slice(i, i + 100);
      await batchUpdateSheet(accessToken, spreadsheetId, chunk);
    }
  }

  // Append new rows
  if (toAppend.length > 0) {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${sheetName}'!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: toAppend }),
      }
    );
  }

  return { updated, added: toAppend.length, removed: 0, unchanged, mode: 'incremental' };
}

// --- Push functions (now incremental) ---

async function pushAccounts(supabase: any, accessToken: string, template: any, userId: string) {
  const { data: debtors } = await supabase
    .from('debtors')
    .select('reference_id, company_name, type, name, email, phone, address_line1, address_line2, city, state, postal_code, country, industry, external_customer_id, crm_account_id_external, payment_terms_default, notes, current_balance, integration_source, source_system, payment_score, payment_risk_tier')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('company_name', { ascending: true });

  const headers = [
    'RAID', 'Company Name', 'Type (B2B/B2C)', 'Contact Name', 'Contact Email', 'Contact Phone',
    'Address Line 1', 'Address Line 2', 'City', 'State', 'Postal Code', 'Country',
    'Industry', 'Source System ID', 'CRM ID', 'Default Payment Terms',
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
    d.payment_score ?? '', d.payment_risk_tier || '',
  ]);

  return await incrementalPush(accessToken, template.sheet_id, 'Accounts', 'A:U', headers, dataRows, 0);
}

async function pushInvoices(supabase: any, accessToken: string, template: any, userId: string) {
  const { data: openInvoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, amount, amount_original, amount_outstanding, currency, issue_date, due_date, paid_date, status, po_number, product_description, payment_terms, notes, reference_id, integration_source, source_system, debtors(reference_id, company_name)')
    .eq('user_id', userId)
    .in('status', ['Open', 'InPaymentPlan', 'PartiallyPaid', 'Disputed'])
    .order('due_date', { ascending: false });

  const { data: paidInvoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, amount, amount_original, amount_outstanding, currency, issue_date, due_date, paid_date, status, po_number, product_description, payment_terms, notes, reference_id, integration_source, source_system, debtors(reference_id, company_name)')
    .eq('user_id', userId)
    .in('status', ['Paid', 'Canceled', 'Voided', 'Settled', 'FinalInternalCollections'])
    .order('due_date', { ascending: false })
    .limit(1000);

  // Fetch line items for all invoices
  const allInvIds = [...(openInvoices || []), ...(paidInvoices || [])].map((i: any) => i.id);
  const lineItemsByInvoice = new Map<string, any[]>();
  
  for (let i = 0; i < allInvIds.length; i += 100) {
    const chunk = allInvIds.slice(i, i + 100);
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

  const headers = [
    'Account RAID', 'Account Name', 'SS Invoice #', 'Original Amount', 'Amount Outstanding',
    'Currency', 'Issue Date', 'Due Date', 'Status', 'PO Number', 'Product/Description',
    'Payment Terms', 'Paid Date', 'Notes', 'Recouply Invoice Ref (DO NOT EDIT)', 'Source',
    'Line #', 'Line Type', 'Line Description', 'Line Qty', 'Line Unit Price', 'Line Total'
  ];

  const mapInvRows = (inv: any): any[][] => {
    const baseRow = [
      inv.debtors?.reference_id || '', inv.debtors?.company_name || '',
      inv.invoice_number || '', inv.amount_original || inv.amount || 0,
      inv.amount_outstanding || inv.amount || 0,
      inv.currency || 'USD', inv.issue_date || '', inv.due_date || '', inv.status || '',
      inv.po_number || '', inv.product_description || '', inv.payment_terms || '',
      inv.paid_date || '', inv.notes || '', inv.reference_id || '',
      inv.integration_source || inv.source_system || 'recouply',
    ];
    
    const items = lineItemsByInvoice.get(inv.id);
    if (items && items.length > 0) {
      return items.map((li: any, idx: number) => [
        ...baseRow,
        idx + 1, li.line_type || 'item', li.description || '',
        li.quantity || 0, li.unit_price || 0, li.line_total || 0,
      ]);
    }
    return [[...baseRow, '', '', '', '', '', '']];
  };

  const openDataRows = (openInvoices || []).flatMap(mapInvRows);
  const paidDataRows = (paidInvoices || []).flatMap(mapInvRows);

  // Key col 14 = Recouply Invoice Ref
  const [openResult, paidResult] = await Promise.all([
    incrementalPush(accessToken, template.sheet_id, 'Open Invoices', 'A:V', headers, openDataRows, 14),
    incrementalPush(accessToken, template.sheet_id, 'Paid Invoices', 'A:V', headers, paidDataRows, 14),
  ]);

  return { openPushed: openDataRows.length, paidPushed: paidDataRows.length, openResult, paidResult };
}

async function pushPayments(supabase: any, accessToken: string, template: any, userId: string) {
  // Fetch open/partially-paid invoices with debtors + line items for pre-populated template
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, amount, amount_outstanding, currency, reference_id, debtors(reference_id, company_name)')
    .eq('user_id', userId)
    .in('status', ['Open', 'PartiallyPaid', 'InPaymentPlan', 'Disputed'])
    .order('due_date', { ascending: true });

  // Fetch line items
  const allInvIds = (invoices || []).map((i: any) => i.id);
  const lineItemsByInvoice = new Map<string, any[]>();
  for (let i = 0; i < allInvIds.length; i += 100) {
    const chunk = allInvIds.slice(i, i + 100);
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

  // Also fetch existing payments to show in a second sheet
  const { data: existingPayments } = await supabase
    .from('payments')
    .select('reference_id, amount, currency, payment_date, reference, reconciliation_status, invoice_number_hint, notes, source_system, debtors(reference_id, company_name)')
    .eq('user_id', userId)
    .order('payment_date', { ascending: false })
    .limit(1000);

  // Template sheet headers — pre-populated + user-fillable
  const templateHeaders = [
    'Account RAID', 'Account Name', 'SS Invoice #', 'Recouply Invoice Ref (DO NOT EDIT)',
    'Line #', 'Line Type', 'Line Description', 'Line Amount',
    'Invoice Total Outstanding', 'Currency',
    'Payment Amount', 'Payment Reference', 'Payment Date',
    'Recouply Payment Ref (DO NOT EDIT)', 'Source'
  ];

  const templateRows: any[][] = [];
  for (const inv of (invoices || [])) {
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
          '', '', '', '', '', // empty payment columns for user to fill
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

  // Recorded payments sheet
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

  // Push template sheet (key col 3 = Recouply Invoice Ref) and recorded payments (key col 9)
  const [templateResult, recordedResult] = await Promise.all([
    incrementalPush(accessToken, template.sheet_id, 'Payment Template', 'A:O', templateHeaders, templateRows, 3),
    incrementalPush(accessToken, template.sheet_id, 'Recorded Payments', 'A:K', recordedHeaders, recordedRows, 9),
  ]);

  return { templatePushed: templateRows.length, recordedPushed: recordedRows.length, templateResult, recordedResult };
}

async function pullAccounts(
  supabase: any, accessToken: string, template: any, userId: string, orgId: string,
  updateProgress: (status: string, progress: Record<string, any>) => Promise<void>
) {
  await updateProgress('syncing', { phase: 'reading_sheet', percent: 15, direction: 'pull' });
  const rows = await readSheet(accessToken, template.sheet_id, 'Accounts!A1:S5000');
  if (rows.length <= 1) return { created: 0, updated: 0, skipped: 0, syncProtected: 0 };

  const headers = rows[0].map((h: string) => h.toLowerCase().trim());
  const raidIdx = headers.indexOf('raid');
  const companyIdx = headers.indexOf('company name');
  const typeIdx = headers.indexOf('type (b2b/b2c)');
  const nameIdx = headers.findIndex((h: string) => h === 'contact name' || h === 'name');
  const emailIdx = headers.findIndex((h: string) => h === 'contact email' || h === 'email');
  const phoneIdx = headers.findIndex((h: string) => h === 'contact phone' || h === 'phone');
  const addr1Idx = headers.indexOf('address line 1');
  const addr2Idx = headers.indexOf('address line 2');
  const cityIdx = headers.indexOf('city');
  const stateIdx = headers.indexOf('state');
  const postalIdx = headers.findIndex((h: string) => h === 'postal code' || h === 'zip' || h === 'zip code');
  const countryIdx = headers.indexOf('country');
  const industryIdx = headers.indexOf('industry');
  const extCustIdx = headers.findIndex((h: string) => h === 'source system id' || h === 'external customer id');
  const crmIdx = headers.indexOf('crm id');
  const payTermsIdx = headers.indexOf('default payment terms');
  const notesIdx = headers.indexOf('notes');
  const sourceIdx = headers.indexOf('source');

  let created = 0, updated = 0, skipped = 0, syncProtected = 0;

  // BATCH: Pre-load all existing debtors and their primary contacts
  await updateProgress('syncing', { phase: 'processing', percent: 25, direction: 'pull' });
  const [{ data: existingDebtors }, { data: syncProtectedAccounts }] = await Promise.all([
    supabase.from('debtors').select('id, reference_id').eq('user_id', userId).eq('is_archived', false),
    supabase.from('debtors').select('reference_id').eq('user_id', userId).eq('sheet_sync_enabled', false),
  ]);

  const raidToDebtorId = new Map<string, string>();
  for (const d of (existingDebtors || [])) {
    if (d.reference_id) raidToDebtorId.set(d.reference_id, d.id);
  }
  const protectedRaids = new Set((syncProtectedAccounts || []).map((d: any) => d.reference_id));

  // Classify rows into updates vs new staging imports
  const updateItems: { raid: string; debtorId: string; fieldData: any }[] = [];
  const stagingItems: any[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const raid = getVal(row, raidIdx);
    const companyName = getVal(row, companyIdx);
    const contactName = getVal(row, nameIdx);
    const email = getVal(row, emailIdx);
    const source = getVal(row, sourceIdx);

    if (!companyName && !contactName) continue;
    if (raid && protectedRaids.has(raid)) { syncProtected++; continue; }

    const fieldData: any = {};
    if (companyName) fieldData.company_name = companyName;
    if (contactName) fieldData.name = contactName;
    if (email) fieldData.email = email;
    if (getVal(row, phoneIdx)) fieldData.phone = getVal(row, phoneIdx);
    if (getVal(row, typeIdx)) fieldData.type = getVal(row, typeIdx);
    if (getVal(row, addr1Idx)) fieldData.address_line1 = getVal(row, addr1Idx);
    if (getVal(row, addr2Idx)) fieldData.address_line2 = getVal(row, addr2Idx);
    if (getVal(row, cityIdx)) fieldData.city = getVal(row, cityIdx);
    if (getVal(row, stateIdx)) fieldData.state = getVal(row, stateIdx);
    if (getVal(row, postalIdx)) fieldData.postal_code = getVal(row, postalIdx);
    if (getVal(row, countryIdx)) fieldData.country = getVal(row, countryIdx);
    if (getVal(row, industryIdx)) fieldData.industry = getVal(row, industryIdx);
    if (getVal(row, extCustIdx)) fieldData.external_customer_id = getVal(row, extCustIdx);
    if (getVal(row, crmIdx)) fieldData.crm_account_id_external = getVal(row, crmIdx);
    if (getVal(row, payTermsIdx)) fieldData.payment_terms_default = getVal(row, payTermsIdx);
    if (getVal(row, notesIdx)) fieldData.notes = getVal(row, notesIdx);

    if (raid && raidToDebtorId.has(raid)) {
      updateItems.push({ raid, debtorId: raidToDebtorId.get(raid)!, fieldData });
    } else if (!raid) {
      stagingItems.push({
        user_id: userId,
        organization_id: orgId,
        sheet_template_id: template.id,
        raw_json: fieldData,
        company_name: fieldData.company_name || null,
        contact_name: fieldData.name || null,
        email: fieldData.email || null,
        phone: fieldData.phone || null,
        address_line1: fieldData.address_line1 || null,
        address_line2: fieldData.address_line2 || null,
        city: fieldData.city || null,
        state: fieldData.state || null,
        postal_code: fieldData.postal_code || null,
        country: fieldData.country || null,
        industry: fieldData.industry || null,
        type: fieldData.type || 'B2B',
        external_customer_id: fieldData.external_customer_id || null,
        crm_account_id_external: fieldData.crm_account_id_external || null,
        payment_terms_default: fieldData.payment_terms_default || null,
        notes: fieldData.notes || null,
        source: source || 'google_sheets',
        sheet_row_number: i + 1,
        status: 'pending',
      });
    } else {
      skipped++;
    }
  }

  // BATCH: Process debtor updates in parallel chunks
  const totalWork = updateItems.length + stagingItems.length;
  let processed = 0;

  for (let c = 0; c < updateItems.length; c += CHUNK_SIZE) {
    const chunk = updateItems.slice(c, c + CHUNK_SIZE);
    const results = await Promise.all(chunk.map(async (item) => {
      const { error } = await supabase
        .from('debtors')
        .update(item.fieldData)
        .eq('reference_id', item.raid)
        .eq('user_id', userId);
      return !error;
    }));

    for (const success of results) {
      if (success) updated++;
      else skipped++;
    }
    processed += chunk.length;

    // Report progress: 30-70% range for updates
    const pct = Math.round(30 + (processed / Math.max(totalWork, 1)) * 40);
    await updateProgress('syncing', { phase: 'processing', percent: Math.min(pct, 70), direction: 'pull', updated, created, skipped });
  }

  // BATCH: Update primary contacts in parallel for updated debtors
  if (updateItems.length > 0) {
    const contactUpdates = updateItems.filter(item => item.fieldData.name || item.fieldData.email || item.fieldData.phone);
    for (let c = 0; c < contactUpdates.length; c += CHUNK_SIZE) {
      const chunk = contactUpdates.slice(c, c + CHUNK_SIZE);
      await Promise.all(chunk.map(async (item) => {
        const contactUpdate: any = { updated_at: new Date().toISOString() };
        if (item.fieldData.name) contactUpdate.name = item.fieldData.name;
        if (item.fieldData.email) contactUpdate.email = item.fieldData.email;
        if (item.fieldData.phone) contactUpdate.phone = item.fieldData.phone;

        const { data: existingContact } = await supabase
          .from('debtor_contacts')
          .update(contactUpdate)
          .eq('debtor_id', item.debtorId)
          .eq('is_primary', true)
          .select('id')
          .maybeSingle();

        if (!existingContact && item.fieldData.name) {
          await supabase.from('debtor_contacts').insert({
            debtor_id: item.debtorId,
            user_id: userId,
            organization_id: orgId || null,
            name: item.fieldData.name,
            email: item.fieldData.email || null,
            phone: item.fieldData.phone || null,
            is_primary: true,
            source: 'google_sheets',
          });
        }
      }));
    }
  }

  // BATCH: Insert staging items in chunks
  await updateProgress('syncing', { phase: 'processing', percent: 75, direction: 'pull', updated, created, skipped });
  for (let c = 0; c < stagingItems.length; c += CHUNK_SIZE) {
    const chunk = stagingItems.slice(c, c + CHUNK_SIZE);
    const { data: inserted, error } = await supabase
      .from('pending_sheet_imports')
      .insert(chunk)
      .select('id');

    if (!error && inserted) {
      created += inserted.length;
    } else {
      skipped += chunk.length;
      if (error) console.error('[PULL] Batch staging error:', error.message);
    }
    processed += chunk.length;
    const pct = Math.round(70 + (processed / Math.max(totalWork, 1)) * 20);
    await updateProgress('syncing', { phase: 'processing', percent: Math.min(pct, 90), direction: 'pull', updated, created, skipped });
  }

  return { created, updated, skipped, syncProtected };
}

async function pullInvoices(
  supabase: any, accessToken: string, template: any, userId: string, orgId: string,
  updateProgress: (status: string, progress: Record<string, any>) => Promise<void>
) {
  await updateProgress('syncing', { phase: 'reading_sheet', percent: 15, direction: 'pull' });
  const rows = await readSheet(accessToken, template.sheet_id, "'Open Invoices'!A1:V5000");
  if (rows.length <= 1) return { created: 0, updated: 0, skipped: 0, movedToPaid: 0, syncProtected: 0, lineItemsCreated: 0 };

  const headers = rows[0].map((h: string) => h.toLowerCase().trim());
  const accountRaidIdx = headers.indexOf('account raid');
  const invNumIdx = headers.findIndex((h: string) => h === 'ss invoice #' || h === 'invoice number');
  const amountIdx = headers.findIndex((h: string) => h === 'original amount' || h === 'amount');
  const amtOutIdx = headers.indexOf('amount outstanding');
  const currIdx = headers.indexOf('currency');
  const issueDateIdx = headers.indexOf('issue date');
  const dueDateIdx = headers.indexOf('due date');
  const statusIdx = headers.indexOf('status');
  const poIdx = headers.indexOf('po number');
  const descIdx = headers.indexOf('product/description');
  const termsIdx = headers.indexOf('payment terms');
  const notesIdx = headers.indexOf('notes');
  const refIdx = headers.findIndex((h: string) => h.includes('recouply') && h.includes('ref') && h.includes('do not edit'));
  const sourceIdx = headers.indexOf('source');
  const lineNumIdx = headers.indexOf('line #');
  const lineTypeIdx = headers.indexOf('line type');
  const lineDescIdx = headers.indexOf('line description');
  const lineQtyIdx = headers.indexOf('line qty');
  const lineUnitPriceIdx = headers.indexOf('line unit price');
  const lineTotalIdx = headers.indexOf('line total');
  const hasLineItemCols = lineNumIdx >= 0 || lineDescIdx >= 0;

  let created = 0, updated = 0, skipped = 0, movedToPaid = 0, syncProtected = 0, lineItemsCreated = 0;
  const sheetUpdates: any[] = [];
  const rowsToMoveToPaid: number[] = [];

  // BATCH: Pre-load all debtors
  await updateProgress('syncing', { phase: 'processing', percent: 25, direction: 'pull' });
  const { data: allDebtors } = await supabase
    .from('debtors')
    .select('id, reference_id, sheet_sync_enabled')
    .eq('user_id', userId)
    .eq('is_archived', false);

  const raidToDebtorId = new Map<string, string>();
  const protectedRaids = new Set<string>();
  for (const d of (allDebtors || [])) {
    if (d.reference_id) raidToDebtorId.set(d.reference_id, d.id);
    if (d.sheet_sync_enabled === false && d.reference_id) protectedRaids.add(d.reference_id);
  }

  // Classify rows - group by invoice number when line items present
  const updateBatch: { ref: string; data: any; rowIdx: number }[] = [];
  const insertBatch: { record: any; rowIdx: number; lineItems: any[] }[] = [];

  if (hasLineItemCols) {
    // Group rows by invoice number + account RAID for line item grouping
    const invoiceGroups = new Map<string, { rows: any[][]; indices: number[] }>();
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const invoiceNumber = getVal(row, invNumIdx);
      const accountRaid = getVal(row, accountRaidIdx);
      if (!invoiceNumber) continue;
      
      const recouplyRef = getVal(row, refIdx);
      const source = getVal(row, sourceIdx);
      
      // Updates go through individually
      if (recouplyRef && source.toLowerCase() === 'recouply') {
        if (accountRaid && protectedRaids.has(accountRaid)) { syncProtected++; continue; }
        const status = getVal(row, statusIdx);
        const updateData: any = {};
        const amtOut = parseFloat(getVal(row, amtOutIdx));
        if (!isNaN(amtOut)) updateData.amount_outstanding = amtOut;
        if (status) updateData.status = status;
        updateBatch.push({ ref: recouplyRef, data: updateData, rowIdx: i });
        const terminalStatuses = ['paid', 'canceled', 'voided', 'writtenoff', 'settled', 'credited'];
        if (terminalStatuses.includes(status.toLowerCase())) rowsToMoveToPaid.push(i);
        continue;
      }
      
      const key = `${accountRaid}::${invoiceNumber}`;
      if (!invoiceGroups.has(key)) invoiceGroups.set(key, { rows: [], indices: [] });
      invoiceGroups.get(key)!.rows.push(row);
      invoiceGroups.get(key)!.indices.push(i);
    }

    // Convert groups to insert batch
    for (const [, group] of invoiceGroups) {
      const firstRow = group.rows[0];
      const accountRaid = getVal(firstRow, accountRaidIdx);
      if (accountRaid && protectedRaids.has(accountRaid)) { syncProtected++; continue; }
      
      const debtorId = accountRaid ? raidToDebtorId.get(accountRaid) || null : null;
      if (!debtorId) { skipped++; continue; }

      const status = getVal(firstRow, statusIdx);
      const dueDate = parseDate(getVal(firstRow, dueDateIdx));
      if (!dueDate) { skipped++; continue; }

      // Build line items from all rows in group
      const lineItems = group.rows.map((row, idx) => ({
        description: getVal(row, lineDescIdx),
        quantity: parseFloat(getVal(row, lineQtyIdx)) || 1,
        unit_price: parseFloat(getVal(row, lineUnitPriceIdx)) || 0,
        line_total: parseFloat(getVal(row, lineTotalIdx)) || 0,
        line_type: getVal(row, lineTypeIdx).toLowerCase().includes('tax') ? 'tax' : 'item',
        sort_order: parseInt(getVal(row, lineNumIdx)) || (idx + 1),
      }));

      const liTotal = lineItems.reduce((s, li) => s + (li.line_total || li.quantity * li.unit_price), 0);
      const amount = liTotal > 0 ? liTotal : (parseFloat(getVal(firstRow, amountIdx)) || 0);

      insertBatch.push({
        record: {
          user_id: userId,
          organization_id: orgId,
          debtor_id: debtorId,
          invoice_number: getVal(firstRow, invNumIdx),
          amount, amount_original: amount,
          amount_outstanding: parseFloat(getVal(firstRow, amtOutIdx)) || amount,
          currency: (getVal(firstRow, currIdx) || 'USD').toUpperCase(),
          issue_date: parseDate(getVal(firstRow, issueDateIdx)),
          due_date: dueDate,
          status: status || 'Open',
          po_number: getVal(firstRow, poIdx) || null,
          product_description: getVal(firstRow, descIdx) || null,
          payment_terms: getVal(firstRow, termsIdx) || null,
          notes: getVal(firstRow, notesIdx) ? `[Sheet] ${getVal(firstRow, notesIdx)}` : '[Sheet Import]',
          source_system: 'google_sheets',
        },
        rowIdx: group.indices[0],
        lineItems,
      });

      const terminalStatuses = ['paid', 'canceled', 'voided', 'writtenoff', 'settled', 'credited'];
      if (terminalStatuses.includes(status.toLowerCase())) {
        group.indices.forEach(idx => rowsToMoveToPaid.push(idx));
      }
    }
  } else {
    // Original non-line-item flow
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const recouplyRef = getVal(row, refIdx);
      const source = getVal(row, sourceIdx);
      const invoiceNumber = getVal(row, invNumIdx);
      const accountRaid = getVal(row, accountRaidIdx);
      const status = getVal(row, statusIdx);

      if (!invoiceNumber) continue;
      if (accountRaid && protectedRaids.has(accountRaid)) { syncProtected++; continue; }

      const terminalStatuses = ['paid', 'canceled', 'voided', 'writtenoff', 'settled', 'credited'];
      const isTerminal = terminalStatuses.includes(status.toLowerCase());

      if (recouplyRef && source.toLowerCase() === 'recouply') {
        const updateData: any = {};
        const amtOut = parseFloat(getVal(row, amtOutIdx));
        if (!isNaN(amtOut)) updateData.amount_outstanding = amtOut;
        if (status) updateData.status = status;
        updateBatch.push({ ref: recouplyRef, data: updateData, rowIdx: i });
        if (isTerminal) rowsToMoveToPaid.push(i);
      } else {
        const debtorId = accountRaid ? raidToDebtorId.get(accountRaid) || null : null;
        if (!debtorId) { skipped++; continue; }

        const amount = parseFloat(getVal(row, amountIdx)) || 0;
        const dueDate = parseDate(getVal(row, dueDateIdx));
        if (!dueDate) { skipped++; continue; }

        insertBatch.push({
          record: {
            user_id: userId,
            organization_id: orgId,
            debtor_id: debtorId,
            invoice_number: invoiceNumber,
            amount, amount_original: amount,
            amount_outstanding: parseFloat(getVal(row, amtOutIdx)) || amount,
            currency: (getVal(row, currIdx) || 'USD').toUpperCase(),
            issue_date: parseDate(getVal(row, issueDateIdx)),
            due_date: dueDate,
            status: status || 'Open',
            po_number: getVal(row, poIdx) || null,
            product_description: getVal(row, descIdx) || null,
            payment_terms: getVal(row, termsIdx) || null,
            notes: getVal(row, notesIdx) ? `[Sheet] ${getVal(row, notesIdx)}` : '[Sheet Import]',
            source_system: 'google_sheets',
          },
          rowIdx: i,
          lineItems: [],
        });
        if (isTerminal) rowsToMoveToPaid.push(i);
      }
    }
  }

  const totalWork = updateBatch.length + insertBatch.length;
  let processed = 0;

  // BATCH: Process updates in parallel chunks
  for (let c = 0; c < updateBatch.length; c += CHUNK_SIZE) {
    const chunk = updateBatch.slice(c, c + CHUNK_SIZE);
    const results = await Promise.all(chunk.map(async (item) => {
      const { error } = await supabase
        .from('invoices')
        .update(item.data)
        .eq('reference_id', item.ref)
        .eq('user_id', userId);
      return !error;
    }));
    for (const success of results) {
      if (success) updated++;
      else skipped++;
    }
    processed += chunk.length;
    const pct = Math.round(30 + (processed / Math.max(totalWork, 1)) * 40);
    await updateProgress('syncing', { phase: 'processing', percent: Math.min(pct, 70), direction: 'pull', created, updated, skipped });
  }

  // BATCH: Process inserts in chunks
  for (let c = 0; c < insertBatch.length; c += CHUNK_SIZE) {
    const chunk = insertBatch.slice(c, c + CHUNK_SIZE);
    const records = chunk.map(item => item.record);
    const { data: inserted, error } = await supabase
      .from('invoices')
      .insert(records)
      .select('id, reference_id, invoice_number');

    if (!error && inserted) {
      created += inserted.length;
      for (let j = 0; j < inserted.length; j++) {
        const inv = inserted[j];
        const rowIdx = chunk[j].rowIdx;
        if (refIdx >= 0) sheetUpdates.push({ range: `'Open Invoices'!${String.fromCharCode(65 + refIdx)}${rowIdx + 1}`, values: [[inv.reference_id]] });
        if (sourceIdx >= 0) sheetUpdates.push({ range: `'Open Invoices'!${String.fromCharCode(65 + sourceIdx)}${rowIdx + 1}`, values: [['recouply']] });

        // Insert line items if present
        const liItems = chunk[j].lineItems;
        if (liItems && liItems.length > 0) {
          const liRecords = liItems.map((li: any) => ({
            invoice_id: inv.id,
            user_id: userId,
            description: li.description,
            quantity: li.quantity,
            unit_price: li.unit_price,
            line_total: li.line_total || li.quantity * li.unit_price,
            line_type: li.line_type,
            sort_order: li.sort_order,
          }));
          const { error: liErr } = await supabase.from('invoice_line_items').insert(liRecords);
          if (!liErr) lineItemsCreated += liRecords.length;
          else console.error('Line items insert error:', liErr.message);
        }
      }
    } else {
      skipped += chunk.length;
      if (error) console.error('Batch invoice insert error:', error.message);
    }
    processed += chunk.length;
    const pct = Math.round(30 + (processed / Math.max(totalWork, 1)) * 40);
    await updateProgress('syncing', { phase: 'processing', percent: Math.min(pct, 80), direction: 'pull', created, updated, skipped });
  }

  // Write-back and move-to-paid
  await updateProgress('syncing', { phase: 'processing', percent: 85, direction: 'pull', created, updated, skipped });
  await batchUpdateSheet(accessToken, template.sheet_id, sheetUpdates);

  if (rowsToMoveToPaid.length > 0) {
    const paidAppendRows = rowsToMoveToPaid.map(ri => rows[ri]);
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${template.sheet_id}/values/'Paid Invoices'!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: paidAppendRows }),
      }
    );
    movedToPaid = rowsToMoveToPaid.length;
    const clearUpdates = rowsToMoveToPaid.map(ri => ({
      range: `'Open Invoices'!A${ri + 1}:V${ri + 1}`,
      values: [Array(22).fill('')],
    }));
    await batchUpdateSheet(accessToken, template.sheet_id, clearUpdates);
  }

  return { created, updated, skipped, movedToPaid, syncProtected, lineItemsCreated };
}

async function pullPayments(
  supabase: any, accessToken: string, template: any, userId: string, orgId: string,
  updateProgress: (status: string, progress: Record<string, any>) => Promise<void>
) {
  await updateProgress('syncing', { phase: 'reading_sheet', percent: 15, direction: 'pull' });
  // Read from "Payment Template" sheet (new format) or fall back to "Payments" (legacy)
  let rows: any[][] = [];
  try {
    rows = await readSheet(accessToken, template.sheet_id, "'Payment Template'!A1:O5000");
  } catch {
    rows = await readSheet(accessToken, template.sheet_id, 'Payments!A1:K5000');
  }
  if (rows.length <= 1) return { created: 0, skipped: 0, syncProtected: 0 };

  const headers = rows[0].map((h: string) => h.toLowerCase().trim());
  const accountRaidIdx = headers.indexOf('account raid');
  const invNumIdx = headers.findIndex((h: string) => h === 'ss invoice #' || h === 'invoice number' || h === 'invoice ref');
  const amountIdx = headers.indexOf('payment amount');
  const currIdx = headers.indexOf('currency');
  const dateIdx = headers.indexOf('payment date');
  const refIdx = headers.indexOf('payment reference');
  const reconIdx = headers.findIndex((h: string) => h === 'reconciliation status' || h === 'status');
  const notesIdx = headers.indexOf('notes');
  const payRefIdx = headers.findIndex((h: string) => h.includes('recouply') && h.includes('ref') && h.includes('do not edit'));
  const sourceIdx = headers.indexOf('source');

  let created = 0, skipped = 0, syncProtected = 0;
  const sheetUpdates: any[] = [];

  // BATCH: Pre-load all debtors and invoices
  await updateProgress('syncing', { phase: 'processing', percent: 25, direction: 'pull' });
  const [{ data: allDebtors }, { data: allInvoices }] = await Promise.all([
    supabase.from('debtors').select('id, reference_id, sheet_sync_enabled').eq('user_id', userId).eq('is_archived', false),
    supabase.from('invoices').select('id, invoice_number, debtor_id, amount_outstanding, amount').eq('user_id', userId),
  ]);

  const raidToDebtorId = new Map<string, string>();
  const protectedRaids = new Set<string>();
  for (const d of (allDebtors || [])) {
    if (d.reference_id) raidToDebtorId.set(d.reference_id, d.id);
    if (d.sheet_sync_enabled === false && d.reference_id) protectedRaids.add(d.reference_id);
  }

  const invNumToInvoice = new Map<string, any>();
  for (const inv of (allInvoices || [])) {
    if (inv.invoice_number) invNumToInvoice.set(inv.invoice_number, inv);
  }

  // Collect insertable rows
  const insertBatch: { record: any; rowIdx: number; invoiceId: string | null }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const payRef = getVal(row, payRefIdx);
    const source = getVal(row, sourceIdx);
    const accountRaid = getVal(row, accountRaidIdx);

    if (accountRaid && protectedRaids.has(accountRaid)) { syncProtected++; continue; }
    if (payRef && source.toLowerCase() === 'recouply') { skipped++; continue; }

    const amount = parseFloat(getVal(row, amountIdx));
    if (!amount || isNaN(amount)) continue;

    const invoiceNum = getVal(row, invNumIdx);
    const paymentDate = parseDate(getVal(row, dateIdx));

    let debtorId: string | null = accountRaid ? raidToDebtorId.get(accountRaid) || null : null;
    let invoiceId: string | null = null;

    if (invoiceNum) {
      const inv = invNumToInvoice.get(invoiceNum);
      if (inv) {
        invoiceId = inv.id;
        if (!debtorId) debtorId = inv.debtor_id;
      }
    }

    if (!debtorId) { skipped++; continue; }

    insertBatch.push({
      record: {
        user_id: userId,
        organization_id: orgId,
        debtor_id: debtorId,
        invoice_id: invoiceId,
        amount,
        currency: (getVal(row, currIdx) || 'USD').toUpperCase(),
        payment_date: paymentDate || new Date().toISOString().split('T')[0],
        reference: getVal(row, refIdx) || null,
        invoice_number_hint: invoiceNum || null,
        reconciliation_status: getVal(row, reconIdx) || 'pending',
        notes: getVal(row, notesIdx) ? `[Sheet] ${getVal(row, notesIdx)}` : '[Sheet Import]',
        source_system: 'google_sheets',
      },
      rowIdx: i,
      invoiceId,
    });
  }

  // BATCH: Insert payments in chunks
  const invoiceUpdates: { id: string; amount: number }[] = [];

  for (let c = 0; c < insertBatch.length; c += CHUNK_SIZE) {
    const chunk = insertBatch.slice(c, c + CHUNK_SIZE);
    const records = chunk.map(item => item.record);
    const { data: inserted, error } = await supabase
      .from('payments')
      .insert(records)
      .select('reference_id');

    if (!error && inserted) {
      created += inserted.length;
      for (let j = 0; j < inserted.length; j++) {
        const rowIdx = chunk[j].rowIdx;
        if (payRefIdx >= 0) sheetUpdates.push({ range: `Payments!${String.fromCharCode(65 + payRefIdx)}${rowIdx + 1}`, values: [[inserted[j].reference_id]] });
        if (sourceIdx >= 0) sheetUpdates.push({ range: `Payments!${String.fromCharCode(65 + sourceIdx)}${rowIdx + 1}`, values: [['recouply']] });
        if (chunk[j].invoiceId) {
          invoiceUpdates.push({ id: chunk[j].invoiceId!, amount: chunk[j].record.amount });
        }
      }
    } else {
      skipped += chunk.length;
      if (error) console.error('Batch payment insert error:', error.message);
    }

    const pct = Math.round(30 + ((c + chunk.length) / Math.max(insertBatch.length, 1)) * 40);
    await updateProgress('syncing', { phase: 'processing', percent: Math.min(pct, 75), direction: 'pull', created, skipped });
  }

  // BATCH: Update invoice outstanding amounts in parallel chunks
  await updateProgress('syncing', { phase: 'processing', percent: 80, direction: 'pull', created, skipped });
  for (let c = 0; c < invoiceUpdates.length; c += CHUNK_SIZE) {
    const chunk = invoiceUpdates.slice(c, c + CHUNK_SIZE);
    await Promise.all(chunk.map(async (upd) => {
      const inv = (allInvoices || []).find((i: any) => i.id === upd.id);
      if (inv) {
        const newOutstanding = Math.max(0, (inv.amount_outstanding || inv.amount) - upd.amount);
        const newStatus = newOutstanding === 0 ? 'Paid' : 'PartiallyPaid';
        await supabase.from('invoices').update({ amount_outstanding: newOutstanding, status: newStatus }).eq('id', upd.id);
      }
    }));
  }

  await batchUpdateSheet(accessToken, template.sheet_id, sheetUpdates);
  return { created, skipped, syncProtected };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

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

    const body = await req.json().catch(() => ({}));
    const { sheetTemplateId, direction } = body;

    if (!sheetTemplateId) {
      return new Response(JSON.stringify({ error: 'sheetTemplateId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!direction || !['push', 'pull'].includes(direction)) {
      return new Response(JSON.stringify({ error: 'direction must be push or pull' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: orgId } = await supabase.rpc('get_user_organization_id', { p_user_id: user.id });

    const { data: connection } = await supabase
      .from('drive_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!connection) {
      return new Response(JSON.stringify({ error: 'No active Google Drive connection. Please connect your own Google Drive first.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: template } = await supabase
      .from('google_sheet_templates')
      .select('*')
      .eq('id', sheetTemplateId)
      .eq('user_id', user.id)
      .single();

    if (!template) {
      return new Response(JSON.stringify({ error: 'Template not found or does not belong to you' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await getValidAccessToken(supabase, connection);
    let result: any = {};

    // Throttled progress updater — max once per 2 seconds to reduce DB writes
    let lastProgressUpdate = 0;
    const updateProgress = async (status: string, progress: Record<string, any>) => {
      const now = Date.now();
      if (now - lastProgressUpdate < 2000 && status === 'syncing') return;
      lastProgressUpdate = now;
      await supabase.from('google_sheet_templates').update({
        sync_status: status,
        sync_progress: { ...progress, updated_at: new Date().toISOString() },
      }).eq('id', template.id);
    };

    try {
      await updateProgress('syncing', { phase: 'starting', percent: 0, direction, templateType: template.template_type });

      if (direction === 'push') {
        await updateProgress('syncing', { phase: 'pushing', percent: 20, direction });
        if (template.template_type === 'accounts') result = await pushAccounts(supabase, accessToken, template, user.id);
        else if (template.template_type === 'invoices') result = await pushInvoices(supabase, accessToken, template, user.id);
        else if (template.template_type === 'payments') result = await pushPayments(supabase, accessToken, template, user.id);

        await supabase.from('google_sheet_templates').update({
          sync_status: 'completed',
          sync_progress: { phase: 'done', percent: 100, direction, ...result, completed_at: new Date().toISOString() },
          last_push_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', template.id);
      } else {
        await updateProgress('syncing', { phase: 'reading_sheet', percent: 10, direction });
        if (template.template_type === 'accounts') result = await pullAccounts(supabase, accessToken, template, user.id, orgId, updateProgress);
        else if (template.template_type === 'invoices') result = await pullInvoices(supabase, accessToken, template, user.id, orgId, updateProgress);
        else if (template.template_type === 'payments') result = await pullPayments(supabase, accessToken, template, user.id, orgId, updateProgress);

        await supabase.from('google_sheet_templates').update({
          sync_status: 'completed',
          sync_progress: { phase: 'done', percent: 100, direction, ...result, completed_at: new Date().toISOString() },
          last_pull_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', template.id);
      }
    } catch (syncError) {
      await supabase.from('google_sheet_templates').update({
        sync_status: 'failed',
        sync_progress: { phase: 'error', percent: 0, direction, error: String(syncError) },
      }).eq('id', template.id);
      throw syncError;
    }

    await supabase.from('ingestion_audit_log').insert({
      user_id: user.id,
      organization_id: orgId,
      event_type: `sheet_sync_${direction}`,
      event_details: { template_id: template.id, template_type: template.template_type, direction, ...result },
    });

    return new Response(JSON.stringify({ success: true, direction, templateType: template.template_type, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('google-sheets-sync error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
