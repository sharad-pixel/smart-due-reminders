import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateBrandedEmail, getEmailFromAddress } from "../_shared/emailSignature.ts";
import { sanitizeSubjectLine } from "../_shared/draftContentEngine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Platform email configuration
const PLATFORM_INBOUND_DOMAIN = "inbound.services.recouply.ai";

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
  const amount = invoice?.amount
    ? `$${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    : '';
  const dueDate = invoice?.due_date ? new Date(invoice.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const paymentLink = branding?.stripe_payment_link || '';
  // Prefer Stripe hosted invoice URL / public link over internal dashboard URL
  const invoiceLink = invoice?.external_link || invoice?.stripe_hosted_url || invoice?.integration_url || '';
  const productDescription = invoice?.product_description || '';
  // CRITICAL: Get business name with proper fallback chain
  // Priority: business_name > from_name > 'Your Company' (never use empty string)
  const businessName = branding?.business_name?.trim() || branding?.from_name?.trim() || 'Your Company';
  const arPageUrl =
    branding?.ar_page_public_token && branding?.ar_page_enabled
      ? `https://recouply.ai/ar/${branding.ar_page_public_token}`
      : '';

  return text
    // Company/Business name (sender's company)
    .replace(/\{\{company_name\}\}/gi, businessName)
    .replace(/\{\{company name\}\}/gi, businessName)
    .replace(/\{\{business_name\}\}/gi, businessName)
    .replace(/\{\{business name\}\}/gi, businessName)
    // Customer/Debtor name variations (recipient)
    .replace(/\{\{customer_name\}\}/gi, customerName)
    .replace(/\{\{customer name\}\}/gi, customerName)
    .replace(/\{\{debtor_name\}\}/gi, customerName)
    .replace(/\{\{debtor name\}\}/gi, customerName)
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
    .replace(/\{\{amount_due\}\}/gi, amount)
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
    .replace(/\{\{integration_url\}\}/gi, invoiceLink)
    // AR Portal link
    .replace(/\{\{ar_portal_link\}\}/gi, arPageUrl)
    .replace(/\{\{portal_link\}\}/gi, arPageUrl)
    // Product/Service description variations
    .replace(/\{\{product_description\}\}/gi, productDescription)
    .replace(/\{\{product description\}\}/gi, productDescription)
    .replace(/\{\{productDescription\}\}/gi, productDescription)
    .replace(/\{\{service_description\}\}/gi, productDescription)
    .replace(/\{\{description\}\}/gi, productDescription);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { recipientEmail, subject, body, draftId, invoiceId, debtorId, paymentUrl, invoiceAmount } = await req.json();

    if (!recipientEmail || !subject || !body) {
      throw new Error("Missing required fields: recipientEmail, subject, body");
    }

    console.log(`Preparing to send collection email to: ${recipientEmail}`);

    // Determine reply-to address based on context (invoice or debtor level)
    let replyToEmail: string;
    if (invoiceId) {
      replyToEmail = `invoice+${invoiceId}@${PLATFORM_INBOUND_DOMAIN}`;
    } else if (debtorId) {
      replyToEmail = `debtor+${debtorId}@${PLATFORM_INBOUND_DOMAIN}`;
    } else {
      // Fallback to generic collections address
      replyToEmail = `collections@${PLATFORM_INBOUND_DOMAIN}`;
    }

    // Get effective account ID (for team member support)
    const { data: effectiveAccountId } = await supabaseClient.rpc('get_effective_account_id', { p_user_id: user.id });
    const brandingOwnerId = effectiveAccountId || user.id;

    // Fetch branding settings for signature and From name (using effective account)
    const { data: branding } = await supabaseClient
      .from("branding_settings")
      .select("logo_url, business_name, from_name, email_signature, email_footer, primary_color, ar_page_public_token, ar_page_enabled, stripe_payment_link")
      .eq("user_id", brandingOwnerId)
      .single();

    // Fetch invoice and debtor data for template replacement if invoiceId is provided
    let invoice: any = null;
    let debtor: any = null;
    let daysPastDue = 0;

    if (invoiceId) {
      const { data: invoiceData } = await supabaseClient
        .from("invoices")
        .select("id, invoice_number, reference_id, amount, currency, due_date, integration_url, stripe_hosted_url, external_link, product_description, debtor_id, debtors(id, name, company_name)")
        .eq("id", invoiceId)
        .single();

      if (invoiceData) {
        invoice = invoiceData;
        debtor = invoiceData.debtors;

        // Calculate days past due
        if (invoice.due_date) {
          const dueDate = new Date(invoice.due_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          dueDate.setHours(0, 0, 0, 0);
          daysPastDue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        }
      }
    } else if (debtorId) {
      // Fetch debtor directly if no invoice
      const { data: debtorData } = await supabaseClient
        .from("debtors")
        .select("id, name, company_name")
        .eq("id", debtorId)
        .single();

      if (debtorData) {
        debtor = debtorData;
      }
    }

    // Replace template variables in subject and body
    // CRITICAL: Sanitize subject to remove any URLs - they should only appear in email body
    const processedSubject = sanitizeSubjectLine(replaceTemplateVars(subject, invoice, debtor, branding, daysPastDue));
    const processedBody = replaceTemplateVars(body, invoice, debtor, branding, daysPastDue);

    // Generate the From address using company name
    const fromEmail = getEmailFromAddress(branding || {});

    console.log(`Sending email from: ${fromEmail}, reply-to: ${replyToEmail}`);

    // Build fully branded email with signature and optional payment link
    const emailHtml = generateBrandedEmail(
      processedBody,
      branding || {},
      {
        invoiceId,
        amount: invoiceAmount,
        paymentUrl,
      }
    );

    // Send email via platform send-email function
    const sendEmailResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({
          to: recipientEmail,
          from: fromEmail,
          reply_to: replyToEmail,
          subject: processedSubject,
          html: emailHtml,
        }),
      }
    );

    const sendResult = await sendEmailResponse.json();

    if (!sendEmailResponse.ok) {
      throw new Error(`Failed to send email: ${sendResult.error || "Unknown error"}`);
    }

    console.log("Email sent successfully via platform:", sendResult);

    // Log the collection activity with the PROCESSED body (for reference)
    if (draftId || invoiceId) {
      // Get debtor_id from invoice if not provided
      let finalDebtorId = debtorId;
      if (!finalDebtorId && invoice?.debtor_id) {
        finalDebtorId = invoice.debtor_id;
      } else if (!finalDebtorId && invoiceId) {
        const { data: inv } = await supabaseClient
          .from("invoices")
          .select("debtor_id")
          .eq("id", invoiceId)
          .single();
        finalDebtorId = inv?.debtor_id;
      }

      if (finalDebtorId) {
        const { error: activityError } = await supabaseClient
          .from("collection_activities")
          .insert({
            user_id: user.id,
            debtor_id: finalDebtorId,
            invoice_id: invoiceId || null,
            linked_draft_id: draftId || null,
            activity_type: "outreach",
            direction: "outbound",
            channel: "email",
            subject: processedSubject,
            message_body: processedBody,
            sent_at: new Date().toISOString(),
            metadata: {
              from_email: fromEmail,
              from_name: branding?.business_name || "Recouply.ai",
              reply_to_email: replyToEmail,
              platform_send: true,
              payment_url: paymentUrl || null,
            },
          });

        if (activityError) {
          console.error("Failed to log collection activity:", activityError);
        }
      }
    }

    // Mark draft as sent by setting sent_at timestamp
    // Keep status as-is since draft_status enum does not include 'sent'
    if (draftId) {
      const { error: draftError } = await supabaseClient
        .from("ai_drafts")
        .update({
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", draftId);

      if (draftError) {
        console.error("Failed to update draft sent_at:", draftError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully",
        sender: {
          email: fromEmail,
          reply_to: replyToEmail,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in send-collection-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
