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

    // Update job to running
    await supabase
      .from('invoice_import_jobs')
      .update({ status: 'RUNNING' })
      .eq('id', job_id);

    // --- Phase 1: Bulk resolve debtors ---
    const customerNames = [...new Set(rows.map((r: ImportRow) => r.customer_name).filter(Boolean))] as string[];
    const customerIds = [...new Set(rows.map((r: ImportRow) => r.customer_id).filter(Boolean))] as string[];

    // Fetch existing debtors in bulk
    const debtorCache = new Map<string, string>();

    if (customerIds.length > 0) {
      const { data: byExtId } = await supabase
        .from('debtors')
        .select('id, external_customer_id')
        .eq('user_id', user.id)
        .in('external_customer_id', customerIds);
      byExtId?.forEach(d => { if (d.external_customer_id) debtorCache.set(d.external_customer_id, d.id); });
    }

    if (customerNames.length > 0) {
      // Fetch in chunks of 50 to avoid query size limits
      for (let i = 0; i < customerNames.length; i += 50) {
        const chunk = customerNames.slice(i, i + 50);
        const { data: byName } = await supabase
          .from('debtors')
          .select('id, company_name')
          .eq('user_id', user.id)
          .in('company_name', chunk);
        byName?.forEach(d => { if (d.company_name) debtorCache.set(d.company_name.toLowerCase(), d.id); });
      }
    }

    // Create missing debtors in bulk
    const missingCustomers = new Map<string, ImportRow>();
    for (const row of rows as ImportRow[]) {
      const key = row.customer_id || (row.customer_name?.toLowerCase()) || '';
      if (!key || debtorCache.has(key) || debtorCache.has(row.customer_id || '')) continue;
      // Also check by name for customer_id rows
      if (row.customer_name && debtorCache.has(row.customer_name.toLowerCase())) continue;
      missingCustomers.set(key, row);
    }

    if (missingCustomers.size > 0) {
      const newDebtors = [...missingCustomers.entries()].map(([_, row]) => ({
        user_id: user.id,
        name: row.customer_name || 'Unknown Customer',
        company_name: row.customer_name || 'Unknown Company',
        email: row.customer_email || `unknown-${Date.now()}-${Math.random().toString(36).substring(7)}@placeholder.com`,
        external_customer_id: row.customer_id || null,
        external_system: row.source_system || 'csv_upload',
        integration_source: 'csv_upload',
        reference_id: `RAID-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      }));

      // Insert in chunks of 50
      for (let i = 0; i < newDebtors.length; i += 50) {
        const chunk = newDebtors.slice(i, i + 50);
        const { data: created, error: debtorError } = await supabase
          .from('debtors')
          .insert(chunk)
          .select('id, company_name, external_customer_id');

        if (debtorError) {
          console.error('Bulk debtor insert error, falling back to individual:', debtorError.message);
          // Fallback: insert individually
          for (const d of chunk) {
            const { data: single } = await supabase.from('debtors').insert(d).select('id, company_name, external_customer_id').single();
            if (single) {
              if (single.external_customer_id) debtorCache.set(single.external_customer_id, single.id);
              if (single.company_name) debtorCache.set(single.company_name.toLowerCase(), single.id);
            }
          }
        } else {
          created?.forEach(d => {
            if (d.external_customer_id) debtorCache.set(d.external_customer_id, d.id);
            if (d.company_name) debtorCache.set(d.company_name.toLowerCase(), d.id);
          });
        }
      }
    }

    // --- Phase 2: Resolve debtor IDs for all rows ---
    function resolveDebtorId(row: ImportRow): string | null {
      if (row.customer_id && debtorCache.has(row.customer_id)) return debtorCache.get(row.customer_id)!;
      if (row.customer_name) {
        const key = row.customer_name.toLowerCase();
        if (debtorCache.has(key)) return debtorCache.get(key)!;
      }
      return null;
    }

    // --- Phase 3: Bulk upsert/insert invoices ---
    let successCount = 0;
    let errorCount = 0;
    const BULK_SIZE = 50;

    if (mode === 'UPSERT_BY_EXTERNAL_INVOICE_ID') {
      // For upsert: check existing invoices in bulk, then separate into updates and inserts
      const extIds = rows.map((r: ImportRow) => r.external_invoice_id).filter(Boolean);
      const existingMap = new Map<string, string>();

      for (let i = 0; i < extIds.length; i += 100) {
        const chunk = extIds.slice(i, i + 100);
        const { data: existing } = await supabase
          .from('invoices')
          .select('id, external_invoice_id')
          .eq('user_id', user.id)
          .in('external_invoice_id', chunk);
        existing?.forEach(inv => { if (inv.external_invoice_id) existingMap.set(inv.external_invoice_id, inv.id); });
      }

      const toInsert: any[] = [];
      const toUpdate: Array<{ id: string; data: any }> = [];

      for (const row of rows as ImportRow[]) {
        const debtorId = resolveDebtorId(row);
        if (!debtorId) { errorCount++; continue; }

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
        };

        if (existingMap.has(row.external_invoice_id)) {
          toUpdate.push({ id: existingMap.get(row.external_invoice_id)!, data: invoiceData });
        } else {
          invoiceData.reference_id = `INV-${Math.random().toString(36).substring(7).toUpperCase()}`;
          toInsert.push(invoiceData);
        }
      }

      // Bulk insert new invoices
      for (let i = 0; i < toInsert.length; i += BULK_SIZE) {
        const chunk = toInsert.slice(i, i + BULK_SIZE);
        const { data: inserted, error: insertError } = await supabase
          .from('invoices')
          .insert(chunk)
          .select('id');

        if (insertError) {
          console.error('Bulk insert error:', insertError.message);
          // Fallback to individual inserts
          for (const inv of chunk) {
            const { error } = await supabase.from('invoices').insert(inv);
            if (error) { errorCount++; } else { successCount++; }
          }
        } else {
          successCount += inserted?.length || chunk.length;
          // Track usage non-blocking
          inserted?.forEach(inv => {
            supabase.functions.invoke('track-invoice-usage', {
              body: { invoice_id: inv.id },
            }).catch(() => {});
          });
        }
      }

      // Updates must be individual (no bulk update by different IDs)
      for (const { id, data } of toUpdate) {
        const { error } = await supabase.from('invoices').update(data).eq('id', id);
        if (error) { errorCount++; } else { successCount++; }
      }

    } else {
      // INSERT_ONLY mode: bulk insert
      const toInsert: any[] = [];
      const errorRowNumbers: number[] = [];

      for (let idx = 0; idx < rows.length; idx++) {
        const row: ImportRow = rows[idx];
        const debtorId = resolveDebtorId(row);
        if (!debtorId) { errorCount++; errorRowNumbers.push(idx + 2); continue; }

        toInsert.push({
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
        });
      }

      for (let i = 0; i < toInsert.length; i += BULK_SIZE) {
        const chunk = toInsert.slice(i, i + BULK_SIZE);
        const { data: inserted, error: insertError } = await supabase
          .from('invoices')
          .insert(chunk)
          .select('id');

        if (insertError) {
          console.error('Bulk insert error:', insertError.message);
          // Fallback to individual
          for (const inv of chunk) {
            const { error } = await supabase.from('invoices').insert(inv);
            if (error) { errorCount++; } else { successCount++; }
          }
        } else {
          successCount += inserted?.length || chunk.length;
          inserted?.forEach(inv => {
            supabase.functions.invoke('track-invoice-usage', {
              body: { invoice_id: inv.id },
            }).catch(() => {});
          });
        }
      }
    }

    // Update job progress
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
