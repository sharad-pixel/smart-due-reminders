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

function parseDate(val: string): string | null {
  if (!val || val.trim() === '') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return val.trim();
  const mdyMatch = val.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    return `${mdyMatch[3]}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`;
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

const BATCH_SIZE = 50;

async function processTemplate(
  supabase: any,
  template: any,
  connection: any,
  user: any,
  orgId: string | null
) {
  const accessToken = await getValidAccessToken(supabase, connection);

  // Incremental sync: only read rows after last_synced_row
  const startRow = (template.last_synced_row || 0) + 1;
  const headerRange = `Invoices!A1:M1`;
  const dataRange = `Invoices!A${startRow + 1}:M5000`;

  // Fetch header and data rows in parallel
  const [headerRes, dataRes] = await Promise.all([
    fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${template.sheet_id}/values/${headerRange}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ),
    fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${template.sheet_id}/values/${dataRange}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ),
  ]);

  const [headerData, sheetData] = await Promise.all([headerRes.json(), dataRes.json()]);

  if (!headerRes.ok) throw new Error(`Sheets API error: ${JSON.stringify(headerData)}`);
  if (!dataRes.ok) throw new Error(`Sheets API error: ${JSON.stringify(sheetData)}`);

  const headerRows = headerData.values || [];
  if (headerRows.length === 0) return { sheetName: template.sheet_name, newInvoices: 0, skipped: 0, errors: 0 };

  const headers = headerRows[0].map((h: string) => h.toLowerCase().trim());
  const colIdx = {
    invoiceNumber: headers.indexOf('invoice number'),
    amount: headers.indexOf('amount'),
    amountOutstanding: headers.indexOf('amount outstanding'),
    currency: headers.indexOf('currency'),
    issueDate: headers.indexOf('issue date'),
    dueDate: headers.indexOf('due date'),
    status: headers.indexOf('status'),
    poNumber: headers.indexOf('po number'),
    productDescription: headers.indexOf('product/description'),
    paymentTerms: headers.indexOf('payment terms'),
    notes: headers.indexOf('notes'),
    recouplyRef: headers.indexOf('recouply ref (do not edit)'),
    source: headers.indexOf('source'),
  };

  const dataRows = sheetData.values || [];
  if (dataRows.length === 0) return { sheetName: template.sheet_name, newInvoices: 0, skipped: 0, errors: 0 };

  // Get existing invoice numbers for dedup
  const { data: existingInvoices } = await supabase
    .from('invoices')
    .select('invoice_number, reference_id')
    .eq('debtor_id', template.debtor_id)
    .eq('user_id', user.id);

  const existingNumbers = new Set(
    (existingInvoices || []).map((i: any) => (i.invoice_number || '').toLowerCase().trim())
  );
  const existingRefs = new Set(
    (existingInvoices || []).map((i: any) => (i.reference_id || '').toLowerCase().trim())
  );

  let sheetNewCount = 0;
  let sheetSkipped = 0;
  let sheetErrors = 0;
  const invoiceBatch: any[] = [];
  const batchRowIndices: number[] = []; // track original row indices for write-back

  const getVal = (row: any[], idx: number) => idx >= 0 && idx < row.length ? (row[idx] || '').trim() : '';

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || row.length === 0) continue;

    const source = getVal(row, colIdx.source);
    const recouplyRef = getVal(row, colIdx.recouplyRef);
    const invoiceNumber = getVal(row, colIdx.invoiceNumber);

    if (source.toLowerCase() === 'recouply') { sheetSkipped++; continue; }
    if (recouplyRef && existingRefs.has(recouplyRef.toLowerCase())) { sheetSkipped++; continue; }
    if (!invoiceNumber) continue;
    if (existingNumbers.has(invoiceNumber.toLowerCase())) { sheetSkipped++; continue; }

    const amount = parseFloat(getVal(row, colIdx.amount)) || 0;
    const amountOutstanding = parseFloat(getVal(row, colIdx.amountOutstanding)) || amount;
    const currency = getVal(row, colIdx.currency) || 'USD';
    const issueDate = parseDate(getVal(row, colIdx.issueDate));
    const dueDate = parseDate(getVal(row, colIdx.dueDate));
    const status = getVal(row, colIdx.status) || 'Open';
    const poNumber = getVal(row, colIdx.poNumber);
    const productDescription = getVal(row, colIdx.productDescription);
    const paymentTerms = getVal(row, colIdx.paymentTerms);
    const notes = getVal(row, colIdx.notes);

    if (!dueDate) {
      console.warn(`Row ${startRow + i + 1}: skipping — no valid due date`);
      sheetErrors++;
      continue;
    }

    invoiceBatch.push({
      user_id: user.id,
      organization_id: orgId,
      debtor_id: template.debtor_id,
      invoice_number: invoiceNumber,
      amount,
      amount_original: amount,
      amount_outstanding: amountOutstanding,
      currency: currency.toUpperCase(),
      issue_date: issueDate,
      due_date: dueDate,
      status,
      po_number: poNumber || null,
      product_description: productDescription || null,
      payment_terms: paymentTerms || null,
      notes: notes ? `[Sheet Import] ${notes}` : '[Sheet Import]',
      source_system: 'google_sheets',
    });
    batchRowIndices.push(i);
    existingNumbers.add(invoiceNumber.toLowerCase());
  }

  // Batch insert in chunks of BATCH_SIZE with .select() to get reference_ids back
  const insertedInvoices: any[] = [];
  for (let c = 0; c < invoiceBatch.length; c += BATCH_SIZE) {
    const chunk = invoiceBatch.slice(c, c + BATCH_SIZE);
    const { data: inserted, error: insertErr } = await supabase
      .from('invoices')
      .insert(chunk)
      .select('invoice_number, reference_id');

    if (insertErr) {
      console.error(`Batch insert error:`, insertErr.message);
      sheetErrors += chunk.length;
    } else {
      sheetNewCount += (inserted || []).length;
      insertedInvoices.push(...(inserted || []));
    }
  }

  // Update template with new sync position
  const newLastRow = startRow + dataRows.length;
  await supabase.from('google_sheet_templates').update({
    last_synced_at: new Date().toISOString(),
    rows_synced: (template.rows_synced || 0) + sheetNewCount,
    last_synced_row: newLastRow,
    updated_at: new Date().toISOString(),
  }).eq('id', template.id);

  // Write-back source + ref columns (fire-and-forget style)
  if (insertedInvoices.length > 0 && (colIdx.source >= 0 || colIdx.recouplyRef >= 0)) {
    const refMap = new Map(
      insertedInvoices.map((inv: any) => [
        (inv.invoice_number || '').toLowerCase().trim(),
        inv.reference_id,
      ])
    );

    const updateRequests: any[] = [];
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length === 0) continue;
      const invoiceNum = getVal(row, colIdx.invoiceNumber);
      const source = getVal(row, colIdx.source);
      if (source.toLowerCase() === 'recouply' || !invoiceNum) continue;

      const ref = refMap.get(invoiceNum.toLowerCase().trim());
      if (!ref) continue;

      const sheetRowNum = startRow + i + 1; // actual sheet row number
      if (colIdx.source >= 0) {
        updateRequests.push({
          range: `Invoices!${String.fromCharCode(65 + colIdx.source)}${sheetRowNum}`,
          values: [['recouply']],
        });
      }
      if (colIdx.recouplyRef >= 0) {
        updateRequests.push({
          range: `Invoices!${String.fromCharCode(65 + colIdx.recouplyRef)}${sheetRowNum}`,
          values: [[ref]],
        });
      }
    }

    if (updateRequests.length > 0) {
      // Fire and don't await — write-back is not critical path
      fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${template.sheet_id}/values:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            valueInputOption: 'RAW',
            data: updateRequests,
          }),
        }
      ).catch(err => console.error('Write-back error:', err));
    }
  }

  return {
    sheetName: template.sheet_name,
    debtorName: template.sheet_name,
    newInvoices: sheetNewCount,
    skipped: sheetSkipped,
    errors: sheetErrors,
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
    const { sheetTemplateId } = body;

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: orgId } = await supabase.rpc('get_user_organization_id', { p_user_id: user.id });

    const { data: userConnection } = await supabase
      .from('drive_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!userConnection) {
      return new Response(JSON.stringify({ error: 'No active Google Drive connection. Please connect your own Google Drive first.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let templates: any[] = [];
    if (sheetTemplateId) {
      const { data } = await supabase
        .from('google_sheet_templates')
        .select('*')
        .eq('id', sheetTemplateId)
        .eq('user_id', user.id)
        .single();
      if (data) templates = [data];
    } else {
      const { data } = await supabase
        .from('google_sheet_templates')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active');
      templates = data || [];
    }

    if (templates.length === 0) {
      return new Response(JSON.stringify({ error: 'No active sheet templates found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process all templates in parallel
    const templateResults = await Promise.allSettled(
      templates.map(t => processTemplate(supabase, t, userConnection, user, orgId))
    );

    let totalNewInvoices = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const results: any[] = [];

    for (let i = 0; i < templateResults.length; i++) {
      const result = templateResults[i];
      if (result.status === 'fulfilled') {
        totalNewInvoices += result.value.newInvoices;
        totalSkipped += result.value.skipped;
        totalErrors += result.value.errors || 0;
        results.push(result.value);
      } else {
        console.error(`Error processing template ${templates[i].sheet_name}:`, result.reason);
        totalErrors++;
        results.push({ sheetName: templates[i].sheet_name, error: String(result.reason) });
      }
    }

    // Audit log (fire-and-forget)
    supabase.from('ingestion_audit_log').insert({
      user_id: user.id,
      organization_id: orgId,
      event_type: 'sheets_ingested',
      event_details: {
        templates_scanned: templates.length,
        new_invoices: totalNewInvoices,
        skipped: totalSkipped,
        errors: totalErrors,
      },
    }).then(() => {});

    return new Response(JSON.stringify({
      success: true,
      newInvoices: totalNewInvoices,
      skipped: totalSkipped,
      errors: totalErrors,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('google-sheets-ingest error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
