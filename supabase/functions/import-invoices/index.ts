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
  customer_id?: string;
  amount: number;
  currency: string;
  issue_date?: string;
  due_date: string;
  status: string;
  source_system?: string;
  product_description?: string;
  notes?: string;
}

// Retry helper with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 200): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt === maxRetries) throw err;
      // Only retry on transient errors (timeouts, rate limits, connection issues)
      const code = err?.code || '';
      const status = err?.status || 0;
      const isTransient = status === 429 || status >= 500 || code === '40001' || code === 'PGRST301' || err.message?.includes('timeout');
      if (!isTransient) throw err;
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Retry exhausted');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) throw new Error('Unauthorized');

    const { job_id, rows, mode, is_final_batch } = await req.json();
    if (!job_id || !rows || !mode) throw new Error('Missing required fields: job_id, rows, mode');

    const totalRows = rows.length;
    console.log(`Processing import job ${job_id}: ${totalRows} rows in ${mode} mode`);

    let successCount = 0;
    let errorCount = 0;
    const SERVER_BATCH_SIZE = 50; // Smaller server batches for memory efficiency
    const PROGRESS_INTERVAL = 100; // Update progress every N rows

    // Cache debtor lookups to avoid repeated queries for same customer
    const debtorCache = new Map<string, string>();

    // Update job to running
    await supabase
      .from('invoice_import_jobs')
      .update({ status: 'RUNNING' })
      .eq('id', job_id);

    for (let i = 0; i < totalRows; i += SERVER_BATCH_SIZE) {
      const batch = rows.slice(i, i + SERVER_BATCH_SIZE);

      for (let j = 0; j < batch.length; j++) {
        const row: ImportRow = batch[j];
        const rowNumber = i + j + 2;

        try {
          // --- Find or create debtor (with cache) ---
          const cacheKey = row.customer_id || row.customer_name || row.customer_email || '';
          let debtorId = debtorCache.get(cacheKey) || null;

          if (!debtorId && row.customer_id) {
            const { data: existing } = await withRetry(() =>
              supabase.from('debtors').select('id').eq('user_id', user.id).eq('external_customer_id', row.customer_id!).single()
            );
            if (existing) debtorId = existing.id;
          }

          if (!debtorId && row.customer_name) {
            const { data: existing } = await withRetry(() =>
              supabase.from('debtors').select('id').eq('user_id', user.id).ilike('company_name', row.customer_name!).single()
            );
            if (existing) debtorId = existing.id;
          }

          if (!debtorId) {
            const newRaid = `RAID-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
            const { data: newDebtor, error: debtorError } = await withRetry(() =>
              supabase.from('debtors').insert({
                user_id: user.id,
                name: row.customer_name || 'Unknown Customer',
                company_name: row.customer_name || 'Unknown Company',
                email: row.customer_email || `unknown-${Date.now()}-${Math.random().toString(36).substring(7)}@placeholder.com`,
                external_customer_id: row.customer_id || null,
                external_system: row.source_system || 'csv_upload',
                integration_source: 'csv_upload',
                reference_id: newRaid,
              }).select('id').single()
            );
            if (debtorError) throw debtorError;
            debtorId = newDebtor.id;

            // Create contact entry (non-blocking)
            if (row.customer_email) {
              supabase.from('debtor_contacts').insert({
                debtor_id: debtorId,
                user_id: user.id,
                name: row.customer_name || 'Unknown',
                email: row.customer_email,
                is_primary: true,
                outreach_enabled: true,
              }).then(() => {});
            }
          }

          // Cache the debtor for subsequent rows with same customer
          if (cacheKey) debtorCache.set(cacheKey, debtorId!);

          // --- Upsert invoice ---
          const invoiceData: any = {
            user_id: user.id,
            debtor_id: debtorId,
            external_invoice_id: row.external_invoice_id,
            invoice_number: row.invoice_number || row.external_invoice_id,
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
            const { data: existing } = await withRetry(() =>
              supabase.from('invoices').select('id').eq('user_id', user.id).eq('external_invoice_id', row.external_invoice_id).single()
            );

            if (existing) {
              await withRetry(() =>
                supabase.from('invoices').update(invoiceData).eq('id', existing.id).then(r => { if (r.error) throw r.error; return r; })
              );
            } else {
              const { data: newInvoice, error: insertError } = await withRetry(() =>
                supabase.from('invoices').insert(invoiceData).select('id').single()
              );
              if (insertError) throw insertError;
              createdInvoiceId = newInvoice?.id;
              isNewInvoice = true;
            }
          } else {
            const { data: newInvoice, error: insertError } = await withRetry(() =>
              supabase.from('invoices').insert(invoiceData).select('id').single()
            );
            if (insertError) {
              if (insertError.code === '23505') {
                throw new Error(`Duplicate invoice ID: ${row.external_invoice_id}`);
              }
              throw insertError;
            }
            createdInvoiceId = newInvoice?.id;
            isNewInvoice = true;
          }

          // Track usage (non-blocking)
          if (isNewInvoice && createdInvoiceId) {
            supabase.functions.invoke('track-invoice-usage', {
              body: { invoice_id: createdInvoiceId },
            }).catch(e => console.log('Usage tracking (non-blocking):', e?.message));
          }

          successCount++;
        } catch (error: any) {
          console.error(`Row ${rowNumber} error:`, error?.message);
          errorCount++;

          // Log error (non-blocking for performance)
          supabase.from('invoice_import_errors').insert({
            import_job_id: job_id,
            row_number: rowNumber,
            raw_row_json: row,
            error_message: error.message || 'Unknown error',
          }).then(() => {});
        }
      }

      // Update progress periodically
      const processed = Math.min(i + SERVER_BATCH_SIZE, totalRows);
      if (processed % PROGRESS_INTERVAL < SERVER_BATCH_SIZE || processed >= totalRows) {
        await supabase
          .from('invoice_import_jobs')
          .update({
            success_count: successCount,
            error_count: errorCount,
          })
          .eq('id', job_id);
      }
    }

    // Update job progress (and mark completed only on final batch)
    const updatePayload: any = {
      success_count: successCount,
      error_count: errorCount,
    };

    if (is_final_batch) {
      updatePayload.status = 'COMPLETED';
      updatePayload.completed_at = new Date().toISOString();
    }

    await supabase
      .from('invoice_import_jobs')
      .update(updatePayload)
      .eq('id', job_id);

    console.log(`Import complete: ${successCount} success, ${errorCount} errors out of ${totalRows}`);

    return new Response(
      JSON.stringify({ success: true, success_count: successCount, error_count: errorCount, total: totalRows }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
