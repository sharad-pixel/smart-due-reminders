import { Resend } from 'https://esm.sh/resend@2.0.0';
import { wrapEnterpriseEmail, BRAND } from "../_shared/enterpriseEmailTemplate.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-TEAM-INVITE] ${step}${detailsStr}`);
};

interface InviteRequest {
  email: string;
  role: string;
  inviterName: string;
  accountOwnerName: string;
  inviteToken: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const resend = new Resend(resendApiKey);
    const body: InviteRequest = await req.json();
    const { email, role, inviterName, accountOwnerName, inviteToken } = body;

    logStep('Sending invite email', { email, role, inviterName });

    const siteUrl = Deno.env.get('SITE_URL') || 'https://recouply.ai';
    const inviteLink = `${siteUrl}/accept-invite?token=${inviteToken}`;

    const bodyContent = `
      <h2 style="margin: 0 0 24px; color: ${BRAND.foreground}; font-size: 22px; font-weight: 700;">
        🎉 You're Invited to Join a Team!
      </h2>
      
      <p style="margin: 0 0 20px; color: #475569; font-size: 14px; line-height: 1.7;">
        <strong>${inviterName || 'A team admin'}</strong> has invited you to join <strong>${accountOwnerName || 'their organization'}</strong> on Recouply.ai, the AI-powered Collection Intelligence Platform.
      </p>

      <div style="background: linear-gradient(135deg, ${BRAND.primary}15 0%, ${BRAND.primaryDark}15 100%); border: 1px solid ${BRAND.border}; border-radius: 12px; padding: 28px; margin: 28px 0; text-align: center;">
        <p style="margin: 0; color: ${BRAND.foreground}; font-size: 18px; font-weight: 700;">
          Your Role: ${role.charAt(0).toUpperCase() + role.slice(1)}
        </p>
        <p style="margin: 12px 0 0; color: ${BRAND.muted}; font-size: 14px;">
          You'll have access to the team's collections data and AI agents
        </p>
      </div>

      <div style="background-color: ${BRAND.surfaceLight}; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 14px; color: ${BRAND.foreground}; font-size: 16px; font-weight: 600;">
          📋 Invitation Details
        </h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: ${BRAND.muted}; font-size: 13px; width: 100px;">Email:</td>
            <td style="padding: 6px 0; color: ${BRAND.foreground}; font-size: 13px; font-weight: 500;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: ${BRAND.muted}; font-size: 13px;">Role:</td>
            <td style="padding: 6px 0; color: ${BRAND.foreground}; font-size: 13px; font-weight: 500;">${role.charAt(0).toUpperCase() + role.slice(1)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: ${BRAND.muted}; font-size: 13px;">Invited By:</td>
            <td style="padding: 6px 0; color: ${BRAND.foreground}; font-size: 13px; font-weight: 500;">${inviterName || 'Team Admin'}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND.accent} 0%, ${BRAND.accentDark} 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.35);">
          Accept Invitation →
        </a>
      </div>

      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 14px; margin: 24px 0;">
        <p style="margin: 0; color: #92400e; font-size: 12px; line-height: 1.6;">
          <strong>⏰ Important:</strong> This invitation expires in 7 days. If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    `;

    const htmlContent = wrapEnterpriseEmail(bodyContent, {
      headerStyle: 'gradient',
      title: 'Team Invitation',
      subtitle: `Join ${accountOwnerName || 'a team'} on Recouply.ai`,
    });

    const emailResponse = await resend.emails.send({
      from: 'Recouply.ai <notifications@send.inbound.services.recouply.ai>',
      to: [email],
      reply_to: 'support@recouply.ai',
      subject: `You're invited to join ${accountOwnerName || 'a team'} on Recouply.ai`,
      html: htmlContent,
    });

    logStep('Email sent successfully', { data: emailResponse.data });

    return new Response(JSON.stringify({ success: true, data: emailResponse.data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logStep('Error sending email', { error: error instanceof Error ? error.message : error });
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
