import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { wrapEnterpriseEmail, BRAND } from "../_shared/enterpriseEmailTemplate.ts";

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
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { email, redirectTo }: PasswordResetRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    console.log("Processing password reset request for:", email);

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: email,
    });

    if (linkError) {
      console.log("Link generation result:", linkError.message);
      return new Response(
        JSON.stringify({ success: true, message: "If an account exists, a reset link will be sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenHash = linkData?.properties?.hashed_token;
    
    if (!tokenHash) {
      console.log("No token generated - email may not exist");
      return new Response(
        JSON.stringify({ success: true, message: "If an account exists, a reset link will be sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = redirectTo || "https://recouply.ai/auth/reset-password";
    const resetLink = `${baseUrl}?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;

    const bodyContent = `
      <p style="font-size: 13px; color: ${BRAND.foreground}; margin: 0 0 18px;">
        Hi there — we received a request to reset your password for your <strong>Recouply.ai</strong> account. Click the button below to create a new password.
      </p>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 14px; font-weight: 600; box-shadow: 0 2px 10px rgba(59,130,246,0.25);">
          Reset Password →
        </a>
      </div>

      <div style="background: #fefce8; border: 1px solid #fde047; border-left: 3px solid #f59e0b; border-radius: 8px; padding: 12px 14px; margin: 24px 0;">
        <p style="margin: 0; color: #854d0e; font-size: 11.5px; line-height: 1.6;">
          <strong>⏰ Important:</strong> This link expires in 1 hour. If you didn't request this reset, you can safely ignore this email.
        </p>
      </div>

      <p style="margin: 18px 0 8px; color: ${BRAND.muted}; font-size: 11.5px; line-height: 1.6;">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <p style="margin: 0; padding: 10px 12px; background: #f1f5f9; border-radius: 6px; word-break: break-all; font-family: 'SF Mono', SFMono-Regular, Consolas, monospace; font-size: 11px; color: ${BRAND.muted}; border: 1px solid ${BRAND.border};">
        ${resetLink}
      </p>
    `;

    const htmlEmail = wrapEnterpriseEmail(bodyContent, {
      headerStyle: 'gradient',
      title: 'Password Reset',
      subtitle: 'Secure account recovery',
    });

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
      JSON.stringify({ success: true, message: "If an account exists, a reset link will be sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-password-reset:", error);
    return new Response(
      JSON.stringify({ success: true, message: "If an account exists, a reset link will be sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
