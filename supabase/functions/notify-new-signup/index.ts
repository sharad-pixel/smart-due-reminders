import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NewSignupPayload {
  userId: string;
  email: string;
  name?: string | null;
  companyName?: string | null;
  provider?: string | null;
  createdAt?: string | null;
}

const ADMIN_RECIPIENTS = ["support@recouply.ai", "sharad@recouply.ai"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  try {
    const payload: NewSignupPayload = await req.json();
    const { userId, email, name, companyName, provider, createdAt } = payload;

    console.log("[notify-new-signup] Received signup:", { userId, email, provider });

    if (!email || !userId) {
      return new Response(
        JSON.stringify({ error: "userId and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if we've already notified for this user (idempotency)
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, welcome_email_sent_at, name, business_name")
      .eq("id", userId)
      .maybeSingle();

    const displayName = name || existingProfile?.name || email.split("@")[0];
    const company = companyName || existingProfile?.business_name || null;
    const signupSource = provider === "google" ? "Google OAuth" : provider === "email" ? "Email/Password" : (provider || "Unknown");

    const results: Record<string, unknown> = {};

    // 1. Fire admin alert (support@ + sharad@)
    try {
      const { data: alertData, error: alertErr } = await supabase.functions.invoke("send-admin-alert", {
        body: {
          type: "signup",
          email,
          name: displayName,
          company: company || `Signed up via ${signupSource}`,
        },
      });
      if (alertErr) throw alertErr;
      results.adminAlert = { ok: true, data: alertData };
      console.log("[notify-new-signup] Admin alert sent");
    } catch (e: any) {
      console.error("[notify-new-signup] Admin alert failed:", e);
      results.adminAlert = { ok: false, error: e?.message };
    }

    // 2. Send welcome email (only if not already sent)
    if (!existingProfile?.welcome_email_sent_at) {
      try {
        const { data: welcomeData, error: welcomeErr } = await supabase.functions.invoke("send-welcome-email", {
          body: {
            email,
            userName: displayName,
            companyName: company,
            userId,
          },
        });
        if (welcomeErr) throw welcomeErr;
        results.welcomeEmail = { ok: true, data: welcomeData };
        console.log("[notify-new-signup] Welcome email sent");
      } catch (e: any) {
        console.error("[notify-new-signup] Welcome email failed:", e);
        results.welcomeEmail = { ok: false, error: e?.message };
      }
    } else {
      results.welcomeEmail = { ok: true, skipped: "already_sent" };
    }

    // 3. Send a direct concierge engagement email from Sharad (personal touch)
    if (resendApiKey) {
      try {
        const conciergeHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff;">
            <p style="font-size: 16px; color: #1e293b; line-height: 1.6;">Hi ${displayName.split(" ")[0]},</p>
            <p style="font-size: 16px; color: #1e293b; line-height: 1.6;">
              I'm Sharad, founder of Recouply.ai. I just saw you signed up — welcome aboard! 🎉
            </p>
            <p style="font-size: 16px; color: #1e293b; line-height: 1.6;">
              I'd love to personally help you get set up and make sure Recouply works perfectly for ${company || "your business"}.
              Most teams see meaningful collections lift in their first 2 weeks — I'd love to make sure you're one of them.
            </p>
            <p style="font-size: 16px; color: #1e293b; line-height: 1.6;">
              <strong>Quick question:</strong> what's your biggest collections headache right now?
              Just hit reply — I read every message personally.
            </p>
            <p style="font-size: 16px; color: #1e293b; line-height: 1.6;">
              Or if you'd rather hop on a 15-min call, grab any time here:
              <a href="https://calendly.com/sharad-recouply" style="color: #1e3a5f; font-weight: 600;">calendly.com/sharad-recouply</a>
            </p>
            <p style="font-size: 16px; color: #1e293b; line-height: 1.6; margin-top: 24px;">
              Talk soon,<br/>
              <strong>Sharad Chanana</strong><br/>
              <span style="color: #64748b; font-size: 14px;">Founder & CEO, Recouply.ai</span>
            </p>
          </div>
        `;

        const conciergeResp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Sharad Chanana <notifications@send.inbound.services.recouply.ai>",
            to: [email],
            reply_to: "sharad@recouply.ai",
            bcc: ["sharad@recouply.ai"],
            subject: `Welcome to Recouply, ${displayName.split(" ")[0]} — quick question`,
            html: conciergeHtml,
          }),
        });
        const conciergeData = await conciergeResp.json();
        if (!conciergeResp.ok) throw new Error(JSON.stringify(conciergeData));
        results.conciergeEmail = { ok: true, id: conciergeData.id };
        console.log("[notify-new-signup] Concierge email sent");
      } catch (e: any) {
        console.error("[notify-new-signup] Concierge email failed:", e);
        results.conciergeEmail = { ok: false, error: e?.message };
      }
    }

    // 4. Log signup event for admin tracking
    try {
      await supabase.from("audit_logs").insert({
        user_id: userId,
        action_type: "user_signup_notified",
        resource_type: "auth_user",
        resource_id: userId,
        metadata: {
          email,
          name: displayName,
          company,
          provider: signupSource,
          notifications: results,
          created_at: createdAt,
        },
      });
    } catch (e) {
      console.error("[notify-new-signup] Audit log failed:", e);
    }

    return new Response(
      JSON.stringify({ success: true, userId, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[notify-new-signup] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
