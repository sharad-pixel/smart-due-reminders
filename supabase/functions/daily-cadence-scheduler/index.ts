import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessingResult {
  processed: number;
  drafted: number;
  failed: number;
  skipped: number;
  errors: Array<{ invoiceId: string; error: string; stepNumber?: number }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const result: ProcessingResult = {
    processed: 0,
    drafted: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    console.log('Starting daily cadence scheduler (batch processing)...');

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
    const todayStr = today.toISOString().split('T')[0];

    // Process workflows in batches to avoid 1000 row limit
    const BATCH_SIZE = 500;
    let offset = 0;
    let hasMore = true;
    let totalWorkflowsProcessed = 0;

    while (hasMore) {
      console.log(`Fetching workflows batch: offset=${offset}, limit=${BATCH_SIZE}`);

      // Get active workflows for past-due invoices (NOT 'current' bucket)
      // Prioritize past-due invoices first
      const { data: workflows, error: workflowsError } = await supabaseAdmin
        .from('ai_workflows')
        .select(`
          id,
          invoice_id,
          tone,
          cadence_days,
          user_id,
          invoices!inner (
            id,
            due_date,
            status,
            aging_bucket
          )
        `)
        .eq('is_active', true)
        .in('invoices.status', ['Open', 'InPaymentPlan'])
        .neq('invoices.aging_bucket', 'current')  // Skip 'current' bucket - not past due yet
        .lte('invoices.due_date', todayStr)  // Only past due or due today
        .range(offset, offset + BATCH_SIZE - 1)
        .order('invoices(due_date)', { ascending: true });  // Process oldest first

      if (workflowsError) {
        console.error('Error fetching workflows:', workflowsError);
        throw workflowsError;
      }

      const batchCount = workflows?.length || 0;
      console.log(`Processing batch of ${batchCount} workflows`);

      if (batchCount === 0) {
        hasMore = false;
        break;
      }

      // Process each workflow in this batch
      for (const workflow of workflows || []) {
        const invoice = workflow.invoices as any;
        result.processed++;

        // Skip non-eligible invoices
        if (!invoice || (invoice.status !== 'Open' && invoice.status !== 'InPaymentPlan')) {
          console.log(`Skipping invoice ${invoice?.id}: status is ${invoice?.status}`);
          result.skipped++;
          continue;
        }

        // Skip current bucket invoices - they're not past due yet
        if (invoice.aging_bucket === 'current') {
          console.log(`Skipping invoice ${invoice.id}: aging_bucket is 'current' (not past due)`);
          result.skipped++;
          continue;
        }

        const dueDate = new Date(invoice.due_date);
        const cadenceDays = workflow.cadence_days as number[];

        // Skip if no cadence days (shouldn't happen with trigger, but be safe)
        if (!cadenceDays || cadenceDays.length === 0) {
          console.log(`Skipping workflow ${workflow.id}: empty cadence_days`);
          result.skipped++;
          continue;
        }

        console.log(`Processing workflow ${workflow.id} for invoice ${invoice.id}, cadence: ${JSON.stringify(cadenceDays)}`);

        // Find the first step that needs a draft
        for (let i = 0; i < cadenceDays.length; i++) {
          const cadenceDay = cadenceDays[i];
          const stepNumber = i + 1;

          // Calculate target date for this step
          const targetDate = new Date(dueDate);
          targetDate.setDate(targetDate.getDate() + cadenceDay);
          targetDate.setHours(0, 0, 0, 0);

          // Check if target date is today OR in the past
          if (targetDate.getTime() <= today.getTime()) {
            // Check if draft already exists for this step
            const { data: existingDrafts } = await supabaseAdmin
              .from('ai_drafts')
              .select('id')
              .eq('invoice_id', invoice.id)
              .eq('step_number', stepNumber)
              .limit(1);

            if (existingDrafts && existingDrafts.length > 0) {
              continue; // Already has draft for this step
            }

            // Check if outreach was already sent for this step
            const { data: existingLogs } = await supabaseAdmin
              .from('outreach_logs')
              .select('id, step_number')
              .eq('invoice_id', invoice.id);

            const stepAlreadySent = existingLogs?.some(log => log.step_number === stepNumber);
            if (stepAlreadySent) {
              continue; // Already sent for this step
            }

            // Generate the draft
            console.log(`Generating draft for invoice ${invoice.id}, step ${stepNumber}`);

            try {
              // Fetch invoice details
              const { data: invoiceData, error: invoiceError } = await supabaseAdmin
                .from('invoices')
                .select(`
                  id, invoice_number, amount, due_date, aging_bucket, user_id,
                  debtors (id, name, company_name, email)
                `)
                .eq('id', invoice.id)
                .single();

              if (invoiceError || !invoiceData) {
                throw new Error(`Failed to fetch invoice: ${invoiceError?.message || 'Not found'}`);
              }

              const debtor = invoiceData.debtors as any;
              const customerName = debtor?.company_name || debtor?.name || 'Customer';
              const invoiceAmount = invoiceData.amount || 0;

              // Try to get an approved template for this bucket and step
              const { data: templates } = await supabaseAdmin
                .from('draft_templates')
                .select('*')
                .eq('user_id', invoiceData.user_id)
                .eq('aging_bucket', invoiceData.aging_bucket)
                .eq('step_number', stepNumber)
                .eq('status', 'approved')
                .limit(1);

              let subject = '';
              let body = '';
              let useTemplate = false;

              if (templates && templates.length > 0) {
                const template = templates[0];
                subject = (template.subject || '')
                  .replace(/{{company_name}}/gi, customerName)
                  .replace(/{{invoice_number}}/gi, invoiceData.invoice_number || '')
                  .replace(/{{amount}}/gi, `$${invoiceAmount.toFixed(2)}`);
                body = (template.body || '')
                  .replace(/{{company_name}}/gi, customerName)
                  .replace(/{{invoice_number}}/gi, invoiceData.invoice_number || '')
                  .replace(/{{amount}}/gi, `$${invoiceAmount.toFixed(2)}`);
                useTemplate = true;
              } else {
                // Generate a simple default message
                subject = `Payment Reminder: Invoice ${invoiceData.invoice_number}`;
                body = `Dear ${customerName},\n\nThis is a reminder regarding invoice ${invoiceData.invoice_number} for $${invoiceAmount.toFixed(2)} which is past due.\n\nPlease arrange payment at your earliest convenience.\n\nThank you.`;
              }

              // Create the draft
              const { error: draftInsertError } = await supabaseAdmin
                .from('ai_drafts')
                .insert({
                  invoice_id: invoice.id,
                  user_id: invoiceData.user_id,
                  subject,
                  message_body: body,
                  step_number: stepNumber,
                  channel: 'email',
                  status: useTemplate ? 'approved' : 'pending_approval',
                  recommended_send_date: todayStr,
                  days_past_due: Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                });

              if (draftInsertError) {
                throw new Error(`Failed to create draft: ${draftInsertError.message}`);
              }

              console.log(`Created draft for invoice ${invoice.id}, step ${stepNumber}`);
              result.drafted++;

            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : 'Unknown error';
              console.error(`Error generating draft for invoice ${invoice.id}:`, errorMsg);
              
              result.failed++;
              result.errors.push({
                invoiceId: invoice.id,
                error: errorMsg,
                stepNumber
              });

              // Log error to outreach_errors table
              try {
                await supabaseAdmin
                  .from('outreach_errors')
                  .insert({
                    invoice_id: invoice.id,
                    workflow_id: workflow.id,
                    user_id: workflow.user_id,
                    error_type: 'draft_generation_failed',
                    error_message: errorMsg,
                    step_number: stepNumber,
                    metadata: { cadence_day: cadenceDay, target_date: targetDate.toISOString() }
                  });
              } catch (logErr) {
                console.error('Failed to log error:', logErr);
              }
            }

            // Only generate one draft per invoice per run
            break;
          }
        }
      }

      totalWorkflowsProcessed += batchCount;
      offset += BATCH_SIZE;

      // If we got less than batch size, we're done
      if (batchCount < BATCH_SIZE) {
        hasMore = false;
      }

      // Safety limit: don't process more than 10,000 workflows in one run
      if (totalWorkflowsProcessed >= 10000) {
        console.log('Reached maximum workflows limit (10,000), stopping');
        hasMore = false;
      }
    }

    console.log(`Scheduler completed: processed=${result.processed}, drafted=${result.drafted}, failed=${result.failed}, skipped=${result.skipped}`);

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
        processed: result.processed,
        drafted: result.drafted,
        failed: result.failed,
        skipped: result.skipped,
        draftsSent: sentCount,
        errors: result.errors.slice(0, 20), // Limit error details in response
        sendErrors: sendErrors.length > 0 ? sendErrors : undefined,
        message: `Processed ${result.processed} workflows, created ${result.drafted} drafts, sent ${sentCount} emails, ${result.failed} errors`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in daily-cadence-scheduler:', error);
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
