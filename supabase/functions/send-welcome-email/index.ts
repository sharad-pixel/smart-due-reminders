import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Recouply.ai</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Recouply.ai</h1>
              <p style="margin: 8px 0 0; color: #93c5fd; font-size: 14px;">AI-Powered CashOps Platform</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1e293b; font-size: 24px; font-weight: 600;">
                Welcome to Recouply, ${displayName}!
              </h2>
              
              <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.6;">
                I'm Sharad Chanana, founder of Recouply.ai, and I'm thrilled to have you on board. You've just taken the first step toward transforming how you manage collections.
              </p>

              <div style="background-color: #f1f5f9; border-radius: 8px; padding: 24px; margin: 24px 0;">
                <h3 style="margin: 0 0 16px; color: #1e3a5f; font-size: 18px; font-weight: 600;">
                  💡 Why Collections Matter
                </h3>
                <ul style="margin: 0; padding: 0 0 0 20px; color: #475569; font-size: 15px; line-height: 1.8;">
                  <li><strong>Cash flow is the lifeblood of your business.</strong> Every unpaid invoice represents money that should be working for you.</li>
                  <li><strong>The average small business writes off 4% of their receivables</strong> as bad debt – that's pure profit loss.</li>
                  <li><strong>Manual follow-ups drain valuable time</strong> that could be spent growing your business.</li>
                  <li><strong>Inconsistent collection practices</strong> lead to strained customer relationships and missed revenue.</li>
                </ul>
              </div>

              <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); border-radius: 8px; padding: 24px; margin: 24px 0;">
                <h3 style="margin: 0 0 16px; color: #ffffff; font-size: 18px; font-weight: 600;">
                  🤖 How Recouply Transforms Your Collections
                </h3>
                <p style="margin: 0 0 12px; color: #e2e8f0; font-size: 15px; line-height: 1.6;">
                  Our platform deploys <strong>six specialized AI agents</strong> that work 24/7 to recover your revenue:
                </p>
                <ul style="margin: 0; padding: 0 0 0 20px; color: #e2e8f0; font-size: 15px; line-height: 1.8;">
                  <li>Automated, personalized outreach at the right time</li>
                  <li>Intelligent escalation based on invoice aging</li>
                  <li>Sentiment-aware communication that preserves relationships</li>
                  <li>Continuous learning from every interaction</li>
                </ul>
              </div>

              <h3 style="margin: 24px 0 16px; color: #1e293b; font-size: 18px; font-weight: 600;">
                🚀 Get Started in 3 Easy Steps
              </h3>
              <ol style="margin: 0; padding: 0 0 0 20px; color: #475569; font-size: 15px; line-height: 2;">
                <li><strong>Import your invoices</strong> – Upload a CSV or add them manually</li>
                <li><strong>Configure your AI agents</strong> – Customize tone and messaging</li>
                <li><strong>Watch collections happen automatically</strong> – Get paid faster</li>
              </ol>

              <div style="text-align: center; margin: 32px 0;">
                <a href="https://app.recouply.ai/dashboard" style="display: inline-block; background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                  Go to Your Dashboard →
                </a>
              </div>

              <p style="margin: 24px 0 0; color: #475569; font-size: 15px; line-height: 1.6;">
                I personally read every response. If you have questions, feedback, or just want to chat about CashOps, reply directly to this email.
              </p>

              <p style="margin: 24px 0 0; color: #475569; font-size: 15px; line-height: 1.6;">
                Here's to getting paid on time, every time.
              </p>

              <div style="margin: 32px 0 0;">
                <p style="margin: 0; color: #1e293b; font-size: 15px; font-weight: 600;">
                  Sharad Chanana
                </p>
                <p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">
                  Founder & CEO, Recouply.ai
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f1f5f9; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 13px;">
                Recouply.ai – AI-Powered Invoice Collection
              </p>
              <p style="margin: 8px 0 0; color: #94a3b8; font-size: 12px;">
                © ${new Date().getFullYear()} Recouply.ai. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Sharad Chanana - Recouply.ai <notifications@send.inbound.services.recouply.ai>",
        to: [email],
        subject: "Welcome to Recouply.ai – Your AI-Powered CashOps Platform",
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
