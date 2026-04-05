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
  const rows = [headers, ...(debtors || []).map((d: any) => [
    d.reference_id || '', d.company_name || '', d.type || 'B2B',
    d.name || '', d.email || '', d.phone || '',
    d.address_line1 || '', d.address_line2 || '', d.city || '', d.state || '',
    d.postal_code || '', d.country || '', d.industry || '',
    d.external_customer_id || '', d.crm_account_id_external || '',
    d.payment_terms_default || '', d.notes || '', d.current_balance || 0,
    d.integration_source || d.source_system || 'recouply',
    d.payment_score ?? '', d.payment_risk_tier || '',
  ])];

  // Clear existing data then write
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${template.sheet_id}/values/Accounts!A:U:clear`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}` },
  });
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${template.sheet_id}/values/Accounts!A1?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows }),
    }
  );

  return { pushed: (debtors || []).length };
}

async function pushInvoices(supabase: any, accessToken: string, template: any, userId: string) {
  const { data: openInvoices } = await supabase
    .from('invoices')
    .select('invoice_number, amount, amount_original, amount_outstanding, currency, issue_date, due_date, paid_date, status, po_number, product_description, payment_terms, notes, reference_id, integration_source, source_system, debtors(reference_id, company_name)')
    .eq('user_id', userId)
    .in('status', ['Open', 'InPaymentPlan', 'PartiallyPaid', 'Disputed'])
    .order('due_date', { ascending: false });

  const { data: paidInvoices } = await supabase
    .from('invoices')
    .select('invoice_number, amount, amount_original, amount_outstanding, currency, issue_date, due_date, paid_date, status, po_number, product_description, payment_terms, notes, reference_id, integration_source, source_system, debtors(reference_id, company_name)')
    .eq('user_id', userId)
    .in('status', ['Paid', 'Canceled', 'Voided', 'Settled', 'FinalInternalCollections'])
    .order('due_date', { ascending: false })
    .limit(1000);

  const headers = [
    'Account RAID', 'Account Name', 'SS Invoice #', 'Original Amount', 'Amount Outstanding',
    'Currency', 'Issue Date', 'Due Date', 'Status', 'PO Number', 'Product/Description',
    'Payment Terms', 'Paid Date', 'Notes', 'Recouply Invoice Ref (DO NOT EDIT)', 'Source'
  ];

  const mapInv = (inv: any) => [
    inv.debtors?.reference_id || '', inv.debtors?.company_name || '',
    inv.invoice_number || '', inv.amount_original || inv.amount || 0,
    inv.amount_outstanding || inv.amount || 0,
    inv.currency || 'USD', inv.issue_date || '', inv.due_date || '', inv.status || '',
    inv.po_number || '', inv.product_description || '', inv.payment_terms || '',
    inv.paid_date || '', inv.notes || '', inv.reference_id || '',
    inv.integration_source || inv.source_system || 'recouply',
  ];

  const openRows = [headers, ...(openInvoices || []).map(mapInv)];
  const paidRows = [headers, ...(paidInvoices || []).map(mapInv)];

  await Promise.all([
    fetch(`https://sheets.googleapis.com/v4/spreadsheets/${template.sheet_id}/values/'Open Invoices'!A:P:clear`, {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch(`https://sheets.googleapis.com/v4/spreadsheets/${template.sheet_id}/values/'Paid Invoices'!A:P:clear`, {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);

  await Promise.all([
    fetch(`https://sheets.googleapis.com/v4/spreadsheets/${template.sheet_id}/values/'Open Invoices'!A1?valueInputOption=RAW`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: openRows }),
    }),
    fetch(`https://sheets.googleapis.com/v4/spreadsheets/${template.sheet_id}/values/'Paid Invoices'!A1?valueInputOption=RAW`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: paidRows }),
    }),
  ]);

  return { openPushed: (openInvoices || []).length, paidPushed: (paidInvoices || []).length };
}

