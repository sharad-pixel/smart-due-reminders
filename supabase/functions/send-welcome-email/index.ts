import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { wrapEmailContent, generateEmailSignature } from "../_shared/emailSignature.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  companyName?: string;
  userName?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("RESEND_API_KEY is not configured");
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { email, companyName, userName }: WelcomeEmailRequest = await req.json();
    
    console.log("Sending welcome email to:", email, "Company:", companyName);

    const displayName = userName || companyName || "there";

    // Build email body content
    const bodyContent = `
      <h2 style="margin: 0 0 24px; color: #1e293b; font-size: 26px; font-weight: 700;">
        🎉 Welcome to CashOps Excellence!
      </h2>
      
      <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.7;">
        Hi ${displayName},
      </p>

      <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.7;">
        I'm <strong>Sharad Chanana</strong>, founder of Recouply.ai, and I'm personally thrilled to welcome you to our platform. <strong>You're on your way to CashOps Excellence!</strong>
      </p>

      <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); border-radius: 12px; padding: 28px; margin: 28px 0; text-align: center;">
        <p style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">
          🚀 Your Journey to CashOps Excellence Starts Now
        </p>
        <p style="margin: 12px 0 0; color: #93c5fd; font-size: 15px;">
          Six AI agents are ready to transform your collections
        </p>
      </div>

      <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.7;">
        At Recouply.ai, we believe that managing cash flow shouldn't be a headache. That's why we've built an AI-powered CashOps platform that handles collections intelligently, preserves customer relationships, and gets you paid faster.
      </p>

      <div style="background-color: #f1f5f9; border-radius: 8px; padding: 24px; margin: 24px 0;">
        <h3 style="margin: 0 0 16px; color: #1e3a5f; font-size: 18px; font-weight: 600;">
          🤖 What Makes Recouply Different
        </h3>
        <ul style="margin: 0; padding: 0 0 0 20px; color: #475569; font-size: 15px; line-height: 2;">
          <li><strong>Six specialized AI agents</strong> working around the clock</li>
          <li><strong>Intelligent escalation</strong> based on invoice aging and customer behavior</li>
          <li><strong>Sentiment-aware messaging</strong> that preserves relationships</li>
          <li><strong>Continuous learning</strong> – our agents get smarter with every interaction</li>
          <li><strong>Complete visibility</strong> into your collections health</li>
        </ul>
      </div>

      <h3 style="margin: 24px 0 16px; color: #1e293b; font-size: 18px; font-weight: 600;">
        🎯 Get Started in 3 Easy Steps
      </h3>
      <ol style="margin: 0; padding: 0 0 0 20px; color: #475569; font-size: 15px; line-height: 2.2;">
        <li><strong>Import your accounts & invoices</strong> – Upload a CSV or add them manually</li>
        <li><strong>Let AI configure your workflows</strong> – Automatic persona assignment by aging bucket</li>
        <li><strong>Watch your cash flow improve</strong> – Get paid faster with less effort</li>
      </ol>

      <div style="text-align: center; margin: 32px 0;">
        <a href="https://app.recouply.ai/dashboard" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 17px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.3);">
          Start Your CashOps Journey →
        </a>
      </div>

      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
          <strong>💡 Pro Tip:</strong> You'll also receive a Daily Collections Health Digest every morning with key metrics, AI insights, and recommended actions to keep your cash flow on track.
        </p>
      </div>

      <p style="margin: 24px 0; color: #475569; font-size: 15px; line-height: 1.7;">
        I personally read every response. If you have questions, feedback, or just want to chat about how to optimize your CashOps strategy, hit reply – I'd love to hear from you.
      </p>

      <p style="margin: 0 0 8px; color: #475569; font-size: 15px; line-height: 1.7;">
        Here's to getting paid on time, every time. ✨
      </p>

      <div style="margin: 28px 0 0; padding-top: 20px; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">
          Sharad Chanana
        </p>
        <p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">
          Founder & CEO, Recouply.ai
        </p>
        <p style="margin: 4px 0 0; color: #64748b; font-size: 13px; font-style: italic;">
          "Transforming how businesses manage cash flow"
        </p>
      </div>
    `;

    // Use shared branding wrapper
    const branding = {
      business_name: "Recouply.ai",
      from_name: "Sharad Chanana",
      primary_color: "#1e3a5f"
    };

    const htmlContent = wrapEmailContent(bodyContent, branding);

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
        subject: "🎉 Welcome to Recouply.ai – You're on Your Way to CashOps Excellence!",
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
