import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkflowResult {
  invoicesChecked: number;
  workflowsAssigned: number;
  workflowsUpgraded: number;
  cadenceFixed: number;
  skippedCurrent: number;
  skippedNoWorkflow: number;
  errors: number;
  errorDetails: Array<{ invoiceId: string; error: string }>;
}

// Aging bucket priority order (highest priority first)
const BUCKET_PRIORITY: Record<string, number> = {
  'dpd_150_plus': 1,
  'dpd_121_150': 2,
  'dpd_91_120': 3,
  'dpd_61_90': 4,
  'dpd_31_60': 5,
  'dpd_1_30': 6,
  'current': 7,
};

function calculateAgingBucket(daysPastDue: number): string {
  if (daysPastDue < 0) return 'current';
  if (daysPastDue <= 30) return 'dpd_1_30';
  if (daysPastDue <= 60) return 'dpd_31_60';
  if (daysPastDue <= 90) return 'dpd_61_90';
  if (daysPastDue <= 120) return 'dpd_91_120';
  if (daysPastDue <= 150) return 'dpd_121_150';
  return 'dpd_150_plus';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const result: WorkflowResult = {
    invoicesChecked: 0,
    workflowsAssigned: 0,
    workflowsUpgraded: 0,
    cadenceFixed: 0,
    skippedCurrent: 0,
    skippedNoWorkflow: 0,
    errors: 0,
    errorDetails: [],
  };

  try {
    console.log('[ENSURE-WORKFLOWS] Starting comprehensive workflow assignment...');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Process ALL invoices in batches to avoid 1000 row limit
    const BATCH_SIZE = 500;
    let offset = 0;
    let hasMore = true;
    let allInvoices: any[] = [];

    console.log('[ENSURE-WORKFLOWS] Fetching all unpaid invoices in batches...');

    while (hasMore) {
      const { data: batch, error: batchError } = await supabaseAdmin
        .from('invoices')
        .select(`
          id,
          user_id,
          due_date,
          status,
          aging_bucket,
          outreach_paused,
          debtor_id,
          debtors!inner (
            id,
            outreach_paused
          )
        `)
        .in('status', ['Open', 'InPaymentPlan'])
        .eq('outreach_paused', false)
        .range(offset, offset + BATCH_SIZE - 1)
        .order('due_date', { ascending: true }); // Oldest first (highest priority)

      if (batchError) {
        console.error('[ENSURE-WORKFLOWS] Error fetching batch:', batchError);
        throw batchError;
      }

      const batchCount = batch?.length || 0;
      console.log(`[ENSURE-WORKFLOWS] Batch ${Math.floor(offset / BATCH_SIZE) + 1}: ${batchCount} invoices`);

      if (batchCount === 0) {
        hasMore = false;
        break;
      }

      // Filter out invoices where debtor has outreach paused
      const filtered = batch.filter(inv => {
        const debtor = inv.debtors as any;
        return !debtor?.outreach_paused;
      });

      allInvoices = [...allInvoices, ...filtered];
      offset += BATCH_SIZE;

      if (batchCount < BATCH_SIZE) {
        hasMore = false;
      }

      // Safety limit
      if (allInvoices.length >= 50000) {
        console.log('[ENSURE-WORKFLOWS] Reached safety limit of 50,000 invoices');
        hasMore = false;
      }
    }

    console.log(`[ENSURE-WORKFLOWS] Total eligible invoices: ${allInvoices.length}`);
    result.invoicesChecked = allInvoices.length;

    // Get all active ai_workflows for these invoices
    const invoiceIds = allInvoices.map(inv => inv.id);
    
    const { data: existingWorkflows, error: workflowsError } = await supabaseAdmin
      .from('ai_workflows')
      .select('id, invoice_id, cadence_days, is_active')
      .in('invoice_id', invoiceIds.length > 0 ? invoiceIds : ['00000000-0000-0000-0000-000000000000']);

    if (workflowsError) {
      console.error('[ENSURE-WORKFLOWS] Error fetching workflows:', workflowsError);
      throw workflowsError;
    }

    // Build maps for quick lookup
    const activeWorkflowsByInvoice = new Map<string, any>();
    const allWorkflowsByInvoice = new Map<string, any[]>();
    
    for (const wf of existingWorkflows || []) {
      if (!allWorkflowsByInvoice.has(wf.invoice_id)) {
        allWorkflowsByInvoice.set(wf.invoice_id, []);
      }
      allWorkflowsByInvoice.get(wf.invoice_id)!.push(wf);
      
      if (wf.is_active) {
        activeWorkflowsByInvoice.set(wf.invoice_id, wf);
      }
    }

    console.log(`[ENSURE-WORKFLOWS] Active workflows found: ${activeWorkflowsByInvoice.size}`);

    // Cache collection workflows by bucket to avoid repeated queries
    const workflowCache = new Map<string, Map<string, any>>();

    for (const invoice of allInvoices) {
      try {
        // Calculate aging bucket
        const dueDate = new Date(invoice.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const agingBucket = calculateAgingBucket(daysPastDue);

        // Skip 'current' bucket - not past due yet
        if (agingBucket === 'current') {
          // Update aging_bucket if needed
          if (invoice.aging_bucket !== agingBucket) {
            await supabaseAdmin
              .from('invoices')
              .update({ 
                aging_bucket: agingBucket,
                bucket_entered_at: new Date().toISOString()
              })
              .eq('id', invoice.id);
          }
          result.skippedCurrent++;
          continue;
        }

        // Update invoice aging_bucket if changed
        const bucketChanged = invoice.aging_bucket !== agingBucket;
        if (bucketChanged) {
          await supabaseAdmin
            .from('invoices')
            .update({ 
              aging_bucket: agingBucket,
              bucket_entered_at: new Date().toISOString()
            })
            .eq('id', invoice.id);
          console.log(`[ENSURE-WORKFLOWS] Invoice ${invoice.id} bucket: ${invoice.aging_bucket} → ${agingBucket}`);
        }

        // Get or cache workflow template for this bucket/user
        const cacheKey = `${agingBucket}:${invoice.user_id}`;
        let userWorkflowCache = workflowCache.get(invoice.user_id);
        
        if (!userWorkflowCache) {
          userWorkflowCache = new Map();
          workflowCache.set(invoice.user_id, userWorkflowCache);
        }

        let collectionWorkflow = userWorkflowCache.get(agingBucket);
        
        if (!collectionWorkflow) {
          // Fetch collection workflow for this bucket
          const { data: workflow } = await supabaseAdmin
            .from('collection_workflows')
            .select(`
              id,
              collection_workflow_steps (
                id,
                day_offset,
                step_order
              )
            `)
            .eq('aging_bucket', agingBucket)
            .eq('is_active', true)
            .or(`user_id.eq.${invoice.user_id},user_id.is.null`)
            .order('user_id', { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle();

          userWorkflowCache.set(agingBucket, workflow || null);
          collectionWorkflow = workflow;
        }

        if (!collectionWorkflow) {
          console.log(`[ENSURE-WORKFLOWS] No workflow template for bucket ${agingBucket}`);
          result.skippedNoWorkflow++;
          continue;
        }

        // Calculate cadence_days from steps
        const steps = (collectionWorkflow.collection_workflow_steps as any[]) || [];
        let cadenceDays = steps
          .sort((a, b) => a.step_order - b.step_order)
          .map(s => s.day_offset);

        if (cadenceDays.length === 0) {
          cadenceDays = [0, 3, 7, 14, 21]; // Default cadence
        }

        const existingActive = activeWorkflowsByInvoice.get(invoice.id);

        if (!existingActive) {
          // No active workflow - create new one
          const { error: insertError } = await supabaseAdmin
            .from('ai_workflows')
            .insert({
              invoice_id: invoice.id,
              user_id: invoice.user_id,
              cadence_days: cadenceDays,
              is_active: true,
              tone: 'friendly'
            });

          if (insertError) {
            console.error(`[ENSURE-WORKFLOWS] Error creating workflow for ${invoice.id}:`, insertError);
            result.errors++;
            result.errorDetails.push({ invoiceId: invoice.id, error: insertError.message });
            continue;
          }

          console.log(`[ENSURE-WORKFLOWS] Created workflow for invoice ${invoice.id}, bucket ${agingBucket}`);
          result.workflowsAssigned++;

        } else if (bucketChanged) {
          // Bucket changed - deactivate old workflow and create new one
          console.log(`[ENSURE-WORKFLOWS] Upgrading workflow for invoice ${invoice.id} due to bucket change`);

          // Deactivate old workflow
          await supabaseAdmin
            .from('ai_workflows')
            .update({ is_active: false })
            .eq('id', existingActive.id);

          // Create new workflow for new bucket
          const { error: insertError } = await supabaseAdmin
            .from('ai_workflows')
            .insert({
              invoice_id: invoice.id,
              user_id: invoice.user_id,
              cadence_days: cadenceDays,
              is_active: true,
              tone: 'friendly'
            });

          if (insertError) {
            result.errors++;
            result.errorDetails.push({ invoiceId: invoice.id, error: insertError.message });
            continue;
          }

          result.workflowsUpgraded++;

        } else {
          // Existing workflow - check if cadence_days is valid
          const existingCadence = existingActive.cadence_days as any;
          const isEmpty = !existingCadence || 
            (Array.isArray(existingCadence) && existingCadence.length === 0) ||
            existingCadence === '[]';

          if (isEmpty) {
            console.log(`[ENSURE-WORKFLOWS] Fixing empty cadence for workflow ${existingActive.id}`);

            const { error: updateError } = await supabaseAdmin
              .from('ai_workflows')
              .update({ cadence_days: cadenceDays })
              .eq('id', existingActive.id);

            if (updateError) {
              result.errors++;
              result.errorDetails.push({ invoiceId: invoice.id, error: updateError.message });

              // Log to outreach_errors
              await supabaseAdmin
                .from('outreach_errors')
                .insert({
                  invoice_id: invoice.id,
                  workflow_id: existingActive.id,
                  user_id: invoice.user_id,
                  error_type: 'cadence_fix_failed',
                  error_message: updateError.message,
                  metadata: { attempted_cadence: cadenceDays }
                });
            } else {
              result.cadenceFixed++;
            }
          }
        }

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[ENSURE-WORKFLOWS] Error processing invoice ${invoice.id}:`, errorMsg);
        result.errors++;
        result.errorDetails.push({ invoiceId: invoice.id, error: errorMsg });
      }
    }

    console.log('[ENSURE-WORKFLOWS] Triggering cadence scheduler...');

    // Trigger the cadence scheduler to generate drafts
    let schedulerResult: any = null;
    try {
      const { data, error: schedulerError } = await supabaseAdmin.functions.invoke(
        'daily-cadence-scheduler',
        { body: {} }
      );

      if (schedulerError) {
        console.error('[ENSURE-WORKFLOWS] Scheduler error:', schedulerError);
      } else {
        schedulerResult = data;
        console.log('[ENSURE-WORKFLOWS] Scheduler completed:', schedulerResult);
      }
    } catch (err) {
      console.error('[ENSURE-WORKFLOWS] Scheduler exception:', err);
    }

    const summary = {
      success: true,
      invoicesChecked: result.invoicesChecked,
      workflowsAssigned: result.workflowsAssigned,
      workflowsUpgraded: result.workflowsUpgraded,
      cadenceFixed: result.cadenceFixed,
      skippedCurrent: result.skippedCurrent,
      skippedNoWorkflow: result.skippedNoWorkflow,
      errors: result.errors,
      errorDetails: result.errorDetails.slice(0, 20),
      schedulerResult: schedulerResult ? {
        drafted: schedulerResult.drafted || 0,
        sent: schedulerResult.draftsSent || 0,
        failed: schedulerResult.failed || 0
      } : null,
      message: `Checked ${result.invoicesChecked} invoices: ${result.workflowsAssigned} assigned, ${result.workflowsUpgraded} upgraded, ${result.cadenceFixed} fixed, ${result.skippedCurrent} current-bucket skipped`
    };

    console.log('[ENSURE-WORKFLOWS] Summary:', summary);

    return new Response(
      JSON.stringify(summary),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[ENSURE-WORKFLOWS] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        ...result
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