async function pushPayments(supabase: any, accessToken: string, template: any, userId: string) {
  const { data: payments } = await supabase
    .from('payments')
    .select('reference_id, amount, currency, payment_date, reference, reconciliation_status, invoice_number_hint, notes, source_system, debtors(reference_id, company_name)')
    .eq('user_id', userId)
    .order('payment_date', { ascending: false })
    .limit(1000);

  const headers = [
    'Account RAID', 'Account Name', 'SS Invoice #', 'Payment Amount', 'Currency',
    'Payment Date', 'Payment Reference', 'Reconciliation Status',
    'Notes', 'Recouply Payment Ref (DO NOT EDIT)', 'Source'
  ];
  const rows = [headers, ...(payments || []).map((p: any) => [
    p.debtors?.reference_id || '', p.debtors?.company_name || '',
    p.invoice_number_hint || '', p.amount || 0, p.currency || 'USD',
    p.payment_date || '', p.reference || '',
    p.reconciliation_status || 'pending', p.notes || '', p.reference_id || '',
    p.source_system || 'recouply',
  ])];

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${template.sheet_id}/values/Payments!A:K:clear`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}` },
  });
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${template.sheet_id}/values/Payments!A1?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: rows }),
  });

  return { pushed: (payments || []).length };
}

async function pullAccounts(supabase: any, accessToken: string, template: any, userId: string, orgId: string) {
  const rows = await readSheet(accessToken, template.sheet_id, 'Accounts!A1:S5000');
  if (rows.length <= 1) return { created: 0, updated: 0, skipped: 0, syncProtected: 0 };

  const headers = rows[0].map((h: string) => h.toLowerCase().trim());
  const raidIdx = headers.indexOf('raid');
  const companyIdx = headers.indexOf('company name');
  const typeIdx = headers.indexOf('type (b2b/b2c)');
  const nameIdx = headers.findIndex(h => h === 'contact name' || h === 'name');
  const emailIdx = headers.findIndex(h => h === 'contact email' || h === 'email');
  const phoneIdx = headers.findIndex(h => h === 'contact phone' || h === 'phone');
  const addr1Idx = headers.indexOf('address line 1');
  const addr2Idx = headers.indexOf('address line 2');
  const cityIdx = headers.indexOf('city');
  const stateIdx = headers.indexOf('state');
  const postalIdx = headers.findIndex(h => h === 'postal code' || h === 'zip' || h === 'zip code');
  const countryIdx = headers.indexOf('country');
  const industryIdx = headers.indexOf('industry');
  const extCustIdx = headers.findIndex(h => h === 'source system id' || h === 'external customer id');
  const crmIdx = headers.indexOf('crm id');
  const payTermsIdx = headers.indexOf('default payment terms');
  const notesIdx = headers.indexOf('notes');
  const sourceIdx = headers.indexOf('source');

  let created = 0, updated = 0, skipped = 0, syncProtected = 0;
  const sheetUpdates: any[] = [];

  const colLetter = (idx: number) => {
    let letter = '';
    let n = idx;
    while (n >= 0) { letter = String.fromCharCode(65 + (n % 26)) + letter; n = Math.floor(n / 26) - 1; }
    return letter;
  };

  // PROTECTION: Pre-load sync-enabled status for all accounts to enforce per-account control
  const { data: syncProtectedAccounts } = await supabase
    .from('debtors')
    .select('reference_id')
    .eq('user_id', userId)
    .eq('sheet_sync_enabled', false);
  const protectedRaids = new Set((syncProtectedAccounts || []).map((d: any) => d.reference_id));

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const raid = getVal(row, raidIdx);
    const companyName = getVal(row, companyIdx);
    const contactName = getVal(row, nameIdx);
    const email = getVal(row, emailIdx);
    const source = getVal(row, sourceIdx);

    if (!companyName && !contactName) continue;

    // PROTECTION: Skip sync-protected accounts
    if (raid && protectedRaids.has(raid)) {
      syncProtected++;
      continue;
    }

    // Build field data from row
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

    // PROTECTION: Update existing records via RAID match — never delete
    if (raid) {
      const { data: existingDebtor, error } = await supabase
        .from('debtors')
        .update(fieldData)
        .eq('reference_id', raid)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle();

      if (!error && existingDebtor) {
        updated++;

        // Also update or create the primary contact record if contact fields changed
        const contactName = fieldData.name || fieldData.company_name;
        const contactEmail = fieldData.email;
        const contactPhone = fieldData.phone;

        if (contactName || contactEmail || contactPhone) {
          const contactUpdate: any = { updated_at: new Date().toISOString() };
          if (contactName) contactUpdate.name = contactName;
          if (contactEmail) contactUpdate.email = contactEmail;
          if (contactPhone) contactUpdate.phone = contactPhone;

          // Try to update existing primary contact first
          const { data: updatedContact } = await supabase
            .from('debtor_contacts')
            .update(contactUpdate)
            .eq('debtor_id', existingDebtor.id)
            .eq('is_primary', true)
            .select('id')
            .maybeSingle();

          // If no primary contact exists, create one
          if (!updatedContact && contactName) {
            await supabase.from('debtor_contacts').insert({
              debtor_id: existingDebtor.id,
              user_id: userId,
              organization_id: orgId || null,
              name: contactName,
              email: contactEmail || null,
              phone: contactPhone || null,
              is_primary: true,
              source: 'google_sheets',
            });
          }
        }
      } else {
        if (error) console.error(`Row ${i + 1} RAID update error:`, error.message);
        skipped++;
      }
    } else {
      // Stage new account for user review instead of creating directly
      // Use raw SQL via RPC to avoid PostgREST schema cache issues with new tables
      const stagingPayload = {
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
      };

      console.log(`[PULL] Staging new account row ${i + 1}: ${fieldData.company_name || 'unknown'}`);

      const { error } = await supabase
        .from('pending_sheet_imports')
        .insert(stagingPayload);

      if (!error) {
        created++;
        console.log(`[PULL] Successfully staged row ${i + 1}`);
      } else {
        console.error(`[PULL] Row ${i + 1} staging error:`, JSON.stringify(error));
        skipped++;
      }
    }
  }

  // PROTECTION: Pull NEVER deletes records — missing rows in the sheet are simply ignored
  await batchUpdateSheet(accessToken, template.sheet_id, sheetUpdates);
  return { created, updated, skipped, syncProtected };
}

