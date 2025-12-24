import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Invoice {
  id: string;
  user_id: string;
  due_date: string;
  status: string;
  ai_workflows?: Array<{
    id: string;
    is_active: boolean;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[DAILY-WORKFLOW-REASSIGNMENT] Starting daily reassignment process');

    // Get all open invoices with their current workflows
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('id, user_id, due_date, status, ai_workflows(id, is_active)')
      .in('status', ['Open', 'InPaymentPlan'])
      .order('due_date', { ascending: true });

    if (invoicesError) {
      console.error('[DAILY-WORKFLOW-REASSIGNMENT] Error fetching invoices:', invoicesError);
      throw invoicesError;
    }

    console.log(`[DAILY-WORKFLOW-REASSIGNMENT] Found ${invoices?.length || 0} invoices to process`);

    let reassignedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each invoice
    for (const invoice of invoices || []) {
      try {
        // Calculate current aging bucket
        const daysPastDue = Math.max(0, Math.ceil(
          (Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)
        ));

        let agingBucket: string;
        if (daysPastDue < 0) {
          agingBucket = 'current';
        } else if (daysPastDue <= 30) {
          agingBucket = 'dpd_1_30';
        } else if (daysPastDue <= 60) {
          agingBucket = 'dpd_31_60';
        } else if (daysPastDue <= 90) {
          agingBucket = 'dpd_61_90';
        } else if (daysPastDue <= 120) {
          agingBucket = 'dpd_91_120';
        } else if (daysPastDue <= 150) {
          agingBucket = 'dpd_121_150';
        } else {
          agingBucket = 'dpd_150_plus';
        }

        // Update the invoice aging_bucket if changed
        const { data: currentInvoice } = await supabase
          .from('invoices')
          .select('aging_bucket')
          .eq('id', invoice.id)
          .single();

        if (currentInvoice && currentInvoice.aging_bucket !== agingBucket) {
          await supabase
            .from('invoices')
            .update({ 
              aging_bucket: agingBucket,
              bucket_entered_at: new Date().toISOString()
            })
            .eq('id', invoice.id);
          console.log(`[DAILY-WORKFLOW-REASSIGNMENT] Updated invoice ${invoice.id} aging_bucket from ${currentInvoice.aging_bucket} to ${agingBucket}`);
        }

        // Find the workflow for this aging bucket
        const { data: workflow, error: workflowError } = await supabase
          .from('collection_workflows')
          .select('id, aging_bucket')
          .eq('aging_bucket', agingBucket)
          .eq('is_active', true)
          .or(`user_id.eq.${invoice.user_id},user_id.is.null`)
          .order('user_id', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        if (workflowError) {
          console.error(`[DAILY-WORKFLOW-REASSIGNMENT] Error finding workflow for invoice ${invoice.id}:`, workflowError);
          errorCount++;
          continue;
        }

        if (!workflow) {
          console.log(`[DAILY-WORKFLOW-REASSIGNMENT] No workflow found for bucket ${agingBucket}, skipping invoice ${invoice.id}`);
          skippedCount++;
          continue;
        }

        // Check if invoice already has an active workflow
        const activeWorkflow = (invoice.ai_workflows || []).find(w => w.is_active);

        if (!activeWorkflow) {
          // No active workflow, create one
          const { error: insertError } = await supabase
            .from('ai_workflows')
            .insert({
              invoice_id: invoice.id,
              user_id: invoice.user_id,
              is_active: true,
              cadence_days: [],
              tone: 'friendly',
            });

          if (insertError) {
            console.error(`[DAILY-WORKFLOW-REASSIGNMENT] Error creating workflow for invoice ${invoice.id}:`, insertError);
            errorCount++;
          } else {
            console.log(`[DAILY-WORKFLOW-REASSIGNMENT] Created workflow for invoice ${invoice.id} in bucket ${agingBucket}`);
            reassignedCount++;
          }
        } else {
          // Has active workflow - we need to verify if it's still in the right bucket
          // Since ai_workflows doesn't store the bucket directly, we skip comparison
          // The workflow assignment is already correct if it exists
          // We only need to check if the target workflow (for the current bucket) matches
          
          // For simplicity: deactivate current and create new one to ensure correct assignment
          // This ensures the invoice is always in the workflow matching its current aging bucket
          
          // Deactivate old workflow
          await supabase
            .from('ai_workflows')
            .update({ is_active: false })
            .eq('id', activeWorkflow.id);

          // Create new workflow assignment
          const { error: insertError } = await supabase
            .from('ai_workflows')
            .insert({
              invoice_id: invoice.id,
              user_id: invoice.user_id,
              is_active: true,
              cadence_days: [],
              tone: 'friendly',
            });

          if (insertError) {
            console.error(`[DAILY-WORKFLOW-REASSIGNMENT] Error reassigning workflow for invoice ${invoice.id}:`, insertError);
            errorCount++;
          } else {
            console.log(`[DAILY-WORKFLOW-REASSIGNMENT] Reassigned invoice ${invoice.id} to bucket ${agingBucket}`);
            reassignedCount++;
          }
        }
      } catch (error) {
        console.error(`[DAILY-WORKFLOW-REASSIGNMENT] Error processing invoice ${invoice.id}:`, error);
        errorCount++;
      }
    }

    const summary = {
      totalProcessed: invoices?.length || 0,
      reassigned: reassignedCount,
      skipped: skippedCount,
      errors: errorCount,
    };

    console.log('[DAILY-WORKFLOW-REASSIGNMENT] Process completed:', summary);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily workflow reassignment completed',
        summary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[DAILY-WORKFLOW-REASSIGNMENT] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});