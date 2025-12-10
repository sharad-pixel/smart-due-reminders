import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateBrandedEmail, getEmailFromAddress } from "../_shared/emailSignature.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Platform email configuration
const PLATFORM_INBOUND_DOMAIN = "inbound.services.recouply.ai";

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

    const invoice = draft.invoices;
    const debtor = invoice.debtors;

    // Get effective account ID (for team member support)
    const { data: effectiveAccountId } = await supabaseClient.rpc('get_effective_account_id', { p_user_id: user.id });
    const brandingOwnerId = effectiveAccountId || user.id;

    // Fetch branding settings for signature and From name (using effective account)
    const { data: branding } = await supabaseClient
      .from("branding_settings")
      .select("logo_url, business_name, from_name, email_signature, email_footer, primary_color, ar_page_public_token, ar_page_enabled, stripe_payment_link")
      .eq("user_id", brandingOwnerId)
      .single();

    // Generate the From address using company name
    const fromEmail = getEmailFromAddress(branding || {});

    let sendResult = { success: false, message: "", replyTo: "" };
    let sentFrom = fromEmail;

    // Send based on channel
    if (draft.channel === "email") {
      // Use platform email - reply-to is based on invoice
      const replyToAddress = `invoice+${invoice.id}@${PLATFORM_INBOUND_DOMAIN}`;
      
      console.log(`Sending email via platform from ${fromEmail} to ${debtor.email} with reply-to: ${replyToAddress}`);

      // Format message body with line breaks
      const formattedBody = draft.message_body.replace(/\n/g, "<br>");

      // Build fully branded email with signature and payment link
      const emailHtml = generateBrandedEmail(
        formattedBody,
        branding || {},
        {
          invoiceId: invoice.id,
          amount: invoice.amount,
          // Payment URL would be added here if Stripe payment links are configured
        }
      );

      // Send via platform send-email function
      const sendEmailResponse = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify({
            to: debtor.email,
            from: fromEmail,
            reply_to: replyToAddress,
            subject: draft.subject || "Payment Reminder",
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
        message: "Email sent successfully via Recouply.ai platform",
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

      if (!debtor.phone) {
        throw new Error("Debtor phone number not available");
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
              To: debtor.phone,
              From: twilioProfile.twilio_from_number,
              Body: draft.message_body,
            }),
          }
        );

        if (!twilioResponse.ok) {
          const errorText = await twilioResponse.text();
          throw new Error(`Twilio error: ${errorText}`);
        }

        sendResult = { success: true, message: "SMS sent successfully", replyTo: "" };
      } catch (smsError: any) {
        console.error("SMS send error:", smsError);
        throw new Error(`Failed to send SMS: ${smsError.message}`);
      }
    }

    // Log the outreach
    await supabaseClient.from("outreach_logs").insert({
      user_id: user.id,
      invoice_id: invoice.id,
      debtor_id: debtor.id,
      channel: draft.channel,
      subject: draft.subject,
      message_body: draft.message_body,
      sent_to: draft.channel === "email" ? debtor.email : debtor.phone,
      sent_from: sentFrom,
      status: "sent",
      sent_at: new Date().toISOString(),
      delivery_metadata: {
        draft_id: draft_id,
        reply_to: sendResult.replyTo || undefined,
        platform_send: draft.channel === "email",
      },
    });

    // Update invoice last_contact_date
    await supabaseClient
      .from("invoices")
      .update({ last_contact_date: new Date().toISOString().split('T')[0] })
      .eq("id", invoice.id);

    // Update draft status to sent
    await supabaseClient
      .from("ai_drafts")
      .update({ 
        status: "sent",
        sent_at: new Date().toISOString(),
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