async function pullInvoices(supabase: any, accessToken: string, template: any, userId: string, orgId: string) {
  const rows = await readSheet(accessToken, template.sheet_id, "'Open Invoices'!A1:P5000");
  if (rows.length <= 1) return { created: 0, updated: 0, skipped: 0, movedToPaid: 0, syncProtected: 0 };

  const headers = rows[0].map((h: string) => h.toLowerCase().trim());
  const accountRaidIdx = headers.indexOf('account raid');
  const invNumIdx = headers.findIndex(h => h === 'ss invoice #' || h === 'invoice number');
  const amountIdx = headers.findIndex(h => h === 'original amount' || h === 'amount');
  const amtOutIdx = headers.indexOf('amount outstanding');
  const currIdx = headers.indexOf('currency');
  const issueDateIdx = headers.indexOf('issue date');
  const dueDateIdx = headers.indexOf('due date');
  const statusIdx = headers.indexOf('status');
  const poIdx = headers.indexOf('po number');
  const descIdx = headers.indexOf('product/description');
  const termsIdx = headers.indexOf('payment terms');
  const notesIdx = headers.indexOf('notes');
  const refIdx = headers.findIndex(h => h.includes('recouply') && h.includes('ref') && h.includes('do not edit'));
  const sourceIdx = headers.indexOf('source');

  let created = 0, updated = 0, skipped = 0, movedToPaid = 0, syncProtected = 0;
  const sheetUpdates: any[] = [];
  const rowsToMoveToPaid: number[] = [];

  // PROTECTION: Pre-load sync-protected accounts
  const { data: syncProtectedAccounts } = await supabase
    .from('debtors')
    .select('reference_id')
    .eq('user_id', userId)
    .eq('sheet_sync_enabled', false);
  const protectedRaids = new Set((syncProtectedAccounts || []).map((d: any) => d.reference_id));

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const recouplyRef = getVal(row, refIdx);
    const source = getVal(row, sourceIdx);
    const invoiceNumber = getVal(row, invNumIdx);
    const accountRaid = getVal(row, accountRaidIdx);
    const status = getVal(row, statusIdx);

    if (!invoiceNumber) continue;

    // PROTECTION: Skip invoices belonging to sync-protected accounts
    if (accountRaid && protectedRaids.has(accountRaid)) {
      syncProtected++;
      continue;
    }

    const terminalStatuses = ['paid', 'canceled', 'voided', 'writtenoff', 'settled', 'credited'];
    const isTerminal = terminalStatuses.includes(status.toLowerCase());

    // PROTECTION: Updates only via RAID/reference match — never delete invoice records
    if (recouplyRef && source.toLowerCase() === 'recouply') {
      const updateData: any = {};
      const amtOut = parseFloat(getVal(row, amtOutIdx));
      if (!isNaN(amtOut)) updateData.amount_outstanding = amtOut;
      if (status) updateData.status = status;

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('reference_id', recouplyRef)
        .eq('user_id', userId);

      if (!error) {
        updated++;
        if (isTerminal) rowsToMoveToPaid.push(i);
      } else skipped++;
    } else if (!recouplyRef || source.toLowerCase() !== 'recouply') {
      let debtorId: string | null = null;
      if (accountRaid) {
        const { data: debtor } = await supabase
          .from('debtors')
          .select('id')
          .eq('reference_id', accountRaid)
          .eq('user_id', userId)
          .maybeSingle();
        debtorId = debtor?.id || null;
      }

      if (!debtorId) {
        skipped++;
        continue;
      }

      const amount = parseFloat(getVal(row, amountIdx)) || 0;
      const dueDate = parseDate(getVal(row, dueDateIdx));
      if (!dueDate) { skipped++; continue; }

      const { data: newInv, error } = await supabase
        .from('invoices')
        .insert({
          user_id: userId,
          organization_id: orgId,
          debtor_id: debtorId,
          invoice_number: invoiceNumber,
          amount,
          amount_original: amount,
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
        })
        .select('reference_id')
        .single();

      if (!error && newInv) {
        created++;
        if (refIdx >= 0) sheetUpdates.push({ range: `'Open Invoices'!${String.fromCharCode(65 + refIdx)}${i + 1}`, values: [[newInv.reference_id]] });
        if (sourceIdx >= 0) sheetUpdates.push({ range: `'Open Invoices'!${String.fromCharCode(65 + sourceIdx)}${i + 1}`, values: [['recouply']] });
        if (isTerminal) rowsToMoveToPaid.push(i);
      } else skipped++;
    }
  }

  // PROTECTION: Pull NEVER deletes invoice records — missing rows are ignored
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
      range: `'Open Invoices'!A${ri + 1}:P${ri + 1}`,
      values: [Array(16).fill('')],
    }));
    await batchUpdateSheet(accessToken, template.sheet_id, clearUpdates);
  }

  return { created, updated, skipped, movedToPaid, syncProtected };
}

