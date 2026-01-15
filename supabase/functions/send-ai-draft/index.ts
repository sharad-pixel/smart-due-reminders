// ⚠️ EMAIL DOMAIN WARNING ⚠️
// This function sends emails via Resend.
// The FROM email MUST use verified domain: send.inbound.services.recouply.ai
// DO NOT change to @recouply.ai - it will fail!
// See: supabase/functions/_shared/emailConfig.ts

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateBrandedEmail, getEmailFromAddress } from "../_shared/emailSignature.ts";
import { getOutreachContacts } from "../_shared/contactUtils.ts";
import { INBOUND_EMAIL_DOMAIN } from "../_shared/emailConfig.ts";
import { cleanAndReplaceContent, cleanSubjectLine, type InvoiceData, type DebtorData, type BrandingData } from "../_shared/draftContentEngine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Decrypt a value using AES-GCM (kept for SMS Twilio credentials)
async function decryptValue(encryptedValue: string): Promise<string> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
  if (!encryptionKey) {
    throw new Error('Encryption key not configured');
  }

  const keyMaterial = encoder.encode(encryptionKey);
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial.slice(0, 32),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const encryptedData = Uint8Array.from(atob(encryptedValue), c => c.charCodeAt(0));
  const iv = encryptedData.slice(0, 12);
  const ciphertext = encryptedData.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return decoder.decode(decrypted);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { draft_id } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Service role client for operations that need to bypass RLS (team member updates)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated");

    // Fetch the draft with related data
    const { data: draft, error: draftError } = await supabaseClient
      .from("ai_drafts")
      .select("*, invoices(*, debtors(*))")
      .eq("id", draft_id)
      .single();

    if (draftError || !draft) throw new Error("Draft not found");

    // CRITICAL: Prevent duplicate sends - check if already sent
    // NOTE: draft_status enum does NOT include 'sent'; use sent_at as the source of truth.
    if (draft.sent_at) {
      console.log(`Draft ${draft_id} already sent at ${draft.sent_at}, skipping`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Draft already sent",
          sent_at: draft.sent_at,
          already_sent: true,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const invoice = draft.invoices;
    if (!invoice) {
      throw new Error(
        "Draft is not linked to an invoice. Please regenerate the message from the invoice page and try again."
      );
    }

    // CRITICAL: Prevent sending to settled invoices (Paid, Canceled, Voided, Credited, Written Off)
    const settledStatuses = ['Paid', 'Canceled', 'Voided', 'Credited', 'Written Off', 'paid', 'canceled', 'voided', 'credited', 'written off'];
    if (settledStatuses.includes(invoice.status)) {
      console.log(`Draft ${draft_id} blocked: invoice ${invoice.id} has status ${invoice.status}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Cannot send outreach to ${invoice.status} invoices`,
          invoice_status: invoice.status,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const debtor = invoice.debtors;
    if (!debtor) {
      throw new Error(
        "Invoice is missing its linked account. Please refresh the invoice and try again."
      );
    }

    // Calculate days past due for template replacement
    const invoiceDueDate = new Date(invoice.due_date);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const daysPastDue = Math.max(0, Math.floor((todayDate.getTime() - invoiceDueDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Fetch branding first so we can use stripe_payment_link in template vars
    // Get effective account ID (for team member support)
    const { data: effectiveAccountId } = await supabaseClient.rpc('get_effective_account_id', { p_user_id: user.id });
    const brandingOwnerId = effectiveAccountId || user.id;

    // Fetch branding settings for signature and From name (using effective account)
    const { data: branding } = await supabaseClient
      .from("branding_settings")
      .select("logo_url, business_name, from_name, email_signature, email_footer, primary_color, ar_page_public_token, ar_page_enabled, stripe_payment_link, escalation_contact_name, escalation_contact_email, escalation_contact_phone, email_format")
      .eq("user_id", brandingOwnerId)
      .single();
    
    // Build AR portal URL
    const arPageUrl = branding?.ar_page_public_token && branding?.ar_page_enabled 
      ? `https://recouply.ai/ar/${branding.ar_page_public_token}` 
      : '';

    // Fetch persona name for signature
    let personaName = 'Collections Team';
    if (draft.agent_persona_id) {
      const { data: personaData } = await supabaseClient
        .from('ai_agent_personas')
        .select('name')
        .eq('id', draft.agent_persona_id)
        .single();
      personaName = personaData?.name || 'Collections Team';
    }

    // Build invoice data for the unified engine
    const invoiceData: InvoiceData = {
      id: invoice.id,
      invoice_number: invoice.invoice_number || invoice.reference_id || '',
      amount: invoice.amount || 0,
      amount_outstanding: invoice.amount_outstanding,
      currency: invoice.currency || 'USD',
      due_date: invoice.due_date,
      product_description: invoice.product_description,
      external_link: invoice.external_link,
      stripe_hosted_url: invoice.stripe_hosted_url,
      integration_url: invoice.integration_url,
    };

    // Build debtor data
    const debtorData: DebtorData = {
      id: debtor?.id,
      name: debtor?.name,
      company_name: debtor?.company_name,
    };

    // Build branding data
    const brandingData: BrandingData = {
      business_name: branding?.business_name,
      from_name: branding?.from_name,
      email_signature: branding?.email_signature,
      email_footer: branding?.email_footer,
      stripe_payment_link: branding?.stripe_payment_link,
      ar_page_public_token: branding?.ar_page_public_token,
      ar_page_enabled: branding?.ar_page_enabled,
      escalation_contact_name: branding?.escalation_contact_name,
      escalation_contact_email: branding?.escalation_contact_email,
      escalation_contact_phone: branding?.escalation_contact_phone,
    };

    // Use unified draft content engine for processing
    const processedBody = cleanAndReplaceContent(
      draft.message_body,
      invoiceData,
      debtorData,
      brandingData,
      debtor?.name,
      personaName
    );

    const processedSubject = cleanSubjectLine(
      draft.subject || 'Payment Reminder',
      invoiceData,
      debtorData,
      brandingData,
      debtor?.name,
      personaName
    );
    // Fetch all outreach-enabled contacts with fallback to debtor record
    const outreachContacts = await getOutreachContacts(supabaseClient, debtor?.id, debtor);
    const allEmails = outreachContacts.emails;
    const allPhones = outreachContacts.phones;
    
    console.log(`Outreach contacts: ${allEmails.length} emails, ${allPhones.length} phones`);

    // Generate the From address using company name
    const fromEmail = getEmailFromAddress(branding || {});

    let sendResult = { success: false, message: "", replyTo: "" };
    let sentFrom = fromEmail;

    // Send based on channel
    if (draft.channel === "email") {
      if (allEmails.length === 0) {
        throw new Error("No email found for this account. Please add a contact with email and enable outreach.");
      }
      
      // Use platform email - reply-to is based on invoice (uses shared config)
      const replyToAddress = `invoice+${invoice.id}@${INBOUND_EMAIL_DOMAIN}`;
      
      console.log(`Sending email via platform from ${fromEmail} to ${allEmails.join(', ')} with reply-to: ${replyToAddress}`);

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

      // Send to ALL outreach-enabled contacts
      const sendEmailResponse = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify({
            to: allEmails, // Send to all outreach-enabled contacts
            from: fromEmail,
            reply_to: replyToAddress,
            subject: processedSubject,
            html: emailHtml,
          }),
        }
      );

      const emailResult = await sendEmailResponse.json();

      if (!sendEmailResponse.ok) {
        console.error("Platform email error:", emailResult);
        throw new Error(`Failed to send email: ${emailResult.error || "Unknown error"}`);
      }

      sendResult = { 
        success: true, 
        message: `Email sent successfully to ${allEmails.length} recipient(s)`,
        replyTo: replyToAddress
      };
    } else if (draft.channel === "sms") {
      // Fetch Twilio credentials from profile
      const { data: twilioProfile, error: twilioProfileError } = await supabaseClient
        .from("profiles")
        .select("twilio_account_sid, twilio_auth_token, twilio_from_number")
        .eq("id", user.id)
        .single();

      if (twilioProfileError || !twilioProfile) throw new Error("Profile not found");

      if (!twilioProfile.twilio_account_sid || !twilioProfile.twilio_auth_token || !twilioProfile.twilio_from_number) {
        throw new Error("Twilio credentials not configured. Please configure in Settings.");
      }

      if (allPhones.length === 0) {
        throw new Error("No phone number found for this account. Please add a contact with phone and enable outreach.");
      }

      // Decrypt Twilio credentials
      let accountSid: string;
      let authToken: string;
      try {
        accountSid = await decryptValue(twilioProfile.twilio_account_sid);
        authToken = await decryptValue(twilioProfile.twilio_auth_token);
      } catch (decryptError) {
        console.error("Decryption error:", decryptError);
        throw new Error("Failed to decrypt Twilio credentials. Please reconfigure your Twilio settings.");
      }

      sentFrom = twilioProfile.twilio_from_number;
      const twilioAuth = btoa(`${accountSid}:${authToken}`);
      
      // Send SMS to ALL outreach-enabled contacts with phone numbers
      let smsSuccessCount = 0;
      for (const phone of allPhones) {
        try {
          const twilioResponse = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            {
              method: "POST",
              headers: {
                "Authorization": `Basic ${twilioAuth}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                To: phone,
                From: twilioProfile.twilio_from_number,
                Body: processedBody,
              }),
            }
          );

          if (!twilioResponse.ok) {
            const errorText = await twilioResponse.text();
            console.error(`Twilio error for ${phone}:`, errorText);
          } else {
            smsSuccessCount++;
          }
        } catch (smsError: any) {
          console.error(`SMS send error for ${phone}:`, smsError);
        }
      }

      if (smsSuccessCount === 0) {
        throw new Error("Failed to send SMS to any recipients");
      }

      sendResult = { success: true, message: `SMS sent to ${smsSuccessCount} recipient(s)`, replyTo: "" };
    }

    // Log the outreach
    await supabaseClient.from("outreach_logs").insert({
      user_id: user.id,
      invoice_id: invoice.id,
      debtor_id: debtor.id,
      channel: draft.channel,
      subject: draft.subject,
      message_body: draft.message_body,
      sent_to: draft.channel === "email" ? allEmails.join(', ') : allPhones.join(', '),
      sent_from: sentFrom,
      status: "sent",
      sent_at: new Date().toISOString(),
      delivery_metadata: {
        draft_id: draft_id,
        reply_to: sendResult.replyTo || undefined,
        platform_send: draft.channel === "email",
        recipients_count: draft.channel === "email" ? allEmails.length : allPhones.length,
      },
    });

    // Update invoice last_contact_date (use admin client for team member access)
    await supabaseAdmin
      .from("invoices")
      .update({ last_contact_date: new Date().toISOString().split('T')[0] })
      .eq("id", invoice.id);

    // Mark draft as sent by setting sent_at timestamp (use admin client for team member access)
    // Keep status as-is (approved/pending_approval) since draft_status enum does not include 'sent'
    await supabaseAdmin
      .from("ai_drafts")
      .update({
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", draft_id);

    return new Response(
      JSON.stringify(sendResult),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-ai-draft:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
