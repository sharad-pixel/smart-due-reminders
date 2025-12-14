import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { wrapEmailContent, BrandingSettings } from "../_shared/emailSignature.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
  redirectTo?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { email, redirectTo }: PasswordResetRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    console.log("Processing password reset request for:", email);

    // Generate the password reset link using Supabase Admin API
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: redirectTo || `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/auth/reset-password`,
      },
    });

    if (linkError) {
      // Don't reveal if email exists or not for security
      console.log("Link generation result:", linkError.message);
      return new Response(
        JSON.stringify({ success: true, message: "If an account exists, a reset link will be sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resetLink = linkData?.properties?.action_link;
    
    if (!resetLink) {
      console.log("No reset link generated - email may not exist");
      return new Response(
        JSON.stringify({ success: true, message: "If an account exists, a reset link will be sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Recouply.ai branded email content
    const branding: BrandingSettings = {
      business_name: "Recouply.ai",
      from_name: "Recouply.ai",
      primary_color: "#1e3a5f",
    };

    const emailContent = `
      <h2 style="color: #1e293b; margin: 0 0 24px; font-size: 24px; font-weight: 700;">
        🔐 Reset Your Password
      </h2>
      
      <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.7;">
        Hi there,
      </p>

      <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.7;">
        We received a request to reset your password for your <strong>Recouply.ai</strong> account. Click the button below to create a new password:
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
          Reset Password
        </a>
      </div>

      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
          <strong>⏰ Important:</strong> This link will expire in 1 hour for security reasons. If you didn't request this reset, you can safely ignore this email.
        </p>
      </div>

      <p style="margin: 20px 0; color: #475569; font-size: 15px; line-height: 1.7;">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      
      <p style="margin: 0 0 20px; padding: 12px; background: #f1f5f9; border-radius: 6px; word-break: break-all; font-family: monospace; font-size: 13px; color: #64748b;">
        ${resetLink}
      </p>

      <p style="margin: 24px 0 0; color: #94a3b8; font-size: 13px; line-height: 1.6;">
        If you didn't request a password reset, please ignore this email or contact support if you have concerns about your account security.
      </p>
    `;

    const htmlEmail = wrapEmailContent(emailContent, branding);

    // Send via Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Recouply.ai <notifications@send.inbound.services.recouply.ai>",
        to: [email],
        subject: "🔐 Reset Your Recouply.ai Password",
        html: htmlEmail,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API error:", resendData);
      throw new Error(`Failed to send email: ${JSON.stringify(resendData)}`);
    }

    console.log("✅ Password reset email sent successfully:", resendData.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "If an account exists, a reset link will be sent",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-password-reset:", error);
    // Always return success message for security (don't reveal if email exists)
    return new Response(
      JSON.stringify({
        success: true,
        message: "If an account exists, a reset link will be sent",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
