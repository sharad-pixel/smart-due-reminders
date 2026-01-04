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
    const todayStr = today.toISOString().split('T')[0];

    // Get active workflows for invoices that are due today or past due (prioritize these)
    // This avoids the 1000 row limit issue by filtering first
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
          status
        )
      `)
      .eq('is_active', true)
      .in('invoices.status', ['Open', 'InPaymentPlan'])
      .lte('invoices.due_date', todayStr)
      .limit(500);

    if (workflowsError) {
      console.error('Error fetching workflows:', workflowsError);
      throw workflowsError;
    }

    console.log(`Found ${workflows?.length || 0} active workflows for past due invoices`);

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

        // Calculate target date for this step
        const targetDate = new Date(dueDate);
        targetDate.setDate(targetDate.getDate() + cadenceDay);
        targetDate.setHours(0, 0, 0, 0);

        console.log(`Checking step ${stepNumber} (day ${cadenceDay}): target=${targetDate.toISOString()}, today=${today.toISOString()}`);

        // Check if target date is today OR in the past (to catch up on missed drafts)
        // Only generate for the first step that hasn't been processed yet
        if (targetDate.getTime() <= today.getTime()) {
          console.log(`Target date is today or past for step ${stepNumber}`);

          // Check if draft already exists for this step
          const { data: existingDrafts } = await supabaseAdmin
            .from('ai_drafts')
            .select('id')
            .eq('invoice_id', invoice.id)
            .eq('step_number', stepNumber)
            .limit(1);

          // Check if outreach was already sent for this invoice
          const { data: existingLogs } = await supabaseAdmin
            .from('outreach_logs')
            .select('id, step_number')
            .eq('invoice_id', invoice.id);

          if (existingDrafts && existingDrafts.length > 0) {
            console.log(`Draft already exists for step ${stepNumber}`);
            continue;
          }

          // Check if this step was already sent
          const stepAlreadySent = existingLogs?.some(log => log.step_number === stepNumber);
          if (stepAlreadySent) {
            console.log(`Outreach already sent for step ${stepNumber}`);
            continue;
          }

          // Generate the draft directly instead of calling edge function
          // This avoids auth issues when running as a scheduled job
          console.log(`Generating draft for invoice ${invoice.id}, step ${stepNumber}, tone ${workflow.tone}`);

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
              console.error(`Error fetching invoice ${invoice.id}:`, invoiceError);
              continue;
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
              // Replace placeholders
              subject = (template.subject || '').replace(/{{company_name}}/gi, customerName)
                .replace(/{{invoice_number}}/gi, invoiceData.invoice_number || '')
                .replace(/{{amount}}/gi, `$${invoiceAmount.toFixed(2)}`);
              body = (template.body || '').replace(/{{company_name}}/gi, customerName)
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
                recommended_send_date: new Date().toISOString().split('T')[0]
              });

            if (draftInsertError) {
              console.error(`Error creating draft for invoice ${invoice.id}:`, draftInsertError);
            } else {
              console.log(`Successfully created draft for invoice ${invoice.id}, step ${stepNumber}`);
              draftsCreated++;
            }
          } catch (err) {
            console.error(`Exception generating draft for invoice ${invoice.id}:`, err);
          }
          
          // Only generate the first missing draft per invoice to avoid flooding
          break;
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
