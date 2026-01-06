import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { 
  renderBrandedEmail, 
  getSenderIdentity,
  captureBrandSnapshot,
  BrandingConfig 
} from "../_shared/renderBrandedEmail.ts";
import { INBOUND_EMAIL_DOMAIN } from "../_shared/emailConfig.ts";

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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Fetch branding settings for the user
    const { data: branding, error: brandingError } = await supabaseClient
      .from("branding_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (brandingError && brandingError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch branding: ${brandingError.message}`);
    }

    // Build branding config with defaults
    const brandingConfig: BrandingConfig = {
      business_name: branding?.business_name || "Your Business",
      from_name: branding?.from_name || branding?.business_name || "Your Business",
      logo_url: branding?.logo_url,
      primary_color: branding?.primary_color || "#111827",
      accent_color: branding?.accent_color || "#6366f1",
      sending_mode: branding?.sending_mode || 'recouply_default',
      from_email: branding?.from_email,
      from_email_verified: branding?.from_email_verified || false,
      verified_from_email: branding?.verified_from_email,
      reply_to_email: branding?.reply_to_email,
      email_signature: branding?.email_signature,
      email_footer: branding?.email_footer,
      footer_disclaimer: branding?.footer_disclaimer,
      email_wrapper_enabled: branding?.email_wrapper_enabled ?? true,
      ar_page_public_token: branding?.ar_page_public_token,
      ar_page_enabled: branding?.ar_page_enabled,
      stripe_payment_link: branding?.stripe_payment_link,
    };

    // Get deterministic sender identity
    const sender = getSenderIdentity(brandingConfig);
    const brandSnapshot = captureBrandSnapshot(brandingConfig, sender);

    console.log("[TEST-EMAIL] Sender identity:", {
      fromEmail: sender.fromEmail,
      sendingMode: sender.sendingMode,
      usedFallback: sender.usedFallback,
    });

    // Generate test email content
    const testEmailBody = `
      <h2 style="color: #1e293b; margin: 0 0 20px;">Email Template Preview</h2>
      
      <p>Hello,</p>
      
      <p>This is a test email to demonstrate your branded email template for <strong>${brandingConfig.business_name}</strong>.</p>
      
      <p>This template includes:</p>
      <ul style="margin: 16px 0; padding-left: 20px;">
        <li>Your company branding (logo, colors)</li>
        <li>Your custom email signature</li>
        <li>Your Public AR Information Page link in the footer</li>
        <li>Professional Recouply.ai branding</li>
      </ul>
      
      <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 24px 0; border-left: 4px solid #3b82f6;">
        <p style="margin: 0 0 8px; font-size: 14px; color: #1e293b; font-weight: 600;">
          📧 Sender Information
        </p>
        <p style="margin: 0; font-size: 13px; color: #475569;">
          <strong>Sending Mode:</strong> ${sender.sendingMode === 'customer_domain' ? 'Your Domain (Verified)' : 'Recouply.ai (Default)'}
          ${sender.usedFallback ? '<br><span style="color: #f59e0b;">⚠️ Using Recouply fallback - your domain is not yet verified</span>' : ''}
        </p>
      </div>
      
      <p>All future collection emails, AI drafts, and notifications will use this template format.</p>
      
      <p>Thank you for using Recouply.ai!</p>
    `;

    // Render the full branded email
    const htmlEmail = renderBrandedEmail({
      brand: brandingConfig,
      subject: `📧 Email Template Preview - ${brandingConfig.business_name}`,
      bodyHtml: testEmailBody,
      cta: brandingConfig.stripe_payment_link ? {
        label: "Preview Payment Button",
        url: brandingConfig.stripe_payment_link,
      } : undefined,
    });

    console.log("[TEST-EMAIL] Sending to:", user.email);

    // Send via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    // Use inbound domain for replies (not the send domain!)
    const replyToAddress = sender.replyTo || `support@${INBOUND_EMAIL_DOMAIN}`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender.fromEmail,
        to: [user.email],
        reply_to: replyToAddress,
        subject: `📧 Email Template Preview - ${brandingConfig.business_name}`,
        html: htmlEmail,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("[TEST-EMAIL] Resend API error:", resendData);
      throw new Error(`Failed to send email: ${JSON.stringify(resendData)}`);
    }

    console.log("[TEST-EMAIL] ✅ Test email sent successfully:", resendData.id);

    // Update last_test_email_sent_at in branding_settings
    if (branding?.id) {
      await supabaseClient
        .from("branding_settings")
        .update({ 
          last_test_email_sent_at: new Date().toISOString() 
        })
        .eq("id", branding.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Test email sent to ${user.email}`,
        message_id: resendData.id,
        sender_info: {
          from_email: sender.fromEmail,
          sending_mode: sender.sendingMode,
          used_fallback: sender.usedFallback,
        },
        brand_snapshot: brandSnapshot,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[TEST-EMAIL] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
