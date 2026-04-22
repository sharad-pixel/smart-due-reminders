import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { wrapEnterpriseEmail, BRAND } from "../_shared/enterpriseEmailTemplate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerificationRequest {
  email: string;
  userId: string;
  resend?: boolean;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, userId, resend: isResend } = await req.json() as VerificationRequest;

    if (!email || !userId) {
      return new Response(
        JSON.stringify({ error: "Email and userId are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = crypto.randomUUID() + "-" + crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Store the expiration timestamp on profiles (non-secret) and the token in user_secrets (private)
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        email_verification_token_expires_at: expiresAt.toISOString(),
      })
      .eq("id", userId);

    const { error: updateError } = profileUpdateError
      ? { error: profileUpdateError }
      : await supabase
          .from("user_secrets")
          .upsert({
            user_id: userId,
            email_verification_token: token,
          }, { onConflict: "user_id" });

    if (updateError) {
      console.error("Error storing verification token:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to generate verification token" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const siteUrl = Deno.env.get("SITE_URL") || "https://recouply.ai";
    const verificationUrl = `${siteUrl}/verify-email?token=${token}`;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const bodyContent = `
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 64px; height: 64px; background-color: #dbeafe; border-radius: 50%; line-height: 64px; font-size: 28px;">
          ✉️
        </div>
      </div>
      
      <h2 style="margin: 0 0 16px; color: ${BRAND.foreground}; font-size: 22px; font-weight: 700; text-align: center;">
        Verify Your Email Address
      </h2>
      
      <p style="margin: 0 0 24px; color: #475569; font-size: 14px; text-align: center; line-height: 1.7;">
        Welcome to Recouply.ai! Please verify your email address to activate your account and start transforming your collections with AI-powered intelligence.
      </p>
      
      <div style="text-align: center; margin: 28px 0;">
        <a href="${verificationUrl}" 
           style="display: inline-block; background-color: ${BRAND.accent}; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 14px;">
          Verify Email Address
        </a>
      </div>
      
      <p style="margin: 24px 0 0; color: ${BRAND.muted}; font-size: 13px; text-align: center;">
        This link expires in 24 hours.
      </p>

      <div style="margin-top: 24px; background-color: ${BRAND.surfaceLight}; border-radius: 8px; padding: 14px; border: 1px solid ${BRAND.border};">
        <p style="margin: 0 0 8px; color: ${BRAND.muted}; font-size: 12px;">
          If the button doesn't work, copy and paste this link:
        </p>
        <p style="margin: 0; padding: 10px; background: #ffffff; border-radius: 6px; word-break: break-all; font-family: monospace; font-size: 11px; color: ${BRAND.primary}; border: 1px solid ${BRAND.border};">
          ${verificationUrl}
        </p>
      </div>

      <p style="margin: 20px 0 0; color: #94a3b8; font-size: 11px; text-align: center;">
        If you didn't create an account with Recouply.ai, you can safely ignore this email.
      </p>
    `;

    const emailHtml = wrapEnterpriseEmail(bodyContent, {
      headerStyle: 'gradient',
      title: 'Email Verification',
      subtitle: 'Activate your account',
    });

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Recouply.ai <notifications@send.inbound.services.recouply.ai>",
        to: [email],
        subject: isResend ? "Resend: Verify your email for Recouply.ai" : "Verify your email for Recouply.ai",
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("Resend API error:", errorData);
      return new Response(
        JSON.stringify({ error: "Failed to send verification email" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailData = await emailResponse.json();
    console.log("Verification email sent:", emailData);

    return new Response(
      JSON.stringify({ success: true, message: "Verification email sent" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending verification email:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
