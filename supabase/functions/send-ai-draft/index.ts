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

    // Fetch user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) throw new Error("Profile not found");

    const invoice = draft.invoices;
    const debtor = invoice.debtors;

    let sendResult = { success: false, message: "" };

    // Send based on channel
    if (draft.channel === "email") {
      if (!profile.sendgrid_api_key) {
        throw new Error("SendGrid API key not configured");
      }

      try {
        const sendGridResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${profile.sendgrid_api_key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [
              {
                to: [{ email: debtor.email }],
                subject: draft.subject || "Payment Reminder",
              },
            ],
            from: {
              email: profile.email || "noreply@recouply.ai",
              name: profile.business_name || "Recouply.ai",
            },
            content: [
              {
                type: "text/html",
                value: draft.message_body.replace(/\n/g, "<br>"),
              },
            ],
          }),
        });

        if (!sendGridResponse.ok) {
          const errorText = await sendGridResponse.text();
          console.error("SendGrid error:", errorText);
          throw new Error(`Failed to send email: ${sendGridResponse.status}`);
        }

        sendResult = { success: true, message: "Email sent successfully" };
      } catch (emailError: any) {
        console.error("Email send error:", emailError);
        throw new Error(`Failed to send email: ${emailError.message}`);
      }
    } else if (draft.channel === "sms") {
      if (!profile.twilio_account_sid || !profile.twilio_auth_token || !profile.twilio_from_number) {
        throw new Error("Twilio credentials not configured");
      }

      if (!debtor.phone) {
        throw new Error("Debtor phone number not available");
      }

      const twilioAuth = btoa(`${profile.twilio_account_sid}:${profile.twilio_auth_token}`);
      
      try {
        const twilioResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${profile.twilio_account_sid}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${twilioAuth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: debtor.phone,
              From: profile.twilio_from_number,
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
      sent_from: draft.channel === "email" ? profile.email : profile.twilio_from_number,
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
