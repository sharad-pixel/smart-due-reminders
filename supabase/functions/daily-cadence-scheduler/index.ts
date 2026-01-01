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
    console.log('Starting daily cadence scheduler...');

    // Use service role for system-level operations
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

    // Get all active workflows
    const { data: workflows, error: workflowsError } = await supabaseAdmin
      .from('ai_workflows')
      .select(`
        id,
        invoice_id,
        tone,
        cadence_days,
        user_id,
        invoices (
          id,
          due_date,
          status
        )
      `)
      .eq('is_active', true);

    if (workflowsError) {
      console.error('Error fetching workflows:', workflowsError);
      throw workflowsError;
    }

    console.log(`Found ${workflows?.length || 0} active workflows`);

    let draftsCreated = 0;
    let skipped = 0;

    for (const workflow of workflows || []) {
      const invoice = workflow.invoices as any;

      // Only process Open or InPaymentPlan invoices
      if (!invoice || (invoice.status !== 'Open' && invoice.status !== 'InPaymentPlan')) {
        console.log(`Skipping invoice ${invoice?.id}: status is ${invoice?.status}`);
        skipped++;
        continue;
      }

      const dueDate = new Date(invoice.due_date);
      const cadenceDays = workflow.cadence_days as number[];

      console.log(`Processing workflow ${workflow.id} for invoice ${invoice.id}, cadence: ${JSON.stringify(cadenceDays)}`);

      for (let i = 0; i < cadenceDays.length; i++) {
        const cadenceDay = cadenceDays[i];
        const stepNumber = i + 1;

        // Calculate target date
        const targetDate = new Date(dueDate);
        targetDate.setDate(targetDate.getDate() + cadenceDay);
        targetDate.setHours(0, 0, 0, 0);

        console.log(`Checking step ${stepNumber} (day ${cadenceDay}): target=${targetDate.toISOString()}, today=${today.toISOString()}`);

        // Check if target date is today
        if (targetDate.getTime() === today.getTime()) {
          console.log(`Target date matches today for step ${stepNumber}`);

          // Check if draft or outreach log already exists for this step
          const { data: existingDrafts } = await supabaseAdmin
            .from('ai_drafts')
            .select('id')
            .eq('invoice_id', invoice.id)
            .eq('step_number', stepNumber)
            .limit(1);

          const { data: existingLogs } = await supabaseAdmin
            .from('outreach_logs')
            .select('id')
            .eq('invoice_id', invoice.id)
            .limit(1);

          if (existingDrafts && existingDrafts.length > 0) {
            console.log(`Draft already exists for step ${stepNumber}`);
            continue;
          }

          if (existingLogs && existingLogs.length > 0) {
            console.log(`Outreach log already exists for step ${stepNumber}`);
            continue;
          }

          // Generate the draft by calling the edge function
          console.log(`Generating draft for invoice ${invoice.id}, step ${stepNumber}, tone ${workflow.tone}`);

          try {
            const { data: draftData, error: draftError } = await supabaseAdmin.functions.invoke(
              'generate-outreach-draft',
              {
                body: {
                  invoice_id: invoice.id,
                  tone: workflow.tone,
                  step_number: stepNumber
                }
              }
            );

            if (draftError) {
              console.error(`Error generating draft for invoice ${invoice.id}:`, draftError);
            } else {
              console.log(`Successfully created draft for invoice ${invoice.id}, step ${stepNumber}`);
              draftsCreated++;
            }
          } catch (err) {
            console.error(`Exception generating draft for invoice ${invoice.id}:`, err);
          }
        }
      }
    }

    console.log(`Scheduler completed: ${draftsCreated} drafts created, ${skipped} invoices skipped`);

    // Now automatically send all approved drafts that are ready
    console.log('Triggering auto-send-approved-drafts...');
    let sentCount = 0;
    let sendErrors: string[] = [];
    
    try {
      const { data: sendResult, error: sendError } = await supabaseAdmin.functions.invoke(
        'auto-send-approved-drafts',
        { body: {} }
      );
      
      if (sendError) {
        console.error('Error calling auto-send-approved-drafts:', sendError);
        sendErrors.push(sendError.message || 'Failed to send approved drafts');
      } else {
        sentCount = sendResult?.sent || 0;
        console.log(`Auto-send result: ${sentCount} drafts sent`);
      }
    } catch (err) {
      console.error('Exception calling auto-send-approved-drafts:', err);
      sendErrors.push(err instanceof Error ? err.message : 'Unknown error');
    }

    return new Response(
      JSON.stringify({
        success: true,
        draftsCreated,
        draftsSent: sentCount,
        skipped,
        sendErrors: sendErrors.length > 0 ? sendErrors : undefined,
        message: `Processed ${workflows?.length || 0} workflows, created ${draftsCreated} drafts, sent ${sentCount} emails`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in daily-cadence-scheduler:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
