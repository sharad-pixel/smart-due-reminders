import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    let sendResult = { success: false, message: "" };
    let sentFrom = "";

    // Send based on channel
    if (draft.channel === "email") {
      // Check for connected email account (BYOE) - try active accounts first
      let { data: emailAccount, error: emailAccountError } = await supabaseClient
        .from("email_accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      // If no active account, try any account regardless of verification/active status
      if (!emailAccount) {
        const { data: anyAccount } = await supabaseClient
          .from("email_accounts")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (!anyAccount) {
          throw new Error("No email account connected. Please connect your email in Settings > Email Sending.");
        }
        
        // Use the account even if not active or verified - for testing purposes
        console.log("Warning: Using email account (active:", anyAccount.is_active, ", verified:", anyAccount.is_verified, "):", anyAccount.email_address);
        emailAccount = anyAccount;
      }

      sentFrom = emailAccount.email_address;

      try {
        // Use test-email edge function to handle the actual sending
        const testEmailResponse = await supabaseClient.functions.invoke("test-email", {
          body: {
            email_account_id: emailAccount.id,
            to_email: debtor.email,
            subject: draft.subject || "Payment Reminder",
            body_html: draft.message_body.replace(/\n/g, "<br>"),
          },
        });

        if (testEmailResponse.error) {
          throw new Error(testEmailResponse.error.message || "Failed to send email");
        }

        sendResult = { success: true, message: "Email sent successfully via connected account" };
      } catch (emailError: any) {
        console.error("Email send error:", emailError);
        
        // Log the failure
        await supabaseClient.from("email_connection_logs").insert({
          email_account_id: emailAccount.id,
          event_type: "send_attempt",
          status: "failed",
          error_message: emailError.message,
        });
        
        throw new Error(`Failed to send email: ${emailError.message}`);
      }
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

      sentFrom = twilioProfile.twilio_from_number;
      const twilioAuth = btoa(`${twilioProfile.twilio_account_sid}:${twilioProfile.twilio_auth_token}`);
      
      try {
        const twilioResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioProfile.twilio_account_sid}/Messages.json`,
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

        sendResult = { success: true, message: "SMS sent successfully" };
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
    });

    // Update invoice last_contact_date
    await supabaseClient
      .from("invoices")
      .update({ last_contact_date: new Date().toISOString().split('T')[0] })
      .eq("id", invoice.id);

    // Update draft status
    await supabaseClient
      .from("ai_drafts")
      .update({ status: "approved" })
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
