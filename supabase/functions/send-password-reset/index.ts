import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Recouply.ai Platform Brand Colors – aligned with site design system & daily digest
const BRAND = {
  primary: '#3b82f6',
  primaryLight: '#60a5fa',
  primaryDark: '#1d4ed8',
  accent: '#22c55e',
  background: '#f8fafc',
  foreground: '#1e293b',
  muted: '#64748b',
  cardBg: '#ffffff',
  border: '#e2e8f0',
};

const BRAIN_SVG_WHITE = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;color:rgba(255,255,255,0.95);"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>`;

const BRAIN_SVG_FOOTER = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;color:rgba(255,255,255,0.7);"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>`;

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
    });

    if (linkError) {
      // Don't reveal if email exists or not for security
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

    // Build reset link directly to the app with token_hash (bypasses Supabase redirect URL restrictions)
    const baseUrl = redirectTo || "https://recouply.ai/auth/reset-password";
    const resetLink = `${baseUrl}?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;

    // Generate enterprise-grade branded email matching daily digest / welcome email template
    const htmlEmail = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 16px; background-color: ${BRAND.background};">
  <div style="max-width: 560px; margin: 0 auto; background: ${BRAND.cardBg}; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 12px rgba(59,130,246,0.08), 0 1px 3px rgba(0,0,0,0.04);">
    
    <!-- Header with Recouply.ai Brand -->
    <div style="background: linear-gradient(135deg, ${BRAND.primary} 0%, #2563eb 50%, ${BRAND.primaryDark} 100%); padding: 28px 24px 24px; text-align: center;">
      <div style="margin-bottom: 14px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
          <tr>
            <td style="padding-right: 10px; vertical-align: middle;">
              <div style="background: rgba(255,255,255,0.15); border-radius: 10px; padding: 8px; display: inline-block;">
                ${BRAIN_SVG_WHITE}
              </div>
            </td>
            <td style="vertical-align: middle;">
              <span style="color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Recouply<span style="color: rgba(255,255,255,0.7);">.ai</span>
              </span>
            </td>
          </tr>
        </table>
      </div>
      <h1 style="color: white; margin: 0 0 6px; font-size: 20px; font-weight: 700; letter-spacing: -0.3px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        Password Reset
      </h1>
      <p style="color: rgba(255,255,255,0.6); margin: 0; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        Secure account recovery
      </p>
    </div>
    
    <div style="padding: 28px 24px;">
      <p style="font-size: 13px; color: ${BRAND.foreground}; margin: 0 0 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        Hi there — we received a request to reset your password for your <strong>Recouply.ai</strong> account. Click the button below to create a new password.
      </p>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 14px; font-weight: 600; box-shadow: 0 2px 10px rgba(59,130,246,0.25); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          Reset Password →
        </a>
      </div>

      <div style="background: #fefce8; border: 1px solid #fde047; border-left: 3px solid #f59e0b; border-radius: 8px; padding: 12px 14px; margin: 24px 0;">
        <p style="margin: 0; color: #854d0e; font-size: 11.5px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <strong>⏰ Important:</strong> This link expires in 1 hour. If you didn't request this reset, you can safely ignore this email.
        </p>
      </div>

      <p style="margin: 18px 0 8px; color: ${BRAND.muted}; font-size: 11.5px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <p style="margin: 0; padding: 10px 12px; background: #f1f5f9; border-radius: 6px; word-break: break-all; font-family: 'SF Mono', SFMono-Regular, Consolas, monospace; font-size: 11px; color: ${BRAND.muted}; border: 1px solid ${BRAND.border};">
        ${resetLink}
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%); padding: 28px 24px; text-align: center;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 10px;">
        <tr>
          <td style="padding-right: 8px; vertical-align: middle;">
            ${BRAIN_SVG_FOOTER}
          </td>
          <td style="vertical-align: middle;">
            <span style="color: rgba(255,255,255,0.85); font-size: 16px; font-weight: 700; letter-spacing: -0.3px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              Recouply<span style="color: rgba(255,255,255,0.5);">.ai</span>
            </span>
          </td>
        </tr>
      </table>
      <p style="color: #93c5fd; margin: 0 0 12px; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        Accounts Receivable & Collection Intelligence Platform
      </p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 14px;">
        <tr>
          <td style="padding: 0 8px;">
            <a href="https://recouply.ai/dashboard" style="color: #60a5fa; font-size: 11px; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Dashboard</a>
          </td>
          <td style="color: rgba(255,255,255,0.2); font-size: 11px;">|</td>
          <td style="padding: 0 8px;">
            <a href="https://recouply.ai/settings" style="color: #60a5fa; font-size: 11px; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Settings</a>
          </td>
          <td style="color: rgba(255,255,255,0.2); font-size: 11px;">|</td>
          <td style="padding: 0 8px;">
            <a href="mailto:support@inbound.services.recouply.ai" style="color: #60a5fa; font-size: 11px; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Support</a>
          </td>
        </tr>
      </table>
      <p style="color: rgba(255,255,255,0.3); margin: 0; font-size: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        © ${new Date().getFullYear()} RecouplyAI Inc. · Delaware, USA · All rights reserved
      </p>
    </div>
  </div>
</body>
</html>`;

    // htmlEmail is already fully built above

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
