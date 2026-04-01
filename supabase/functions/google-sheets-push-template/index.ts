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

    const body = await req.json();
    const { debtorId, templateType = 'invoice_submission' } = body;

    if (!debtorId) {
      return new Response(JSON.stringify({ error: 'debtorId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

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

    // Get debtor info
    const { data: debtor } = await supabase
      .from('debtors')
      .select('id, company_name, name, email, reference_id')
      .eq('id', debtorId)
      .single();

    if (!debtor) {
      return new Response(JSON.stringify({ error: 'Debtor not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get existing invoices for this debtor
    const { data: invoices } = await supabase
      .from('invoices')
      .select('invoice_number, amount, amount_outstanding, currency, issue_date, due_date, status, po_number, product_description, payment_terms, notes, reference_id')
      .eq('debtor_id', debtorId)
      .eq('user_id', user.id)
      .order('due_date', { ascending: false });

    // Get branding
    const { data: branding } = await supabase
      .from('branding_settings')
      .select('business_name')
      .eq('user_id', user.id)
      .maybeSingle();

    const businessName = branding?.business_name || 'Recouply';
    const debtorName = debtor.company_name || debtor.name || 'Customer';
    const sheetTitle = `${businessName} - ${debtorName} - Invoices`;

    // Build header row and data rows based on template type
    const headers = [
      'Invoice Number', 'Amount', 'Amount Outstanding', 'Currency', 
      'Issue Date', 'Due Date', 'Status', 'PO Number', 
      'Product/Description', 'Payment Terms', 'Notes',
      'Recouply Ref (DO NOT EDIT)', 'Source'
    ];

    const dataRows = (invoices || []).map(inv => [
      inv.invoice_number || '',
      inv.amount || 0,
      inv.amount_outstanding || inv.amount || 0,
      inv.currency || 'USD',
      inv.issue_date || '',
      inv.due_date || '',
      inv.status || 'Open',
      inv.po_number || '',
      inv.product_description || '',
      inv.payment_terms || '',
      inv.notes || '',
      inv.reference_id || '',
      'recouply', // Source marker for existing rows
    ]);

    // Create Google Sheet via Sheets API
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title: sheetTitle },
        sheets: [{
          properties: {
            title: 'Invoices',
            gridProperties: { frozenRowCount: 1 },
          },
          data: [{
            startRow: 0,
            startColumn: 0,
            rowData: [
              // Header row
              {
                values: headers.map(h => ({
                  userEnteredValue: { stringValue: h },
                  userEnteredFormat: {
                    backgroundColor: { red: 0.2, green: 0.4, blue: 0.9, alpha: 1 },
                    textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  },
                })),
              },
              // Data rows
              ...dataRows.map(row => ({
                values: row.map((cell, colIdx) => {
                  // Numbers for amount columns
                  if (colIdx === 1 || colIdx === 2) {
                    return { userEnteredValue: { numberValue: Number(cell) || 0 } };
                  }
                  return { userEnteredValue: { stringValue: String(cell) } };
                }),
              })),
            ],
          }],
        },
        {
          properties: {
            title: 'Instructions',
          },
          data: [{
            startRow: 0,
            startColumn: 0,
            rowData: [
              { values: [{ userEnteredValue: { stringValue: `${businessName} Invoice Template` }, userEnteredFormat: { textFormat: { bold: true, fontSize: 14 } } }] },
              { values: [{ userEnteredValue: { stringValue: '' } }] },
              { values: [{ userEnteredValue: { stringValue: `Customer: ${debtorName}` } }] },
              { values: [{ userEnteredValue: { stringValue: `Ref: ${debtor.reference_id || 'N/A'}` } }] },
              { values: [{ userEnteredValue: { stringValue: '' } }] },
              { values: [{ userEnteredValue: { stringValue: 'HOW TO USE:' }, userEnteredFormat: { textFormat: { bold: true } } }] },
              { values: [{ userEnteredValue: { stringValue: '1. Go to the "Invoices" tab' } }] },
              { values: [{ userEnteredValue: { stringValue: '2. Existing invoices are shown (do not modify the Recouply Ref column)' } }] },
              { values: [{ userEnteredValue: { stringValue: '3. Add NEW invoices by filling in empty rows below existing data' } }] },
              { values: [{ userEnteredValue: { stringValue: '4. Leave the "Source" column empty for new rows — they will be detected automatically' } }] },
              { values: [{ userEnteredValue: { stringValue: '5. Required fields: Invoice Number, Amount, Due Date' } }] },
              { values: [{ userEnteredValue: { stringValue: '' } }] },
              { values: [{ userEnteredValue: { stringValue: 'STATUS VALUES: Open, Paid, Canceled, Disputed, PartiallyPaid' } }] },
              { values: [{ userEnteredValue: { stringValue: 'DATE FORMAT: YYYY-MM-DD (e.g., 2026-04-15)' } }] },
            ],
          }],
        }],
      }),
    });

    const sheetData = await createRes.json();
    if (!createRes.ok) {
      console.error('Sheet creation failed:', sheetData);
      throw new Error(`Failed to create sheet: ${sheetData.error?.message || JSON.stringify(sheetData)}`);
    }

    const spreadsheetId = sheetData.spreadsheetId;
    const spreadsheetUrl = sheetData.spreadsheetUrl;

    // Move sheet to the connected Drive folder if one is set
    if (connection.folder_id) {
      // Get current parents
      const fileRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=parents`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const fileData = await fileRes.json();
      const previousParents = (fileData.parents || []).join(',');

      await fetch(
        `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?addParents=${connection.folder_id}&removeParents=${previousParents}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
    }

    // Get org ID
    const { data: orgId } = await supabase.rpc('get_user_organization_id', { p_user_id: user.id });

    // Save template record
    await supabase.from('google_sheet_templates').insert({
      user_id: user.id,
      organization_id: orgId,
      connection_id: connection.id,
      debtor_id: debtorId,
      template_type: templateType,
      sheet_id: spreadsheetId,
      sheet_url: spreadsheetUrl,
      sheet_name: sheetTitle,
      drive_file_id: spreadsheetId,
      status: 'active',
      rows_synced: dataRows.length,
    });

    // Audit log
    await supabase.from('ingestion_audit_log').insert({
      user_id: user.id,
      organization_id: orgId,
      event_type: 'sheet_template_pushed',
      event_details: {
        debtor_id: debtorId,
        debtor_name: debtorName,
        template_type: templateType,
        sheet_id: spreadsheetId,
        existing_invoices: dataRows.length,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      spreadsheetId,
      spreadsheetUrl,
      sheetTitle,
      existingInvoices: dataRows.length,
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
