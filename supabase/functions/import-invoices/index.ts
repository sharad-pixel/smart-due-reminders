import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportRow {
  external_invoice_id: string;
  invoice_number?: string;
  customer_name?: string;
  customer_email?: string;
  amount: number;
  currency: string;
  issue_date?: string;
  due_date: string;
  status: string;
  source_system?: string;
  product_description?: string;
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { job_id, rows, mode } = await req.json();

    if (!job_id || !rows || !mode) {
      throw new Error('Missing required fields: job_id, rows, mode');
    }

    console.log(`Processing import job ${job_id} with ${rows.length} rows in ${mode} mode`);

    let successCount = 0;
    let errorCount = 0;
    const BATCH_SIZE = 100;

    // Process in batches
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      
      for (let j = 0; j < batch.length; j++) {
        const row: ImportRow = batch[j];
        const rowNumber = i + j + 2; // +2 for header row and 0-indexing

        try {
          // Find or create debtor
          let debtorId: string | null = null;

          if (row.customer_email) {
            const { data: existingDebtor } = await supabase
              .from('debtors')
              .select('id')
              .eq('user_id', user.id)
              .eq('email', row.customer_email)
              .single();

            if (existingDebtor) {
              debtorId = existingDebtor.id;
            }
          }

          // If no debtor found by email, try by name
          if (!debtorId && row.customer_name) {
            const { data: existingDebtor } = await supabase
              .from('debtors')
              .select('id')
              .eq('user_id', user.id)
              .ilike('name', row.customer_name)
              .single();

            if (existingDebtor) {
              debtorId = existingDebtor.id;
            }
          }

          // Create debtor if not found
          if (!debtorId) {
            const { data: newDebtor, error: debtorError } = await supabase
              .from('debtors')
              .insert({
                user_id: user.id,
                name: row.customer_name || 'Unknown Customer',
                company_name: row.customer_name || 'Unknown Company',
                email: row.customer_email || `unknown-${Date.now()}@placeholder.com`,
                reference_id: `RCPLY-${Math.random().toString(36).substring(7).toUpperCase()}`,
              })
              .select('id')
              .single();

            if (debtorError) throw debtorError;
            debtorId = newDebtor.id;
            
            // Create contact entry
            if (row.customer_email) {
              await supabase
                .from('debtor_contacts')
                .insert({
                  debtor_id: debtorId,
                  user_id: user.id,
                  name: row.customer_name || 'Unknown',
                  email: row.customer_email,
                  is_primary: true,
                  outreach_enabled: true
                });
            }
          }

          // Prepare invoice data
          const invoiceData: any = {
            user_id: user.id,
            debtor_id: debtorId,
            external_invoice_id: row.external_invoice_id,
            invoice_number: row.invoice_number || row.external_invoice_id, // Use provided internal invoice # or fall back to external ID
            amount: parseFloat(row.amount.toString()),
            currency: row.currency || 'USD',
            issue_date: row.issue_date || new Date().toISOString().split('T')[0],
            due_date: row.due_date,
            status: row.status,
            source_system: row.source_system || 'CSV Import',
            product_description: row.product_description || null,
            notes: row.notes || null,
            reference_id: `INV-${Math.random().toString(36).substring(7).toUpperCase()}`,
          };

          let createdInvoiceId: string | null = null;
          let isNewInvoice = false;

          if (mode === 'UPSERT_BY_EXTERNAL_INVOICE_ID') {
            // Try to find existing invoice
            const { data: existing } = await supabase
              .from('invoices')
              .select('id')
              .eq('user_id', user.id)
              .eq('external_invoice_id', row.external_invoice_id)
              .single();

            if (existing) {
              // Update existing
              const { error: updateError } = await supabase
                .from('invoices')
                .update(invoiceData)
                .eq('id', existing.id);

              if (updateError) throw updateError;
            } else {
              // Insert new
              const { data: newInvoice, error: insertError } = await supabase
                .from('invoices')
                .insert(invoiceData)
                .select('id')
                .single();

              if (insertError) throw insertError;
              createdInvoiceId = newInvoice?.id;
              isNewInvoice = true;
            }
          } else {
            // INSERT_ONLY mode
            const { data: newInvoice, error: insertError } = await supabase
              .from('invoices')
              .insert(invoiceData)
              .select('id')
              .single();

            if (insertError) {
              if (insertError.code === '23505') { // Unique constraint violation
                throw new Error(`Duplicate invoice ID: ${row.external_invoice_id}`);
              }
              throw insertError;
            }
            createdInvoiceId = newInvoice?.id;
            isNewInvoice = true;
          }

          // Track invoice usage for new invoices
          if (isNewInvoice && createdInvoiceId) {
            try {
              await supabase.functions.invoke('track-invoice-usage', {
                body: { invoice_id: createdInvoiceId }
              });
            } catch (usageError: any) {
              console.log(`Usage tracking error (non-blocking):`, usageError?.message);
            }
          }

          successCount++;
        } catch (error: any) {
          console.error(`Error processing row ${rowNumber}:`, error);
          errorCount++;

          // Log error
          await supabase.from('invoice_import_errors').insert({
            import_job_id: job_id,
            row_number: rowNumber,
            raw_row_json: row,
            error_message: error.message || 'Unknown error',
          });
        }
      }
    }

    // Update job status
    await supabase
      .from('invoice_import_jobs')
      .update({
        status: 'COMPLETED',
        success_count: successCount,
        error_count: errorCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job_id);

    console.log(`Import complete: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        success_count: successCount,
        error_count: errorCount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
