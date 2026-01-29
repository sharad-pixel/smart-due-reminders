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
  draftsSkippedNotCadenceDay: number;
  failed: number;
  skipped: number;
  errors: Array<{ invoiceId: string; error: string; stepNumber?: number }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const result: ProcessingResult = {
    totalWorkflows: 0,
    processed: 0,
    draftsCreated: 0,
    draftsSkippedExisting: 0,
    draftsSkippedNotCadenceDay: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    console.log('[CADENCE-SCHEDULER] Starting daily draft generation (TODAY ONLY mode)...');

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

    // Process ALL active workflows in batches
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
            bucket_entered_at,
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
        result.skipped++;
        continue;
      }

      // Calculate days since invoice entered current aging bucket
      // This is the key change: we use bucket_entered_at, not due_date
      const bucketEnteredAt = invoice.bucket_entered_at 
        ? new Date(invoice.bucket_entered_at)
        : new Date(invoice.due_date);
      bucketEnteredAt.setHours(0, 0, 0, 0);
      
      const daysInBucket = Math.floor((today.getTime() - bucketEnteredAt.getTime()) / (1000 * 60 * 60 * 24));
      
      // Also calculate total days past due for messaging
      const dueDate = new Date(invoice.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      // Check if TODAY exactly matches a cadence day
      // cadenceDays is like [0, 7, 14] meaning "day 0 in bucket, day 7, day 14"
      const cadenceDayIndex = cadenceDays.indexOf(daysInBucket);
      
      if (cadenceDayIndex === -1) {
        // Today is NOT a cadence day - skip this invoice
        result.draftsSkippedNotCadenceDay++;
        continue;
      }

      const stepNumber = cadenceDayIndex + 1;

      try {
        // Check if the collection workflow is template-approved
        const { data: collectionWorkflow } = await supabaseAdmin
          .from('collection_workflows')
          .select('id, is_template_approved, persona_id')
          .eq('aging_bucket', invoice.aging_bucket)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        const isWorkflowApproved = collectionWorkflow?.is_template_approved === true;

        // Get branding settings for this user to get business name and payment link
        const { data: effectiveAccountId } = await supabaseAdmin.rpc('get_effective_account_id', { 
          p_user_id: invoice.user_id 
        });
        const brandingOwnerId = effectiveAccountId || invoice.user_id;

        const { data: branding } = await supabaseAdmin
          .from('branding_settings')
          .select('business_name, stripe_payment_link, ar_page_public_token, ar_page_enabled, escalation_contact_name, escalation_contact_email, escalation_contact_phone, email_signature, auto_approve_drafts')
          .eq('user_id', brandingOwnerId)
          .single();

        const businessName = branding?.business_name || 'Our Company';
        const paymentLink = branding?.stripe_payment_link || '';
        const arPageToken = branding?.ar_page_public_token;
        const arPageEnabled = branding?.ar_page_enabled === true;
        const arPageUrl = arPageToken && arPageEnabled ? `https://recouply.ai/ar/${arPageToken}` : '';
        
        // Build contact info section
        const contactName = branding?.escalation_contact_name || '';
        const contactEmail = branding?.escalation_contact_email || '';
        const contactPhone = branding?.escalation_contact_phone || '';
        const signature = branding?.email_signature || '';

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

        const customerName = debtor?.company_name || debtor?.name || 'Valued Customer';
        const invoiceNumber = invoice.invoice_number || invoice.reference_id || '';
        const invoiceAmount = invoice.amount || 0;
        const formattedAmount = `$${invoiceAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        const invoiceLink = invoice.integration_url || '';
        const formattedDueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '';
        const productDescription = invoice.product_description || '';

        // Helper function to replace all template variables
        const replaceTemplateVars = (text: string): string => {
          if (!text) return text;
          return text
            // Company/Business name (sender's company)
            .replace(/\{\{company_name\}\}/gi, businessName)
            .replace(/\{\{business_name\}\}/gi, businessName)
            // Customer/Debtor name (recipient)
            .replace(/\{\{customer_name\}\}/gi, customerName)
            .replace(/\{\{debtor_name\}\}/gi, customerName)
            .replace(/\{\{name\}\}/gi, customerName)
            // Invoice details
            .replace(/\{\{invoice_number\}\}/gi, invoiceNumber)
            .replace(/\{\{invoiceNumber\}\}/gi, invoiceNumber)
            .replace(/\{\{amount\}\}/gi, formattedAmount)
            .replace(/\{\{balance\}\}/gi, formattedAmount)
            .replace(/\{\{total\}\}/gi, formattedAmount)
            .replace(/\{\{invoice_amount\}\}/gi, formattedAmount)
            // Dates
            .replace(/\{\{due_date\}\}/gi, formattedDueDate)
            .replace(/\{\{dueDate\}\}/gi, formattedDueDate)
            .replace(/\{\{days_past_due\}\}/gi, String(daysPastDue))
            .replace(/\{\{daysPastDue\}\}/gi, String(daysPastDue))
            // Links
            .replace(/\{\{payment_link\}\}/gi, paymentLink)
            .replace(/\{\{paymentLink\}\}/gi, paymentLink)
            .replace(/\{\{pay_link\}\}/gi, paymentLink)
            .replace(/\{\{stripe_link\}\}/gi, paymentLink)
            .replace(/\{\{invoice_link\}\}/gi, invoiceLink)
            .replace(/\{\{invoiceLink\}\}/gi, invoiceLink)
            .replace(/\{\{external_link\}\}/gi, invoiceLink)
            .replace(/\{\{integration_url\}\}/gi, invoiceLink)
            // AR Portal link
            .replace(/\{\{ar_portal_link\}\}/gi, arPageUrl)
            .replace(/\{\{portal_link\}\}/gi, arPageUrl)
            // Product/Service description variations
            .replace(/\{\{product_description\}\}/gi, productDescription)
            .replace(/\{\{productDescription\}\}/gi, productDescription)
            .replace(/\{\{service_description\}\}/gi, productDescription)
            .replace(/\{\{description\}\}/gi, productDescription);
        };

        if (templates && templates.length > 0) {
          const template = templates[0];
          subject = replaceTemplateVars(template.subject || '');
          body = replaceTemplateVars(template.body || '');
          useTemplate = true;
        } else {
          // Generate default message based on step
          const stepMessages = [
            { subject: `Friendly Reminder: Invoice ${invoiceNumber}`, body: `Dear ${customerName},\n\nWe hope this message finds you well. This is a friendly reminder regarding invoice ${invoiceNumber} for ${formattedAmount} which is now past due.\n\nPlease arrange payment at your earliest convenience.` },
            { subject: `Payment Reminder: Invoice ${invoiceNumber}`, body: `Dear ${customerName},\n\nThis is a follow-up reminder regarding invoice ${invoiceNumber} for ${formattedAmount}. Your account is now ${daysPastDue} days past due.\n\nPlease contact us if you have any questions about this invoice.` },
            { subject: `Important: Invoice ${invoiceNumber} Payment Required`, body: `Dear ${customerName},\n\nWe are reaching out regarding invoice ${invoiceNumber} for ${formattedAmount}. This invoice is now significantly past due.\n\nPlease arrange payment promptly or contact us to discuss payment options.` },
            { subject: `Urgent: Invoice ${invoiceNumber} - Action Required`, body: `Dear ${customerName},\n\nDespite previous reminders, invoice ${invoiceNumber} for ${formattedAmount} remains unpaid.\n\nPlease contact us immediately to avoid further collection actions.` },
            { subject: `Final Notice: Invoice ${invoiceNumber}`, body: `Dear ${customerName},\n\nThis is our final notice regarding invoice ${invoiceNumber} for ${formattedAmount}.\n\nPlease make payment immediately or contact us to discuss your options.` },
          ];

          const messageIndex = Math.min(stepNumber - 1, stepMessages.length - 1);
          subject = stepMessages[messageIndex].subject;
          body = stepMessages[messageIndex].body;
        }

        // Append invoice link if available and not already in body
        if (invoiceLink && !body.includes(invoiceLink)) {
          body += `\n\nView your invoice: ${invoiceLink}`;
        }

        // Append AR portal link if available and enabled
        if (arPageUrl && !body.includes(arPageUrl)) {
          body += `\n\n📄 Access your account portal: ${arPageUrl}`;
        }

        // Append payment link if available
        if (paymentLink && !body.includes(paymentLink)) {
          body += `\n\n💳 Make a payment: ${paymentLink}`;
        }

        body += '\n\nThank you for your business.';

        // Add signature/contact info if available
        if (signature) {
          body += `\n\n---\n${signature}`;
        } else {
          // Build contact section from escalation contact
          let contactSection = '';
          if (contactName) contactSection += `\n${contactName}`;
          if (contactEmail) contactSection += `\nEmail: ${contactEmail}`;
          if (contactPhone) contactSection += `\nPhone: ${contactPhone}`;
          if (contactSection) {
            body += `\n\n---${contactSection}\n${businessName}`;
          } else {
            body += `\n\n---\n${businessName}`;
          }
        }

        // Determine draft status: auto-approve if workflow is approved, template is approved, OR user has auto_approve_drafts enabled
        const shouldAutoApprove = isWorkflowApproved || useTemplate || branding?.auto_approve_drafts === true;
        const draftStatus = shouldAutoApprove ? 'approved' : 'pending_approval';

        // Create the draft using UPSERT to handle race conditions
        // The unique constraint (invoice_id, step_number) will prevent duplicates
        const { error: draftError } = await supabaseAdmin
          .from('ai_drafts')
          .upsert({
            invoice_id: invoice.id,
            user_id: invoice.user_id,
            subject,
            message_body: body,
            step_number: stepNumber,
            channel: 'email',
            status: draftStatus,
            recommended_send_date: todayStr,
            days_past_due: daysPastDue,
            auto_approved: shouldAutoApprove
          }, {
            onConflict: 'invoice_id,step_number',
            ignoreDuplicates: true
          });

        if (draftError) {
          // If it's a unique violation, that's expected - draft already exists
          if (draftError.code === '23505') {
            console.log(`[CADENCE-SCHEDULER] Draft already exists for invoice ${invoice.id}, step ${stepNumber}`);
            result.draftsSkippedExisting++;
          } else {
            throw new Error(`Draft insert failed: ${draftError.message}`);
          }
        } else {
          console.log(`[CADENCE-SCHEDULER] Created draft for invoice ${invoice.id}, step ${stepNumber} (day ${daysInBucket} in bucket)`);
          result.draftsCreated++;
        }

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[CADENCE-SCHEDULER] Error for invoice ${invoice.id} step ${stepNumber}:`, errorMsg);
        
        result.failed++;
        result.errors.push({
          invoiceId: invoice.id,
          error: errorMsg,
          stepNumber
        });
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
      draftsSkippedNotCadenceDay: result.draftsSkippedNotCadenceDay,
      failed: result.failed,
      skipped: result.skipped,
      draftsSent: sentCount,
      errors: result.errors.slice(0, 20),
      sendErrors: sendErrors.length > 0 ? sendErrors : undefined,
      message: `Processed ${result.processed} workflows, created ${result.draftsCreated} drafts (${result.draftsSkippedNotCadenceDay} skipped - not cadence day), sent ${sentCount} emails`
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
