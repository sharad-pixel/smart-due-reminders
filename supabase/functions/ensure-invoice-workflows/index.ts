import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Fetch all open/in-payment-plan invoices that are NOT paused
    // and whose parent debtor is NOT paused
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

    let assigned = 0;
    let skipped = 0;
    let errors = 0;

    for (const invoice of invoicesNeedingWorkflows) {
      try {
        // Determine aging bucket based on due date
        const dueDate = new Date(invoice.due_date);
        const today = new Date();
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
          .single();

        if (workflowError || !workflow) {
          console.log(`No workflow found for bucket ${agingBucket}, invoice ${invoice.id}`);
          skipped++;
          continue;
        }

        // Create cadence_days array from workflow steps
        const steps = (workflow.collection_workflow_steps as any[]) || [];
        const cadenceDays = steps
          .sort((a, b) => a.step_order - b.step_order)
          .map(s => s.day_offset);

        if (cadenceDays.length === 0) {
          console.log(`Workflow ${workflow.id} has no steps, skipping invoice ${invoice.id}`);
          skipped++;
          continue;
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
          errors++;
          continue;
        }

        console.log(`Created workflow for invoice ${invoice.id} with bucket ${agingBucket}`);
        assigned++;

      } catch (err) {
        console.error(`Error processing invoice ${invoice.id}:`, err);
        errors++;
      }
    }

    // Now ensure all invoices with workflows have next outreach dates via ai_drafts
    // Trigger the daily cadence scheduler to generate drafts
    console.log('Triggering draft generation for all workflows...');

    try {
      const { error: schedulerError } = await supabaseAdmin.functions.invoke(
        'daily-cadence-scheduler',
        { body: {} }
      );

      if (schedulerError) {
        console.error('Error running cadence scheduler:', schedulerError);
      } else {
        console.log('Cadence scheduler completed');
      }
    } catch (err) {
      console.error('Exception running cadence scheduler:', err);
    }

    const summary = {
      success: true,
      totalEligibleInvoices: eligibleInvoices.length,
      invoicesAlreadyHadWorkflows: invoicesWithWorkflows.size,
      workflowsCreated: assigned,
      skipped,
      errors,
      message: `Processed ${eligibleInvoices.length} invoices, created ${assigned} new workflow assignments`
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
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
