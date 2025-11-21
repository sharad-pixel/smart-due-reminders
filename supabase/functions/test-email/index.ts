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

    const { email } = await req.json();

    // Get user's SendGrid API key from profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("sendgrid_api_key, business_name")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.sendgrid_api_key) {
      throw new Error("SendGrid API key not configured");
    }

    // Send test email using SendGrid
    const sendGridResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${profile.sendgrid_api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email }],
            subject: "Test Email from Recouply.ai",
          },
        ],
        from: {
          email: "noreply@recouply.ai",
          name: profile.business_name || "Recouply.ai",
        },
        content: [
          {
            type: "text/html",
            value: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333;">Email Test Successful!</h1>
                <p>This is a test email from Recouply.ai to verify your email configuration.</p>
                <p>Your SendGrid integration is working correctly. You can now send invoice reminders to your debtors.</p>
                <hr style="border: 1px solid #eee; margin: 20px 0;" />
                <p style="color: #666; font-size: 12px;">
                  This email was sent from ${profile.business_name || "your business"} via Recouply.ai
                </p>
              </div>
            `,
          },
        ],
      }),
    });

    if (!sendGridResponse.ok) {
      const errorText = await sendGridResponse.text();
      console.error("SendGrid error:", errorText);
      throw new Error(`SendGrid API error: ${sendGridResponse.status}`);
    }

    console.log("Test email sent successfully to:", email);

    return new Response(
      JSON.stringify({ success: true, message: "Test email sent successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in test-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send test email" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
