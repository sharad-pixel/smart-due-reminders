import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { 
  generateBrandedEmail, 
  getEmailFromAddress,
  BrandingSettings 
} from "../_shared/emailSignature.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  to_email: string;
  user_email?: string; // For admin testing - specify the user to fetch branding for
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role for admin access
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { to_email, user_email }: TestEmailRequest = await req.json();
    
    if (!to_email) {
      throw new Error("Recipient email is required");
    }

    // Fetch user by email if provided, otherwise try auth
    let userId: string | null = null;
    
    if (user_email) {
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("id")
        .eq("email", user_email)
        .single();
      userId = profile?.id || null;
    }

    if (!userId) {
      throw new Error("User not found");
    }

    // Fetch branding settings for the user
    const { data: branding } = await supabaseClient
      .from("branding_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    const brandingSettings: BrandingSettings = branding || {
      business_name: "Recouply.ai",
      from_name: "Recouply.ai",
    };

    // Generate the email content
    const emailContent = `
      <h2 style="color: #1e293b; margin: 0 0 20px;">Email Template Preview</h2>
      
      <p>Hello,</p>
      
      <p>This is a test email to demonstrate the new email template design for <strong>${brandingSettings.business_name || "Recouply.ai"}</strong>.</p>
      
      <p>This template includes:</p>
      <ul style="margin: 16px 0; padding-left: 20px;">
        <li>Your company name in the "From" field</li>
        <li>Your custom email signature</li>
        <li>A link to your Public AR Information Page in the footer</li>
        <li>Professional Recouply.ai branding</li>
      </ul>
      
      <p>All future collection emails, AI drafts, and notifications will use this template format.</p>
      
      <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 24px 0; border-left: 4px solid #3b82f6;">
        <p style="margin: 0; font-size: 14px; color: #475569;">
          <strong>💡 Pro Tip:</strong> You can customize your email signature, footer, and logo in the Branding settings page.
        </p>
      </div>
      
      <p>Thank you for using Recouply.ai!</p>
    `;

    // Generate the full branded email
    const htmlEmail = generateBrandedEmail(emailContent, brandingSettings);

    // Get the from address with company name
    const fromAddress = getEmailFromAddress(brandingSettings);

    console.log("Sending test email to:", to_email);
    console.log("From:", fromAddress);

    // Send via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to_email],
        subject: `📧 Email Template Preview - ${brandingSettings.business_name || "Recouply.ai"}`,
        html: htmlEmail,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API error:", resendData);
      throw new Error(`Failed to send email: ${JSON.stringify(resendData)}`);
    }

    console.log("✅ Test email sent successfully:", resendData.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Test email sent to ${to_email}`,
        message_id: resendData.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending test email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
