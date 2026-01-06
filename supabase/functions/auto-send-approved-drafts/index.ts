// ⚠️ EMAIL DOMAIN WARNING ⚠️
// This function sends emails via Resend.
// The FROM email MUST use verified domain: send.inbound.services.recouply.ai
// DO NOT change to @recouply.ai - it will fail!
// See: supabase/functions/_shared/emailConfig.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { generateBrandedEmail, getEmailFromAddress } from "../_shared/emailSignature.ts";
import { getOutreachContacts } from "../_shared/contactUtils.ts";
import { INBOUND_EMAIL_DOMAIN } from "../_shared/emailConfig.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Replace template variables in subject and body
 */
function replaceTemplateVars(
  text: string, 
  invoice: any, 
  debtor: any, 
  branding: any,
  daysPastDue: number
): string {
  if (!text) return text;
  
  const customerName = debtor?.name || debtor?.company_name || 'Valued Customer';
  const invoiceNumber = invoice?.invoice_number || invoice?.reference_id || '';
  const amount = `$${(invoice?.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const dueDate = invoice?.due_date ? new Date(invoice.due_date).toLocaleDateString() : '';
  const paymentLink = branding?.stripe_payment_link || '';
  const invoiceLink = invoice?.integration_url || '';
  
  let result = text
    // Customer/Debtor name variations
    .replace(/\{\{customer_name\}\}/gi, customerName)
    .replace(/\{\{customer name\}\}/gi, customerName)
    .replace(/\{\{debtor_name\}\}/gi, customerName)
    .replace(/\{\{debtor name\}\}/gi, customerName)
    .replace(/\{\{company_name\}\}/gi, customerName)
    .replace(/\{\{company name\}\}/gi, customerName)
    .replace(/\{\{name\}\}/gi, customerName)
    // Invoice number variations
    .replace(/\{\{invoice_number\}\}/gi, invoiceNumber)
    .replace(/\{\{invoice number\}\}/gi, invoiceNumber)
    .replace(/\{\{invoiceNumber\}\}/gi, invoiceNumber)
    // Amount variations
    .replace(/\{\{amount\}\}/gi, amount)
    .replace(/\{\{balance\}\}/gi, amount)
    .replace(/\{\{total\}\}/gi, amount)
    .replace(/\{\{invoice_amount\}\}/gi, amount)
    // Due date variations
    .replace(/\{\{due_date\}\}/gi, dueDate)
    .replace(/\{\{due date\}\}/gi, dueDate)
    .replace(/\{\{dueDate\}\}/gi, dueDate)
    // Days past due
    .replace(/\{\{days_past_due\}\}/gi, String(daysPastDue))
    .replace(/\{\{days past due\}\}/gi, String(daysPastDue))
    .replace(/\{\{daysPastDue\}\}/gi, String(daysPastDue))
    // Payment link variations
    .replace(/\{\{payment_link\}\}/gi, paymentLink)
    .replace(/\{\{payment link\}\}/gi, paymentLink)
    .replace(/\{\{paymentLink\}\}/gi, paymentLink)
    .replace(/\{\{pay_link\}\}/gi, paymentLink)
    .replace(/\{\{stripe_link\}\}/gi, paymentLink)
    // Invoice link variations (external system link)
    .replace(/\{\{invoice_link\}\}/gi, invoiceLink)
    .replace(/\{\{invoice link\}\}/gi, invoiceLink)
    .replace(/\{\{invoiceLink\}\}/gi, invoiceLink)
    .replace(/\{\{external_link\}\}/gi, invoiceLink)
    .replace(/\{\{integration_url\}\}/gi, invoiceLink);
  
  // Auto-append invoice link if it exists and isn't already in the message
  if (invoiceLink && !result.includes(invoiceLink)) {
    result += `\n\nView your invoice: ${invoiceLink}`;
  }
  
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[AUTO-SEND] Starting auto-send approved drafts...');

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

    // Get all approved drafts that haven't been sent yet
    // Include drafts where recommended_send_date is today or in the past (catch-up)
    // Process in batches of 50 to avoid timeouts
    const today = new Date().toISOString().split('T')[0];
    const BATCH_SIZE = 50;
    
    const { data: approvedDrafts, error: draftsError } = await supabaseAdmin
      .from('ai_drafts')
      .select(`
        *,
        invoices!inner(
          id,
          status,
          due_date,
          aging_bucket,
          invoice_number,
          reference_id,
          amount,
          currency,
          user_id,
          integration_url,
          debtors!inner(
            id,
            name,
            company_name,
            email,
            phone
          )
        )
      `)
      .eq('status', 'approved')
      .is('sent_at', null)
      .lte('recommended_send_date', today)
      .order('recommended_send_date', { ascending: true })
      .limit(BATCH_SIZE);

    if (draftsError) {
      console.error('[AUTO-SEND] Error fetching approved drafts:', draftsError);
      throw draftsError;
    }

    console.log(`[AUTO-SEND] Found ${approvedDrafts?.length || 0} approved drafts to process`);

    let sentCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const draft of approvedDrafts || []) {
      const invoice = draft.invoices as any;
      const debtor = invoice?.debtors as any;
      
      // Only process Open or InPaymentPlan invoices - mark others as skipped
      if (invoice.status !== 'Open' && invoice.status !== 'InPaymentPlan') {
        console.log(`[AUTO-SEND] Skipping draft ${draft.id}: invoice ${invoice.id} status is ${invoice.status}`);
        
        // Mark draft as skipped so it doesn't keep appearing
        await supabaseAdmin
          .from('ai_drafts')
          .update({ 
            status: 'skipped',
            updated_at: new Date().toISOString()
          })
          .eq('id', draft.id);
        
        skippedCount++;
        continue;
      }

      // Validate we have debtor info
      if (!debtor || !debtor.id) {
        console.log(`[AUTO-SEND] Skipping draft ${draft.id}: no debtor found`);
        skippedCount++;
        continue;
      }

      console.log(`[AUTO-SEND] Processing draft ${draft.id} for invoice ${invoice.invoice_number}`);

      try {
        // Get outreach contacts for this debtor
        const outreachContacts = await getOutreachContacts(supabaseAdmin, debtor.id, debtor);
        const allEmails = outreachContacts.emails;

        if (allEmails.length === 0) {
          console.log(`[AUTO-SEND] Skipping draft ${draft.id}: no email addresses found for debtor ${debtor.id}`);
          skippedCount++;
          continue;
        }

        // Get effective account ID for branding
        const { data: effectiveAccountId } = await supabaseAdmin.rpc('get_effective_account_id', { 
          p_user_id: invoice.user_id 
        });
        const brandingOwnerId = effectiveAccountId || invoice.user_id;

        // Fetch branding settings
        const { data: branding } = await supabaseAdmin
          .from("branding_settings")
          .select("logo_url, business_name, from_name, email_signature, email_footer, primary_color, ar_page_public_token, ar_page_enabled, stripe_payment_link")
          .eq("user_id", brandingOwnerId)
          .single();

        // Generate the From address using company name
        const fromEmail = getEmailFromAddress(branding || {});
        
        // Reply-to is based on invoice for routing inbound responses
        const replyToAddress = `invoice+${invoice.id}@${INBOUND_EMAIL_DOMAIN}`;

        // Calculate days past due for template replacement
        const dueDate = new Date(invoice.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysPastDue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

        // Replace template variables in draft content
        const processedSubject = replaceTemplateVars(draft.subject || 'Payment Reminder', invoice, debtor, branding, daysPastDue);
        const processedBody = replaceTemplateVars(draft.message_body, invoice, debtor, branding, daysPastDue);

        // Format message body with line breaks
        const formattedBody = processedBody.replace(/\n/g, "<br>");

        // Build fully branded email with signature and payment link
        const emailHtml = generateBrandedEmail(
          formattedBody,
          branding || {},
          {
            invoiceId: invoice.id,
            amount: invoice.amount,
          }
        );

        console.log(`[AUTO-SEND] Sending email from ${fromEmail} to ${allEmails.join(', ')}`);

        // Send email via platform send-email function
        const sendEmailResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              to: allEmails,
              from: fromEmail,
              reply_to: replyToAddress,
              subject: processedSubject,
              html: emailHtml,
            }),
          }
        );

        const emailResult = await sendEmailResponse.json();

        if (!sendEmailResponse.ok) {
          console.error(`[AUTO-SEND] Email send error for draft ${draft.id}:`, emailResult);
          errors.push(`Draft ${draft.id}: ${emailResult.error || 'Email send failed'}`);
          continue;
        }

        console.log(`[AUTO-SEND] Email sent successfully for draft ${draft.id}`);

        // Log the outreach
        await supabaseAdmin.from("outreach_logs").insert({
          user_id: invoice.user_id,
          invoice_id: invoice.id,
          debtor_id: debtor.id,
          channel: draft.channel || 'email',
          subject: processedSubject,
          message_body: processedBody,
          sent_to: allEmails.join(', '),
          sent_from: fromEmail,
          status: "sent",
          sent_at: new Date().toISOString(),
          delivery_metadata: {
            draft_id: draft.id,
            reply_to: replyToAddress,
            platform_send: true,
            recipients_count: allEmails.length,
            auto_sent: true,
          },
        });

        // Log collection activity
        await supabaseAdmin.from("collection_activities").insert({
          user_id: invoice.user_id,
          debtor_id: debtor.id,
          invoice_id: invoice.id,
          linked_draft_id: draft.id,
          activity_type: "outreach",
          direction: "outbound",
          channel: "email",
          subject: processedSubject,
          message_body: processedBody,
          sent_at: new Date().toISOString(),
          metadata: {
            from_email: fromEmail,
            from_name: branding?.business_name || "Recouply.ai",
            reply_to_email: replyToAddress,
            platform_send: true,
            auto_sent: true,
            recipients: allEmails,
          },
        });

        // Update invoice last_contact_date
        await supabaseAdmin
          .from("invoices")
          .update({ last_contact_date: new Date().toISOString().split('T')[0] })
          .eq("id", invoice.id);

        // Mark draft as sent with status and timestamp
        await supabaseAdmin
          .from('ai_drafts')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', draft.id);

        sentCount++;
        console.log(`[AUTO-SEND] Successfully processed draft ${draft.id} for invoice ${invoice.invoice_number}`);

      } catch (error) {
        console.error(`[AUTO-SEND] Exception processing draft ${draft.id}:`, error);
        errors.push(`Draft ${draft.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`[AUTO-SEND] Completed: ${sentCount} drafts sent, ${skippedCount} skipped, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        skipped: skippedCount,
        errors: errors.length > 0 ? errors : undefined,
        message: `Sent ${sentCount} approved drafts, skipped ${skippedCount}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[AUTO-SEND] Error in auto-send-approved-drafts:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
