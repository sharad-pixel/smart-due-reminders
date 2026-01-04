import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkflowResult {
  assigned: number;
  fixed: number;
  skipped: number;
  skippedCurrent: number;
  errors: number;
  errorDetails: Array<{ invoiceId: string; error: string }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const result: WorkflowResult = {
    assigned: 0,
    fixed: 0,
    skipped: 0,
    skippedCurrent: 0,
    errors: 0,
    errorDetails: [],
  };

  try {
    console.log('Starting ensure-invoice-workflows process...');

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

    // Fetch all open/in-payment-plan invoices that are NOT paused
    const { data: invoices, error: invoicesError } = await supabaseAdmin
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
      .eq('outreach_paused', false);

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
      throw invoicesError;
    }

    // Filter out invoices where the debtor has outreach paused
    const eligibleInvoices = invoices?.filter(inv => {
      const debtor = inv.debtors as any;
      return !debtor?.outreach_paused;
    }) || [];

    console.log(`Found ${eligibleInvoices.length} eligible invoices (not paused)`);

    // Get all active ai_workflows for these invoices
    const invoiceIds = eligibleInvoices.map(inv => inv.id);
    
    const { data: existingWorkflows, error: workflowsError } = await supabaseAdmin
      .from('ai_workflows')
      .select('invoice_id')
      .in('invoice_id', invoiceIds.length > 0 ? invoiceIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('is_active', true);

    if (workflowsError) {
      console.error('Error fetching existing workflows:', workflowsError);
      throw workflowsError;
    }

    const invoicesWithWorkflows = new Set(existingWorkflows?.map(w => w.invoice_id) || []);
    
    // Find invoices without active workflows
    const invoicesNeedingWorkflows = eligibleInvoices.filter(inv => !invoicesWithWorkflows.has(inv.id));

    console.log(`${invoicesNeedingWorkflows.length} invoices need workflow assignments`);

    for (const invoice of invoicesNeedingWorkflows) {
      try {
        // Determine aging bucket based on due date
        const dueDate = new Date(invoice.due_date);
        dueDate.setHours(0, 0, 0, 0);
        
        const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let agingBucket: string;
        if (daysPastDue < 0) {
          agingBucket = 'current';
        } else if (daysPastDue >= 0 && daysPastDue <= 30) {
          agingBucket = 'dpd_1_30';
        } else if (daysPastDue >= 31 && daysPastDue <= 60) {
          agingBucket = 'dpd_31_60';
        } else if (daysPastDue >= 61 && daysPastDue <= 90) {
          agingBucket = 'dpd_61_90';
        } else if (daysPastDue >= 91 && daysPastDue <= 120) {
          agingBucket = 'dpd_91_120';
        } else if (daysPastDue >= 121 && daysPastDue <= 150) {
          agingBucket = 'dpd_121_150';
        } else {
          agingBucket = 'dpd_150_plus';
        }

        // Skip 'current' bucket invoices - they're not past due yet
        if (agingBucket === 'current') {
          console.log(`Skipping invoice ${invoice.id}: aging_bucket is 'current' (not past due yet)`);
          result.skippedCurrent++;
          
          // Still update the aging_bucket if needed
          if (invoice.aging_bucket !== agingBucket) {
            await supabaseAdmin
              .from('invoices')
              .update({ 
                aging_bucket: agingBucket,
                bucket_entered_at: new Date().toISOString()
              })
              .eq('id', invoice.id);
          }
          continue;
        }

        // Update the invoice aging_bucket if changed
        if (invoice.aging_bucket !== agingBucket) {
          await supabaseAdmin
            .from('invoices')
            .update({ 
              aging_bucket: agingBucket,
              bucket_entered_at: new Date().toISOString()
            })
            .eq('id', invoice.id);
          console.log(`Updated invoice ${invoice.id} aging_bucket to ${agingBucket}`);
        }

        // Find active collection workflow for this bucket and user
        const { data: workflow, error: workflowError } = await supabaseAdmin
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

        if (workflowError) {
          console.error(`Error finding workflow for bucket ${agingBucket}:`, workflowError);
          result.errors++;
          result.errorDetails.push({ invoiceId: invoice.id, error: workflowError.message });
          continue;
        }

        if (!workflow) {
          console.log(`No workflow found for bucket ${agingBucket}, invoice ${invoice.id}`);
          result.skipped++;
          continue;
        }

        // Create cadence_days array from workflow steps
        const steps = (workflow.collection_workflow_steps as any[]) || [];
        let cadenceDays = steps
          .sort((a, b) => a.step_order - b.step_order)
          .map(s => s.day_offset);

        // Ensure cadence_days is not empty (trigger will also handle this)
        if (cadenceDays.length === 0) {
          cadenceDays = [0, 3, 7, 14, 21]; // Default cadence
          console.log(`Workflow ${workflow.id} has no steps, using default cadence`);
        }

        // Create ai_workflow entry
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
          console.error(`Error creating workflow for invoice ${invoice.id}:`, insertError);
          result.errors++;
          result.errorDetails.push({ invoiceId: invoice.id, error: insertError.message });
          continue;
        }

        console.log(`Created workflow for invoice ${invoice.id} with bucket ${agingBucket}`);
        result.assigned++;

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Error processing invoice ${invoice.id}:`, errorMsg);
        result.errors++;
        result.errorDetails.push({ invoiceId: invoice.id, error: errorMsg });
      }
    }

    // Fix existing workflows with empty cadence_days
    console.log('Checking for workflows with empty cadence_days...');
    
    const { data: emptyWorkflows } = await supabaseAdmin
      .from('ai_workflows')
      .select(`
        id,
        invoice_id,
        user_id,
        invoices!inner (
          due_date,
          status,
          aging_bucket
        )
      `)
      .eq('is_active', true)
      .eq('cadence_days', '[]');
    
    for (const aw of emptyWorkflows || []) {
      try {
        const invoice = aw.invoices as any;
        if (!invoice || (invoice.status !== 'Open' && invoice.status !== 'InPaymentPlan')) {
          continue;
        }
        
        // Determine aging bucket
        const dueDate = new Date(invoice.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let agingBucket = invoice.aging_bucket;
        if (!agingBucket || agingBucket === 'current') {
          if (daysPastDue < 0) {
            agingBucket = 'current';
          } else if (daysPastDue >= 0 && daysPastDue <= 30) {
            agingBucket = 'dpd_1_30';
          } else if (daysPastDue >= 31 && daysPastDue <= 60) {
            agingBucket = 'dpd_31_60';
          } else if (daysPastDue >= 61 && daysPastDue <= 90) {
            agingBucket = 'dpd_61_90';
          } else if (daysPastDue >= 91 && daysPastDue <= 120) {
            agingBucket = 'dpd_91_120';
          } else if (daysPastDue >= 121 && daysPastDue <= 150) {
            agingBucket = 'dpd_121_150';
          } else {
            agingBucket = 'dpd_150_plus';
          }
        }
        
        // Skip current bucket - can't outreach yet
        if (agingBucket === 'current') {
          console.log(`Skipping workflow fix for ${aw.id}: invoice is in 'current' bucket`);
          continue;
        }
        
        // Find workflow with steps
        const { data: wf } = await supabaseAdmin
          .from('collection_workflows')
          .select(`
            collection_workflow_steps (day_offset, step_order)
          `)
          .eq('aging_bucket', agingBucket)
          .eq('is_active', true)
          .or(`user_id.eq.${aw.user_id},user_id.is.null`)
          .order('user_id', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();
        
        let cadenceDays: number[] = [0, 3, 7, 14, 21]; // Default
        
        if (wf) {
          const steps = (wf.collection_workflow_steps as any[]) || [];
          const extractedDays = steps
            .sort((a, b) => a.step_order - b.step_order)
            .map(s => s.day_offset);
          
          if (extractedDays.length > 0) {
            cadenceDays = extractedDays;
          }
        }
        
        await supabaseAdmin
          .from('ai_workflows')
          .update({ cadence_days: cadenceDays })
          .eq('id', aw.id);
        
        result.fixed++;
        console.log(`Fixed workflow ${aw.id} with cadence_days: ${JSON.stringify(cadenceDays)}`);
      } catch (e) {
        console.error(`Error fixing workflow ${aw.id}:`, e);
      }
    }
    
    console.log(`Fixed ${result.fixed} workflows with empty cadence_days`);

    // Trigger the daily cadence scheduler to generate drafts
    console.log('Triggering draft generation...');

    let schedulerResult: any = null;
    try {
      const { data, error: schedulerError } = await supabaseAdmin.functions.invoke(
        'daily-cadence-scheduler',
        { body: {} }
      );

      if (schedulerError) {
        console.error('Error running cadence scheduler:', schedulerError);
      } else {
        schedulerResult = data;
        console.log('Cadence scheduler completed:', schedulerResult);
      }
    } catch (err) {
      console.error('Exception running cadence scheduler:', err);
    }

    const summary = {
      success: true,
      totalEligibleInvoices: eligibleInvoices.length,
      invoicesAlreadyHadWorkflows: invoicesWithWorkflows.size,
      workflowsCreated: result.assigned,
      workflowsFixed: result.fixed,
      skipped: result.skipped,
      skippedCurrent: result.skippedCurrent,
      errors: result.errors,
      errorDetails: result.errorDetails.slice(0, 10),
      schedulerResult: schedulerResult ? {
        drafted: schedulerResult.drafted,
        sent: schedulerResult.draftsSent,
        failed: schedulerResult.failed
      } : null,
      message: `Processed ${eligibleInvoices.length} invoices, created ${result.assigned} workflows, fixed ${result.fixed} workflows, skipped ${result.skippedCurrent} current-bucket invoices`
    };

    console.log('Summary:', summary);

    return new Response(
      JSON.stringify(summary),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in ensure-invoice-workflows:', error);
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
