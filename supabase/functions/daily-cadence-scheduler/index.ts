import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessingResult {
  totalWorkflows: number;
  processed: number;
  draftsCreated: number;
  draftsSkippedExisting: number;
  failed: number;
  skipped: number;
  errors: Array<{ invoiceId: string; error: string; stepNumber?: number }>;
}

// Priority order for processing (oldest/highest priority first)
const BUCKET_PRIORITY: Record<string, number> = {
  'dpd_150_plus': 1,
  'dpd_121_150': 2,
  'dpd_91_120': 3,
  'dpd_61_90': 4,
  'dpd_31_60': 5,
  'dpd_1_30': 6,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const result: ProcessingResult = {
    totalWorkflows: 0,
    processed: 0,
    draftsCreated: 0,
    draftsSkippedExisting: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    console.log('[CADENCE-SCHEDULER] Starting comprehensive draft generation...');

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

    // Process ALL active workflows in batches, ordered by priority
    const BATCH_SIZE = 100;
    let offset = 0;
    let hasMore = true;
    let allWorkflows: any[] = [];

    console.log('[CADENCE-SCHEDULER] Fetching all active workflows in batches...');

    while (hasMore) {
      const { data: batch, error: batchError } = await supabaseAdmin
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
            aging_bucket,
            invoice_number,
            reference_id,
            amount,
            outreach_paused,
            integration_url,
            user_id,
            debtors!inner (
              id,
              name,
              company_name,
              email,
              outreach_paused
            )
          )
        `)
        .eq('is_active', true)
        .in('invoices.status', ['Open', 'InPaymentPlan'])
        .neq('invoices.aging_bucket', 'current')
        .eq('invoices.outreach_paused', false)
        .range(offset, offset + BATCH_SIZE - 1);

      if (batchError) {
        console.error('[CADENCE-SCHEDULER] Error fetching batch:', batchError);
        throw batchError;
      }

      const batchCount = batch?.length || 0;
      console.log(`[CADENCE-SCHEDULER] Batch ${Math.floor(offset / BATCH_SIZE) + 1}: ${batchCount} workflows`);

      if (batchCount === 0) {
        hasMore = false;
        break;
      }

      // Filter out workflows where debtor has outreach paused
      const filtered = batch.filter(wf => {
        const invoice = wf.invoices as any;
        const debtor = invoice?.debtors as any;
        return !debtor?.outreach_paused;
      });

      allWorkflows = [...allWorkflows, ...filtered];
      offset += BATCH_SIZE;

      if (batchCount < BATCH_SIZE) {
        hasMore = false;
      }

      // Safety limit
      if (allWorkflows.length >= 10000) {
        console.log('[CADENCE-SCHEDULER] Reached safety limit of 10,000 workflows');
        hasMore = false;
      }
    }

    console.log(`[CADENCE-SCHEDULER] Total workflows to process: ${allWorkflows.length}`);
    result.totalWorkflows = allWorkflows.length;

    // Sort by priority (oldest/highest priority buckets first)
    allWorkflows.sort((a, b) => {
      const invoiceA = a.invoices as any;
      const invoiceB = b.invoices as any;
      const priorityA = BUCKET_PRIORITY[invoiceA?.aging_bucket] || 99;
      const priorityB = BUCKET_PRIORITY[invoiceB?.aging_bucket] || 99;
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // Secondary sort by due date (oldest first)
      return new Date(invoiceA?.due_date).getTime() - new Date(invoiceB?.due_date).getTime();
    });

    // Process workflows
    for (const workflow of allWorkflows) {
      const invoice = workflow.invoices as any;
      const debtor = invoice?.debtors as any;
      result.processed++;

      // Skip invalid invoices
      if (!invoice || (invoice.status !== 'Open' && invoice.status !== 'InPaymentPlan')) {
        result.skipped++;
        continue;
      }

      // Skip if no cadence days
      const cadenceDays = workflow.cadence_days as number[];
      if (!cadenceDays || cadenceDays.length === 0) {
        console.log(`[CADENCE-SCHEDULER] Skipping workflow ${workflow.id}: empty cadence_days`);
        
        // Log this error
        await supabaseAdmin.from('outreach_errors').insert({
          invoice_id: invoice.id,
          workflow_id: workflow.id,
          user_id: workflow.user_id,
          error_type: 'empty_cadence_days',
          error_message: 'Workflow has no cadence_days configured',
          metadata: { cadence_days: cadenceDays }
        });
        
        result.skipped++;
        continue;
      }

      const dueDate = new Date(invoice.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      // Find which cadence steps need drafts
      for (let i = 0; i < cadenceDays.length; i++) {
        const cadenceDay = cadenceDays[i];
        const stepNumber = i + 1;

        // Calculate target date for this step
        const targetDate = new Date(dueDate);
        targetDate.setDate(targetDate.getDate() + cadenceDay);
        targetDate.setHours(0, 0, 0, 0);

        // Check if target date is today OR in the past (catch-up mode)
        if (targetDate.getTime() <= today.getTime()) {
          try {
            // Check if draft already exists for this step
            const { data: existingDrafts } = await supabaseAdmin
              .from('ai_drafts')
              .select('id, status')
              .eq('invoice_id', invoice.id)
              .eq('step_number', stepNumber)
              .limit(1);

            if (existingDrafts && existingDrafts.length > 0) {
              result.draftsSkippedExisting++;
              continue;
            }

            // Check if outreach was already sent for this step
            const { data: existingLogs } = await supabaseAdmin
              .from('outreach_logs')
              .select('id, step_number')
              .eq('invoice_id', invoice.id);

            const stepAlreadySent = existingLogs?.some(log => log.step_number === stepNumber);
            if (stepAlreadySent) {
              result.draftsSkippedExisting++;
              continue;
            }

            // Try to get an approved template for this bucket and step
            const { data: templates } = await supabaseAdmin
              .from('draft_templates')
              .select('*')
              .eq('user_id', invoice.user_id)
              .eq('aging_bucket', invoice.aging_bucket)
              .eq('step_number', stepNumber)
              .eq('status', 'approved')
              .limit(1);

            let subject = '';
            let body = '';
            let useTemplate = false;

            const customerName = debtor?.company_name || debtor?.name || 'Customer';
            const invoiceNumber = invoice.invoice_number || invoice.reference_id || '';
            const invoiceAmount = invoice.amount || 0;
            const invoiceLink = invoice.integration_url || '';

            if (templates && templates.length > 0) {
              const template = templates[0];
              subject = (template.subject || '')
                .replace(/{{company_name}}/gi, customerName)
                .replace(/{{customer_name}}/gi, customerName)
                .replace(/{{invoice_number}}/gi, invoiceNumber)
                .replace(/{{amount}}/gi, `$${invoiceAmount.toFixed(2)}`)
                .replace(/{{invoice_link}}/gi, invoiceLink);
              body = (template.body || '')
                .replace(/{{company_name}}/gi, customerName)
                .replace(/{{customer_name}}/gi, customerName)
                .replace(/{{invoice_number}}/gi, invoiceNumber)
                .replace(/{{amount}}/gi, `$${invoiceAmount.toFixed(2)}`)
                .replace(/{{invoice_link}}/gi, invoiceLink);
              useTemplate = true;
            } else {
              // Generate default message based on step
              const stepMessages = [
                { subject: `Friendly Reminder: Invoice ${invoiceNumber}`, body: `Dear ${customerName},\n\nWe hope this message finds you well. This is a friendly reminder regarding invoice ${invoiceNumber} for $${invoiceAmount.toFixed(2)} which is now past due.\n\nPlease arrange payment at your earliest convenience.` },
                { subject: `Payment Reminder: Invoice ${invoiceNumber}`, body: `Dear ${customerName},\n\nThis is a follow-up reminder regarding invoice ${invoiceNumber} for $${invoiceAmount.toFixed(2)}. Your account is now ${daysPastDue} days past due.\n\nPlease contact us if you have any questions about this invoice.` },
                { subject: `Important: Invoice ${invoiceNumber} Payment Required`, body: `Dear ${customerName},\n\nWe are reaching out regarding invoice ${invoiceNumber} for $${invoiceAmount.toFixed(2)}. This invoice is now significantly past due.\n\nPlease arrange payment promptly or contact us to discuss payment options.` },
                { subject: `Urgent: Invoice ${invoiceNumber} - Action Required`, body: `Dear ${customerName},\n\nDespite previous reminders, invoice ${invoiceNumber} for $${invoiceAmount.toFixed(2)} remains unpaid.\n\nPlease contact us immediately to avoid further collection actions.` },
                { subject: `Final Notice: Invoice ${invoiceNumber}`, body: `Dear ${customerName},\n\nThis is our final notice regarding invoice ${invoiceNumber} for $${invoiceAmount.toFixed(2)}.\n\nPlease make payment immediately or contact us to discuss your options.` },
              ];

              const messageIndex = Math.min(stepNumber - 1, stepMessages.length - 1);
              subject = stepMessages[messageIndex].subject;
              body = stepMessages[messageIndex].body;
            }

            // Append invoice link if available and not already in body
            if (invoiceLink && !body.includes(invoiceLink)) {
              body += `\n\nView your invoice: ${invoiceLink}`;
            }

            body += '\n\nThank you for your business.';

            // Create the draft
            const { error: draftError } = await supabaseAdmin
              .from('ai_drafts')
              .insert({
                invoice_id: invoice.id,
                user_id: invoice.user_id,
                subject,
                message_body: body,
                step_number: stepNumber,
                channel: 'email',
                status: useTemplate ? 'approved' : 'pending_approval',
                recommended_send_date: todayStr,
                days_past_due: daysPastDue
              });

            if (draftError) {
              throw new Error(`Draft insert failed: ${draftError.message}`);
            }

            console.log(`[CADENCE-SCHEDULER] Created draft for invoice ${invoice.id}, step ${stepNumber}`);
            result.draftsCreated++;

          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            console.error(`[CADENCE-SCHEDULER] Error for invoice ${invoice.id} step ${stepNumber}:`, errorMsg);
            
            result.failed++;
            result.errors.push({
              invoiceId: invoice.id,
              error: errorMsg,
              stepNumber
            });

            // Log to outreach_errors table
            try {
              await supabaseAdmin.from('outreach_errors').insert({
                invoice_id: invoice.id,
                workflow_id: workflow.id,
                user_id: workflow.user_id,
                error_type: 'draft_generation_failed',
                error_message: errorMsg,
                step_number: stepNumber,
                metadata: { cadence_day: cadenceDay }
              });
            } catch (logErr) {
              console.error('[CADENCE-SCHEDULER] Failed to log error:', logErr);
            }
          }

          // Only generate one draft per invoice per run (the earliest missing step)
          break;
        }
      }
    }

    console.log(`[CADENCE-SCHEDULER] Draft generation complete. Triggering auto-send...`);

    // Trigger auto-send for approved drafts
    let sentCount = 0;
    let sendErrors: string[] = [];
    
    try {
      const { data: sendResult, error: sendError } = await supabaseAdmin.functions.invoke(
        'auto-send-approved-drafts',
        { body: {} }
      );
      
      if (sendError) {
        console.error('[CADENCE-SCHEDULER] Auto-send error:', sendError);
        sendErrors.push(sendError.message || 'Auto-send failed');
      } else {
        sentCount = sendResult?.sent || 0;
        console.log(`[CADENCE-SCHEDULER] Auto-send result: ${sentCount} drafts sent`);
      }
    } catch (err) {
      console.error('[CADENCE-SCHEDULER] Auto-send exception:', err);
      sendErrors.push(err instanceof Error ? err.message : 'Unknown error');
    }

    const summary = {
      success: true,
      totalWorkflows: result.totalWorkflows,
      processed: result.processed,
      draftsCreated: result.draftsCreated,
      draftsSkippedExisting: result.draftsSkippedExisting,
      failed: result.failed,
      skipped: result.skipped,
      draftsSent: sentCount,
      errors: result.errors.slice(0, 20),
      sendErrors: sendErrors.length > 0 ? sendErrors : undefined,
      message: `Processed ${result.processed} workflows, created ${result.draftsCreated} drafts, sent ${sentCount} emails, ${result.failed} errors`
    };

    console.log('[CADENCE-SCHEDULER] Summary:', summary);

    return new Response(
      JSON.stringify(summary),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[CADENCE-SCHEDULER] Fatal error:', error);
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