async function pullPayments(supabase: any, accessToken: string, template: any, userId: string, orgId: string) {
  const rows = await readSheet(accessToken, template.sheet_id, 'Payments!A1:K5000');
  if (rows.length <= 1) return { created: 0, skipped: 0, syncProtected: 0 };

  const headers = rows[0].map((h: string) => h.toLowerCase().trim());
  const accountRaidIdx = headers.indexOf('account raid');
  const invNumIdx = headers.findIndex(h => h === 'ss invoice #' || h === 'invoice number' || h === 'invoice ref');
  const amountIdx = headers.indexOf('payment amount');
  const currIdx = headers.indexOf('currency');
  const dateIdx = headers.indexOf('payment date');
  const refIdx = headers.indexOf('payment reference');
  const reconIdx = headers.findIndex(h => h === 'reconciliation status' || h === 'status');
  const notesIdx = headers.indexOf('notes');
  const payRefIdx = headers.findIndex(h => h.includes('recouply') && h.includes('ref') && h.includes('do not edit'));
  const sourceIdx = headers.indexOf('source');

  let created = 0, skipped = 0, syncProtected = 0;
  const sheetUpdates: any[] = [];

  // PROTECTION: Pre-load sync-protected accounts
  const { data: syncProtectedAccounts } = await supabase
    .from('debtors')
    .select('reference_id')
    .eq('user_id', userId)
    .eq('sheet_sync_enabled', false);
  const protectedRaids = new Set((syncProtectedAccounts || []).map((d: any) => d.reference_id));

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const payRef = getVal(row, payRefIdx);
    const source = getVal(row, sourceIdx);
    const accountRaid = getVal(row, accountRaidIdx);

    // PROTECTION: Skip payments for sync-protected accounts
    if (accountRaid && protectedRaids.has(accountRaid)) {
      syncProtected++;
      continue;
    }

    // PROTECTION: Existing payments are never deleted or overwritten — skip if already synced
    if (payRef && source.toLowerCase() === 'recouply') { skipped++; continue; }

    const amount = parseFloat(getVal(row, amountIdx));
    if (!amount || isNaN(amount)) continue;

    const invoiceNum = getVal(row, invNumIdx);
    const paymentDate = parseDate(getVal(row, dateIdx));

    let debtorId: string | null = null;
    let invoiceId: string | null = null;

    if (accountRaid) {
      const { data: debtor } = await supabase.from('debtors').select('id').eq('reference_id', accountRaid).eq('user_id', userId).maybeSingle();
      debtorId = debtor?.id || null;
    }
    if (invoiceNum) {
      const { data: inv } = await supabase.from('invoices').select('id, debtor_id').eq('invoice_number', invoiceNum).eq('user_id', userId).maybeSingle();
      if (inv) {
        invoiceId = inv.id;
        if (!debtorId) debtorId = inv.debtor_id;
      }
    }

    if (!debtorId) { skipped++; continue; }

    const { data: newPay, error } = await supabase
      .from('payments')
      .insert({
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
      })
      .select('reference_id')
      .single();

    if (!error && newPay) {
      created++;
      if (payRefIdx >= 0) sheetUpdates.push({ range: `Payments!${String.fromCharCode(65 + payRefIdx)}${i + 1}`, values: [[newPay.reference_id]] });
      if (sourceIdx >= 0) sheetUpdates.push({ range: `Payments!${String.fromCharCode(65 + sourceIdx)}${i + 1}`, values: [['recouply']] });

      if (invoiceId) {
        const { data: inv } = await supabase.from('invoices').select('amount_outstanding, amount').eq('id', invoiceId).single();
        if (inv) {
          const newOutstanding = Math.max(0, (inv.amount_outstanding || inv.amount) - amount);
          const newStatus = newOutstanding === 0 ? 'Paid' : 'PartiallyPaid';
          await supabase.from('invoices').update({ amount_outstanding: newOutstanding, status: newStatus }).eq('id', invoiceId);
        }
      }
    } else skipped++;
  }

  // PROTECTION: Pull NEVER deletes payment records — missing rows are ignored
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

    // Always use the CURRENT user's drive connection, not the template creator's
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

    if (direction === 'push') {
      if (template.template_type === 'accounts') result = await pushAccounts(supabase, accessToken, template, user.id);
      else if (template.template_type === 'invoices') result = await pushInvoices(supabase, accessToken, template, user.id);
      else if (template.template_type === 'payments') result = await pushPayments(supabase, accessToken, template, user.id);

      await supabase.from('google_sheet_templates').update({
        last_push_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', template.id);
    } else {
      if (template.template_type === 'accounts') result = await pullAccounts(supabase, accessToken, template, user.id, orgId);
      else if (template.template_type === 'invoices') result = await pullInvoices(supabase, accessToken, template, user.id, orgId);
      else if (template.template_type === 'payments') result = await pullPayments(supabase, accessToken, template, user.id, orgId);

      await supabase.from('google_sheet_templates').update({
        last_pull_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', template.id);
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
