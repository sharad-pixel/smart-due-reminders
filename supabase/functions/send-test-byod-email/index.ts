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

    const { profileId, recipientEmail } = await req.json();

    if (!profileId || !recipientEmail) {
      throw new Error("Profile ID and recipient email are required");
    }

    // Fetch the email profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("email_sending_profiles")
      .select("*")
      .eq("id", profileId)
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Profile not found");
    }

    console.log(`Sending test email from ${profile.sender_email} to ${recipientEmail}`);

    // In production, this would integrate with your email service (SendGrid, Postmark, etc.)
    // For now, we'll simulate sending
    
    const testEmailContent = {
      from: {
        email: profile.sender_email,
        name: profile.sender_name,
      },
      to: [{ email: recipientEmail }],
      subject: "Your domain is now verified for Recouply.ai",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; border-bottom: 3px solid #4F46E5; padding-bottom: 10px;">
            ✅ Domain Verification Successful!
          </h1>
          
          <p style="font-size: 16px; color: #555; line-height: 1.6;">
            Great news! Your business domain has been successfully verified and is now active for sending AR & Collections emails.
          </p>
          
          <div style="background-color: #F3F4F6; border-left: 4px solid #4F46E5; padding: 15px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">Verified Domain Details</h3>
            <p style="margin: 5px 0;"><strong>Sender Name:</strong> ${profile.sender_name}</p>
            <p style="margin: 5px 0;"><strong>Sender Email:</strong> ${profile.sender_email}</p>
            <p style="margin: 5px 0;"><strong>Domain:</strong> ${profile.domain}</p>
          </div>
          
          <h3 style="color: #333; margin-top: 30px;">What's Next?</h3>
          <ul style="font-size: 14px; color: #555; line-height: 1.8;">
            <li>All collection emails will now be sent from your verified domain</li>
            <li>Your emails will have improved deliverability and inbox placement</li>
            <li>Customers will see your business name and domain, building trust</li>
            <li>You can monitor deliverability metrics in your dashboard</li>
          </ul>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="font-size: 12px; color: #888; margin: 0;">
              This test email was sent by Recouply.ai to verify your domain configuration.
              <br />
              If you have any questions, please contact our support team.
            </p>
          </div>
        </div>
      `,
    };

    // Log the email for demo purposes
    console.log("Test email prepared:", testEmailContent);

    // Simulate email sending delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // In production, you would call your email service here:
    // await sendEmailViaService(testEmailContent);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Test email sent successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in send-test-byod-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send test email" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
