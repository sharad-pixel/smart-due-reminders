import { wrapEnterpriseEmail, BRAND } from "../_shared/enterpriseEmailTemplate.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReferralInviteRequest {
  email: string;
  referralCode: string;
  referrerName: string;
  referrerCompany: string;
  signupLink: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) throw new Error('RESEND_API_KEY not configured');

    const { Resend } = await import('https://esm.sh/resend@2.0.0');
    const resend = new Resend(resendApiKey);

    const body: ReferralInviteRequest = await req.json();
    const { email, referralCode, referrerName, referrerCompany, signupLink } = body;

    if (!email || !signupLink) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bodyContent = `
      <h2 style="margin: 0 0 24px; color: ${BRAND.foreground}; font-size: 22px; font-weight: 700;">
        🎉 You've Been Invited to Try Recouply.ai!
      </h2>
      
      <p style="margin: 0 0 20px; color: #475569; font-size: 14px; line-height: 1.7;">
        <strong>${referrerName}</strong>${referrerCompany ? ` from <strong>${referrerCompany}</strong>` : ''} thinks you'd love Recouply.ai — the Collections & Risk Intelligence Platform that helps businesses get paid faster with AI-powered automation.
      </p>

      <div style="background-color: ${BRAND.surfaceLight}; border: 1px solid ${BRAND.border}; border-radius: 8px; padding: 24px; margin: 24px 0;">
        <h3 style="margin: 0 0 14px; color: ${BRAND.foreground}; font-size: 16px; font-weight: 600;">
          ✨ What you'll get with Recouply.ai
        </h3>
        <ul style="margin: 0; padding: 0 0 0 18px; color: #475569; font-size: 13px; line-height: 2;">
          <li>AI-powered collection agents that work 24/7</li>
          <li>Smart risk scoring for every customer</li>
          <li>Automated outreach workflows</li>
          <li>Real-time payment tracking & analytics</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${signupLink}" style="display: inline-block; background-color: ${BRAND.accent}; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-size: 15px; font-weight: 600;">
          Get Started Free →
        </a>
      </div>

      <div style="background-color: #f0fdf4; border-left: 4px solid ${BRAND.accent}; border-radius: 4px; padding: 14px; margin: 24px 0;">
        <p style="margin: 0; color: #166534; font-size: 12px; line-height: 1.6;">
          <strong>🎁 Bonus:</strong> When you subscribe to a paid plan, both you and ${referrerName} earn bonus invoice credits!
        </p>
      </div>

      <p style="margin: 0; color: ${BRAND.muted}; font-size: 11px; text-align: center;">
        Referral Code: <strong>${referralCode}</strong>
      </p>
    `;

    const htmlContent = wrapEnterpriseEmail(bodyContent, {
      headerStyle: 'gradient',
      title: 'You\'re Invited!',
      subtitle: `${referrerName} thinks you'll love Recouply.ai`,
    });

    const emailResponse = await resend.emails.send({
      from: 'Recouply.ai <notifications@send.inbound.services.recouply.ai>',
      to: [email],
      reply_to: 'support@recouply.ai',
      subject: `${referrerName} invited you to try Recouply.ai — Get bonus credits!`,
      html: htmlContent,
    });

    return new Response(JSON.stringify({ success: true, data: emailResponse.data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[SEND-REFERRAL-INVITE] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
