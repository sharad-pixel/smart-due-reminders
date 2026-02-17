/**
 * Scheduled Outreach Engine
 * 
 * A unified engine that:
 * 1. Generates drafts for the next 7 days
 * 2. Sends approved drafts due today
 * 3. Cancels pending outreach when payment is received
 * 
 * Runs daily via cron job to maintain outreach cadence
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EngineResult {
  phase: string;
  draftsGenerated: number;
  draftsSent: number;
  draftsCancelled: number;
  invoicesProcessed: number;
  errors: string[];
}

// Terminal invoice statuses that should cancel outreach
// Note: Only using valid enum values - 'paid', 'canceled', 'voided' are lowercase variants
const TERMINAL_STATUSES = ['Paid', 'Canceled', 'Voided', 'paid', 'canceled', 'voided', 'cancelled', 'void'];

// Active statuses that allow outreach
const ACTIVE_STATUSES = ['Open', 'InPaymentPlan', 'PartiallyPaid'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const result: EngineResult = {
    phase: 'initializing',
    draftsGenerated: 0,
    draftsSent: 0,
    draftsCancelled: 0,
    invoicesProcessed: 0,
    errors: [],
  };

  try {
    console.log('[OUTREACH-ENGINE] Starting scheduled outreach engine...');

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

    // ============================================================
    // PHASE 1: Cancel outreach for paid/terminal invoices
    // ============================================================
    result.phase = 'cancelling_paid_invoices';
    console.log('[OUTREACH-ENGINE] Phase 1: Cancelling outreach for paid invoices...');

    // Find all pending/approved drafts where the invoice is now paid or terminal
    const { data: draftsToCancel, error: cancelFetchError } = await supabaseAdmin
      .from('ai_drafts')
      .select(`
        id,
        invoice_id,
        status,
        invoices!inner (
          id,
          status,
          invoice_number
        )
      `)
      .in('status', ['pending_approval', 'approved'])
      .is('sent_at', null)
      .in('invoices.status', TERMINAL_STATUSES)
      .limit(500);

    if (cancelFetchError) {
      console.error('[OUTREACH-ENGINE] Error fetching drafts to cancel:', cancelFetchError);
      result.errors.push(`Cancel fetch error: ${cancelFetchError.message}`);
    } else if (draftsToCancel && draftsToCancel.length > 0) {
      console.log(`[OUTREACH-ENGINE] Found ${draftsToCancel.length} drafts to cancel (invoice paid/terminal)`);

      // Batch update all drafts to cancelled status
      const draftIds = draftsToCancel.map(d => d.id);
      const { error: cancelError } = await supabaseAdmin
        .from('ai_drafts')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .in('id', draftIds);

      if (cancelError) {
        console.error('[OUTREACH-ENGINE] Error cancelling drafts:', cancelError);
        result.errors.push(`Cancel update error: ${cancelError.message}`);
      } else {
        result.draftsCancelled = draftIds.length;
        console.log(`[OUTREACH-ENGINE] Cancelled ${draftIds.length} drafts`);

        // Log cancellation activities
        for (const draft of draftsToCancel) {
          const invoice = draft.invoices as any;
          console.log(`[OUTREACH-ENGINE] Cancelled draft ${draft.id} - invoice ${invoice?.invoice_number} is ${invoice?.status}`);
        }
      }
    } else {
      console.log('[OUTREACH-ENGINE] No drafts to cancel');
    }

    // Also deactivate invoice_outreach records for paid invoices
    // First get the invoice IDs that are terminal
    const { data: terminalInvoices } = await supabaseAdmin
      .from('invoices')
      .select('id')
      .in('status', TERMINAL_STATUSES)
      .limit(1000);

    if (terminalInvoices && terminalInvoices.length > 0) {
      const terminalInvoiceIds = terminalInvoices.map(i => i.id);
      const { error: deactivateError } = await supabaseAdmin
        .from('invoice_outreach')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('is_active', true)
        .in('invoice_id', terminalInvoiceIds);

      if (deactivateError) {
        console.error('[OUTREACH-ENGINE] Error deactivating outreach records:', deactivateError);
      }
    }

    // ============================================================
    // PHASE 2: Generate drafts for next 7 days
    // ============================================================
    result.phase = 'generating_drafts';
    console.log('[OUTREACH-ENGINE] Phase 2: Generating drafts for next 7 days...');

    // Calculate date range for next 7 days
    const next7Days: string[] = [];
    for (let i = 0; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      next7Days.push(date.toISOString().split('T')[0]);
    }

    // Fetch all active workflows with their invoices
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
            aging_bucket,
            bucket_entered_at,
            invoice_number,
            reference_id,
            amount,
            currency,
            outreach_paused,
            user_id,
            integration_url,
            external_link,
            stripe_hosted_url,
            product_description,
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
      .in('invoices.status', ACTIVE_STATUSES)
      .neq('invoices.aging_bucket', 'current')
      .eq('invoices.outreach_paused', false)
      .limit(2000);

    if (workflowsError) {
      console.error('[OUTREACH-ENGINE] Error fetching workflows:', workflowsError);
      result.errors.push(`Workflow fetch error: ${workflowsError.message}`);
    } else {
      console.log(`[OUTREACH-ENGINE] Found ${workflows?.length || 0} active workflows`);

      for (const workflow of workflows || []) {
        const invoice = workflow.invoices as any;
        const debtor = invoice?.debtors as any;
        result.invoicesProcessed++;

        // Skip if debtor has outreach paused
        if (debtor?.outreach_paused) continue;

        // Skip if no cadence days configured
        const cadenceDays = workflow.cadence_days as number[];
        if (!cadenceDays || cadenceDays.length === 0) continue;

        // Calculate days since bucket entered
        const bucketEnteredAt = invoice.bucket_entered_at 
          ? new Date(invoice.bucket_entered_at)
          : new Date(invoice.due_date);
        bucketEnteredAt.setHours(0, 0, 0, 0);

        // Calculate days past due
        const dueDate = new Date(invoice.due_date);
        dueDate.setHours(0, 0, 0, 0);

        // Check each of the next 7 days to see if it's a cadence day
        for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
          const targetDate = new Date(today);
          targetDate.setDate(targetDate.getDate() + dayOffset);
          const targetDateStr = targetDate.toISOString().split('T')[0];

          const daysInBucket = Math.floor((targetDate.getTime() - bucketEnteredAt.getTime()) / (1000 * 60 * 60 * 24));
          const daysPastDue = Math.floor((targetDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          // Check if this day matches a cadence day
          const cadenceDayIndex = cadenceDays.indexOf(daysInBucket);
          if (cadenceDayIndex === -1) continue;

          const stepNumber = cadenceDayIndex + 1;

          // Check if draft already exists for this invoice/step
          const { data: existingDraft } = await supabaseAdmin
            .from('ai_drafts')
            .select('id')
            .eq('invoice_id', invoice.id)
            .eq('step_number', stepNumber)
            .maybeSingle();

          if (existingDraft) continue; // Draft already exists

          // Get branding settings
          const { data: effectiveAccountId } = await supabaseAdmin.rpc('get_effective_account_id', { 
            p_user_id: invoice.user_id 
          });
          const brandingOwnerId = effectiveAccountId || invoice.user_id;

          const { data: branding } = await supabaseAdmin
            .from('branding_settings')
            .select('business_name, from_name, stripe_payment_link, ar_page_public_token, ar_page_enabled, email_signature, auto_approve_drafts')
            .eq('user_id', brandingOwnerId)
            .maybeSingle();

          // Check if workflow template is approved and fetch its steps
          const { data: collectionWorkflow } = await supabaseAdmin
            .from('collection_workflows')
            .select('id, is_template_approved, persona_id')
            .eq('aging_bucket', invoice.aging_bucket)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

          const isWorkflowApproved = collectionWorkflow?.is_template_approved === true;

          // Fetch the approved workflow step template for this step number
          let workflowStepTemplate: any = null;
          if (collectionWorkflow?.id) {
            const { data: stepData } = await supabaseAdmin
              .from('collection_workflow_steps')
              .select('subject_template, body_template, channel, label')
              .eq('workflow_id', collectionWorkflow.id)
              .eq('step_order', stepNumber)
              .eq('is_active', true)
              .maybeSingle();
            workflowStepTemplate = stepData;
          }

          // Build email content
          const customerName = debtor?.company_name || debtor?.name || 'Valued Customer';
          const invoiceNumber = invoice.invoice_number || invoice.reference_id || '';
          const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency || 'USD', minimumFractionDigits: 2 }).format(invoice.amount || 0);
          const invoiceLink = invoice.external_link || invoice.stripe_hosted_url || invoice.integration_url || '';
          // CRITICAL: Use proper fallback chain for business name
          const businessName = branding?.business_name?.trim() || branding?.from_name?.trim() || 'Your Company';
          const paymentLink = branding?.stripe_payment_link || '';
          const arPageUrl = branding?.ar_page_public_token && branding?.ar_page_enabled 
            ? `https://recouply.ai/ar/${branding.ar_page_public_token}` 
            : '';

          let subject: string;
          let body: string;

          if (workflowStepTemplate?.body_template && workflowStepTemplate?.subject_template) {
            // USE the pre-approved workflow step template
            console.log(`[OUTREACH-ENGINE] Using workflow step template "${workflowStepTemplate.label}" for invoice ${invoiceNumber}, step ${stepNumber}`);
            
            // Replace template variables in the approved template
            const replaceVars = (text: string) => text
              .replace(/\{\{customer_name\}\}/gi, customerName)
              .replace(/\{\{debtor_name\}\}/gi, customerName)
              .replace(/\{\{name\}\}/gi, customerName)
              .replace(/\{\{invoice_number\}\}/gi, invoiceNumber)
              .replace(/\{\{amount\}\}/gi, formattedAmount)
              .replace(/\{\{due_date\}\}/gi, invoice.due_date || '')
              .replace(/\{\{days_past_due\}\}/gi, String(daysPastDue))
              .replace(/\{\{company_name\}\}/gi, businessName)
              .replace(/\{\{business_name\}\}/gi, businessName)
              .replace(/\{\{payment_link\}\}/gi, paymentLink)
              .replace(/\{\{invoice_link\}\}/gi, invoiceLink)
              .replace(/\{\{ar_page_url\}\}/gi, arPageUrl)
              // Clean up any remaining unresolved placeholders
              .replace(/\{\{[^}]+\}\}/g, '');

            subject = replaceVars(workflowStepTemplate.subject_template);
            body = replaceVars(workflowStepTemplate.body_template);
          } else {
            // Fallback: generic messages if no workflow step template exists
            console.log(`[OUTREACH-ENGINE] No workflow step template found for invoice ${invoiceNumber}, step ${stepNumber} - using fallback`);
            const stepMessages = [
              { subject: `Friendly Reminder: Invoice ${invoiceNumber}`, body: `Dear ${customerName},\n\nThis is a friendly reminder regarding invoice ${invoiceNumber} for ${formattedAmount} which is now past due.\n\nPlease arrange payment at your earliest convenience.` },
              { subject: `Payment Reminder: Invoice ${invoiceNumber}`, body: `Dear ${customerName},\n\nThis is a follow-up reminder regarding invoice ${invoiceNumber} for ${formattedAmount}. Your account is now ${daysPastDue} days past due.\n\nPlease contact us if you have any questions.` },
              { subject: `Important: Invoice ${invoiceNumber} - Payment Required`, body: `Dear ${customerName},\n\nWe are reaching out regarding invoice ${invoiceNumber} for ${formattedAmount}. This invoice is now significantly past due.\n\nPlease arrange payment promptly.` },
            ];

            const messageIndex = Math.min(stepNumber - 1, stepMessages.length - 1);
            subject = stepMessages[messageIndex].subject;
            body = stepMessages[messageIndex].body;
          }

          // Append links if not already in template body
          if (arPageUrl && !body.includes(arPageUrl)) body += `\n\n📄 Access your account portal: ${arPageUrl}`;
          if (invoiceLink && !body.includes(invoiceLink)) body += `\n\nView your invoice: ${invoiceLink}`;
          if (paymentLink && !body.includes(paymentLink)) body += `\n\n💳 Make a payment: ${paymentLink}`;
          if (!body.includes(businessName)) body += `\n\nThank you for your business.\n\n---\n${businessName}`;

          // Create the draft - auto-approve if workflow is approved OR user has auto_approve_drafts enabled
          const shouldAutoApprove = isWorkflowApproved || branding?.auto_approve_drafts === true;
          const draftStatus = shouldAutoApprove ? 'approved' : 'pending_approval';
          const { error: draftError } = await supabaseAdmin
            .from('ai_drafts')
            .insert({
              invoice_id: invoice.id,
              user_id: invoice.user_id,
              subject,
              message_body: body,
              step_number: stepNumber,
              channel: 'email',
              status: draftStatus,
              recommended_send_date: targetDateStr,
              days_past_due: daysPastDue,
              auto_approved: shouldAutoApprove
            });

          if (draftError) {
            if (draftError.code !== '23505') { // Ignore duplicate key errors
              result.errors.push(`Draft create error for invoice ${invoice.id}: ${draftError.message}`);
            }
          } else {
            result.draftsGenerated++;
            console.log(`[OUTREACH-ENGINE] Created draft for invoice ${invoiceNumber}, step ${stepNumber}, scheduled for ${targetDateStr}`);
          }
        }
      }
    }

    console.log(`[OUTREACH-ENGINE] Generated ${result.draftsGenerated} new drafts`);

    // ============================================================
    // PHASE 3: Send approved drafts due today
    // ============================================================
    result.phase = 'sending_approved_drafts';
    console.log('[OUTREACH-ENGINE] Phase 3: Sending approved drafts due today...');

    try {
      const { data: sendResult, error: sendError } = await supabaseAdmin.functions.invoke(
        'auto-send-approved-drafts',
        { body: {} }
      );

      if (sendError) {
        console.error('[OUTREACH-ENGINE] Auto-send error:', sendError);
        result.errors.push(`Auto-send error: ${sendError.message}`);
      } else {
        result.draftsSent = sendResult?.sent || 0;
        console.log(`[OUTREACH-ENGINE] Sent ${result.draftsSent} approved drafts`);
      }
    } catch (err) {
      console.error('[OUTREACH-ENGINE] Auto-send exception:', err);
      result.errors.push(`Auto-send exception: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    // ============================================================
    // PHASE 4: Final summary
    // ============================================================
    result.phase = 'complete';

    const summary = {
      success: true,
      ...result,
      message: `Outreach engine complete: ${result.draftsCancelled} cancelled, ${result.draftsGenerated} generated, ${result.draftsSent} sent`
    };

    console.log('[OUTREACH-ENGINE] Summary:', summary);

    return new Response(
      JSON.stringify(summary),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[OUTREACH-ENGINE] Fatal error:', error);
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
