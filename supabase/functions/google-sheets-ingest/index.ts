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
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return val.trim();
  // Try MM/DD/YYYY
  const mdyMatch = val.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    return `${mdyMatch[3]}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`;
  }
  // Try Date.parse as fallback
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return null;
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

    // Get org ID
    const { data: orgId } = await supabase.rpc('get_user_organization_id', { p_user_id: user.id });

    // Always use the current user's drive connection
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

    // If specific template, scan that one; otherwise scan all active templates for this user
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

    let totalNewInvoices = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const results: any[] = [];

    for (const template of templates) {
      const connection = template.drive_connections;
      if (!connection || !connection.is_active) continue;

      try {
        const accessToken = await getValidAccessToken(supabase, connection);

        // Read the "Invoices" sheet
        const sheetRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${template.sheet_id}/values/Invoices!A1:M1000`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const sheetData = await sheetRes.json();
        if (!sheetRes.ok) {
          throw new Error(`Sheets API error: ${JSON.stringify(sheetData)}`);
        }

        const rows = sheetData.values || [];
        if (rows.length <= 1) {
          results.push({ sheetName: template.sheet_name, newInvoices: 0, skipped: 0 });
          continue;
        }

        // Header row mapping (case-insensitive)
        const headers = rows[0].map((h: string) => h.toLowerCase().trim());
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

        // Get existing invoice numbers for this debtor to prevent duplicates
        const { data: existingInvoices } = await supabase
          .from('invoices')
          .select('invoice_number, reference_id')
          .eq('debtor_id', template.debtor_id)
          .eq('user_id', user.id);

        const existingNumbers = new Set(
          (existingInvoices || []).map(i => (i.invoice_number || '').toLowerCase().trim())
        );
        const existingRefs = new Set(
          (existingInvoices || []).map(i => (i.reference_id || '').toLowerCase().trim())
        );

        let sheetNewCount = 0;
        let sheetSkipped = 0;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const getVal = (idx: number) => idx >= 0 && idx < row.length ? (row[idx] || '').trim() : '';

          const source = getVal(colIdx.source);
          const recouplyRef = getVal(colIdx.recouplyRef);
          const invoiceNumber = getVal(colIdx.invoiceNumber);

          // Skip rows that came from Recouply (have source='recouply' or have an existing ref)
          if (source.toLowerCase() === 'recouply') {
            sheetSkipped++;
            continue;
          }

          // Skip if this ref already exists
          if (recouplyRef && existingRefs.has(recouplyRef.toLowerCase())) {
            sheetSkipped++;
            continue;
          }

          // Skip empty rows (no invoice number)
          if (!invoiceNumber) continue;

          // Skip if invoice number already exists for this debtor
          if (existingNumbers.has(invoiceNumber.toLowerCase())) {
            sheetSkipped++;
            continue;
          }

          // Parse the new invoice row
          const amount = parseFloat(getVal(colIdx.amount)) || 0;
          const amountOutstanding = parseFloat(getVal(colIdx.amountOutstanding)) || amount;
          const currency = getVal(colIdx.currency) || 'USD';
          const issueDate = parseDate(getVal(colIdx.issueDate));
          const dueDate = parseDate(getVal(colIdx.dueDate));
          const status = getVal(colIdx.status) || 'Open';
          const poNumber = getVal(colIdx.poNumber);
          const productDescription = getVal(colIdx.productDescription);
          const paymentTerms = getVal(colIdx.paymentTerms);
          const notes = getVal(colIdx.notes);

          if (!dueDate) {
            console.warn(`Row ${i + 1}: skipping — no valid due date`);
            totalErrors++;
            continue;
          }

          // Insert new invoice
          const { error: insertErr } = await supabase.from('invoices').insert({
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

          if (insertErr) {
            console.error(`Row ${i + 1} insert error:`, insertErr.message);
            totalErrors++;
          } else {
            sheetNewCount++;
            // Add to set so we don't dupe within same scan
            existingNumbers.add(invoiceNumber.toLowerCase());
          }
        }

        // Update template record
        await supabase.from('google_sheet_templates').update({
          last_synced_at: new Date().toISOString(),
          rows_synced: (template.rows_synced || 0) + sheetNewCount,
          updated_at: new Date().toISOString(),
        }).eq('id', template.id);

        // Write back Recouply refs and source markers for newly imported rows
        // (This stamps newly imported rows so they won't be re-imported)
        if (sheetNewCount > 0) {
          // Re-read to get the updated refs
          const { data: updatedInvoices } = await supabase
            .from('invoices')
            .select('invoice_number, reference_id')
            .eq('debtor_id', template.debtor_id)
            .eq('user_id', user.id)
            .eq('source_system', 'google_sheets')
            .order('created_at', { ascending: false })
            .limit(sheetNewCount);

          if (updatedInvoices && updatedInvoices.length > 0) {
            const refMap = new Map(updatedInvoices.map(inv => [
              (inv.invoice_number || '').toLowerCase().trim(),
              inv.reference_id,
            ]));

            // Build batch update for the sheet
            const updateRequests: any[] = [];
            for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              if (!row || row.length === 0) continue;
              const getVal = (idx: number) => idx >= 0 && idx < row.length ? (row[idx] || '').trim() : '';
              const source = getVal(colIdx.source);
              const invoiceNum = getVal(colIdx.invoiceNumber);

              if (source.toLowerCase() !== 'recouply' && invoiceNum) {
                const ref = refMap.get(invoiceNum.toLowerCase().trim());
                if (ref) {
                  // Update source column
                  if (colIdx.source >= 0) {
                    updateRequests.push({
                      range: `Invoices!${String.fromCharCode(65 + colIdx.source)}${i + 1}`,
                      values: [['recouply']],
                    });
                  }
                  // Update ref column
                  if (colIdx.recouplyRef >= 0) {
                    updateRequests.push({
                      range: `Invoices!${String.fromCharCode(65 + colIdx.recouplyRef)}${i + 1}`,
                      values: [[ref]],
                    });
                  }
                }
              }
            }

            if (updateRequests.length > 0) {
              await fetch(
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
              );
            }
          }
        }

        totalNewInvoices += sheetNewCount;
        totalSkipped += sheetSkipped;
        results.push({
          sheetName: template.sheet_name,
          debtorName: template.sheet_name,
          newInvoices: sheetNewCount,
          skipped: sheetSkipped,
        });
      } catch (err) {
        console.error(`Error processing sheet ${template.sheet_name}:`, err);
        totalErrors++;
        results.push({ sheetName: template.sheet_name, error: String(err) });
      }
    }

    // Audit log
    await supabase.from('ingestion_audit_log').insert({
      user_id: user.id,
      organization_id: orgId,
      event_type: 'sheets_ingested',
      event_details: {
        templates_scanned: templates.length,
        new_invoices: totalNewInvoices,
        skipped: totalSkipped,
        errors: totalErrors,
      },
    });

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
