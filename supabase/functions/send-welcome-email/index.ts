import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { wrapEnterpriseEmail, BRAND } from "../_shared/enterpriseEmailTemplate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  companyName?: string;
  userName?: string;
  userId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!resendApiKey) {
    console.error("RESEND_API_KEY is not configured");
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { email, companyName, userName, userId }: WelcomeEmailRequest = await req.json();
    
    console.log("Sending welcome email to:", email, "Company:", companyName, "userId:", userId);

    // Check if welcome email was already sent (prevent duplicates)
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, welcome_email_sent_at')
        .eq('email', email)
        .single();

      if (profile?.welcome_email_sent_at) {
        console.log("Welcome email already sent to this user, skipping:", email);
        return new Response(
          JSON.stringify({ success: true, skipped: true, message: "Welcome email already sent" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const displayName = userName || companyName || "there";

    const bodyContent = `
      <h2 style="margin: 0 0 24px; color: ${BRAND.foreground}; font-size: 22px; font-weight: 700;">
        🎉 Welcome to Collection Intelligence!
      </h2>
      
      <p style="margin: 0 0 20px; color: #475569; font-size: 14px; line-height: 1.7;">
        Hi ${displayName},
      </p>

      <p style="margin: 0 0 20px; color: #475569; font-size: 14px; line-height: 1.7;">
        I'm <strong>Sharad Chanana</strong>, founder of Recouply.ai, and I'm personally thrilled to welcome you to our Collection Intelligence Platform. <strong>You're about to transform how you manage receivables.</strong>
      </p>

      <div style="background: linear-gradient(135deg, ${BRAND.primary} 0%, #2563eb 100%); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">
          🚀 Your Collection Intelligence Journey Starts Now
        </p>
        <p style="margin: 10px 0 0; color: rgba(255, 255, 255, 0.85); font-size: 14px;">
          Six AI agents are ready to transform your collections
        </p>
      </div>

      <p style="margin: 0 0 20px; color: #475569; font-size: 14px; line-height: 1.7;">
        At Recouply.ai, we believe that managing receivables shouldn't be a headache. Our AI-powered Collection Intelligence Platform handles collections intelligently, preserves customer relationships, and accelerates your cash flow.
      </p>

      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 10px; padding: 20px; margin: 24px 0; border: 1px solid #86efac;">
        <h3 style="margin: 0 0 14px; color: #166534; font-size: 16px; font-weight: 600;">
          🤖 What Makes Recouply Different
        </h3>
        <ul style="margin: 0; padding: 0 0 0 18px; color: #15803d; font-size: 14px; line-height: 2;">
          <li><strong>Six specialized AI agents</strong> working 24/7 on your collections</li>
          <li><strong>Risk-aware automation</strong> based on payment behavior intelligence</li>
          <li><strong>Human-in-the-loop AI</strong> — messages reviewed before sending</li>
          <li><strong>Predictive insights</strong> that help you act before risk compounds</li>
          <li><strong>Complete visibility</strong> into your collections health</li>
        </ul>
      </div>

      <h3 style="margin: 24px 0 14px; color: ${BRAND.foreground}; font-size: 16px; font-weight: 600;">
        🎯 Get Started in 3 Easy Steps
      </h3>
      <ol style="margin: 0; padding: 0 0 0 18px; color: #475569; font-size: 14px; line-height: 2.2;">
        <li><strong>Import your accounts & invoices</strong> — Upload via Data Center or add manually</li>
        <li><strong>Let AI configure your workflows</strong> — Automatic persona assignment by aging bucket</li>
        <li><strong>Watch your recovery improve</strong> — Act earlier, recover smarter</li>
      </ol>

      <div style="text-align: center; margin: 28px 0;">
        <a href="https://recouply.ai/dashboard" style="display: inline-block; background: linear-gradient(135deg, ${BRAND.accent} 0%, ${BRAND.accentDark} 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.35);">
          Go to Dashboard →
        </a>
      </div>

      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 14px; margin: 24px 0;">
        <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.6;">
          <strong>💡 Pro Tip:</strong> You'll receive a Daily Collections Health Digest every morning with key metrics, AI insights, and recommended actions to keep your cash flow healthy.
        </p>
      </div>

      <p style="margin: 24px 0; color: #475569; font-size: 14px; line-height: 1.7;">
        I personally read every response. If you have questions, feedback, or just want to chat about your collections strategy, hit reply — I'd love to hear from you.
      </p>

      <p style="margin: 0 0 8px; color: #475569; font-size: 14px; line-height: 1.7;">
        Here's to getting paid on time, every time. ✨
      </p>

      <div style="margin: 24px 0 0; padding-top: 18px; border-top: 1px solid ${BRAND.border};">
        <p style="margin: 0; color: ${BRAND.foreground}; font-size: 15px; font-weight: 600;">
          Sharad Chanana
        </p>
        <p style="margin: 4px 0 0; color: ${BRAND.muted}; font-size: 13px;">
          Founder & CEO, Recouply.ai
        </p>
        <p style="margin: 4px 0 0; color: ${BRAND.primary}; font-size: 12px; font-style: italic;">
          "Collect Your Money. Intelligently."
        </p>
      </div>
    `;

    const htmlContent = wrapEnterpriseEmail(bodyContent, {
      headerStyle: 'gradient',
      title: 'Welcome!',
      subtitle: 'Your Collection Intelligence Platform awaits',
    });

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Sharad Chanana - Recouply.ai <notifications@send.inbound.services.recouply.ai>",
        to: [email],
        reply_to: "sharad@recouply.ai",
        subject: "🎉 Welcome to Recouply.ai — Your Collection Intelligence Platform",
        html: htmlContent,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API error:", resendData);
      return new Response(
        JSON.stringify({ success: false, error: resendData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Welcome email sent successfully:", resendData);

    // Mark welcome_email_sent_at in the profile and create welcome alert
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ welcome_email_sent_at: new Date().toISOString() })
        .eq('email', email);

      if (updateError) {
        console.error("Failed to update welcome_email_sent_at:", updateError);
      } else {
        console.log("Marked welcome_email_sent_at for:", email);
      }

      // Create in-app welcome alert for the new user
      if (userId) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', userId)
          .single();

        const { error: alertError } = await supabase
          .from('user_alerts')
          .insert({
            user_id: userId,
            organization_id: userProfile?.organization_id || null,
            alert_type: 'welcome',
            severity: 'success',
            title: '🎉 Welcome to Recouply.ai!',
            message: `Hi ${displayName}! You're on your way to CashOps Excellence. Start by importing your accounts & invoices, then let our AI agents handle the rest.`,
            action_url: '/debtors',
            action_label: 'Add Your First Account',
            is_read: false,
            is_dismissed: false,
            metadata: { 
              userName: userName || null,
              companyName: companyName || null
            }
          });

        if (alertError) {
          console.error("Failed to create welcome alert:", alertError);
        } else {
          console.log("Created welcome alert for user:", userId);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message_id: resendData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
