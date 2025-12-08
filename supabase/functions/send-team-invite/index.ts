import { Resend } from 'https://esm.sh/resend@2.0.0';
import { wrapEmailContent } from "../_shared/emailSignature.ts";

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
      <h2 style="margin: 0 0 24px; color: #1e293b; font-size: 26px; font-weight: 700;">
        🎉 You're Invited to Join a Team!
      </h2>
      
      <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.7;">
        <strong>${inviterName || 'A team admin'}</strong> has invited you to join <strong>${accountOwnerName || 'their organization'}</strong> on Recouply.ai, the AI-powered CashOps platform.
      </p>

      <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); border-radius: 12px; padding: 28px; margin: 28px 0; text-align: center;">
        <p style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">
          Your Role: ${role.charAt(0).toUpperCase() + role.slice(1)}
        </p>
        <p style="margin: 12px 0 0; color: #93c5fd; font-size: 15px;">
          You'll have access to the team's collections data and AI agents
        </p>
      </div>

      <div style="background-color: #f1f5f9; border-radius: 8px; padding: 24px; margin: 24px 0;">
        <h3 style="margin: 0 0 16px; color: #1e3a5f; font-size: 18px; font-weight: 600;">
          📋 Invitation Details
        </h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 120px;">Email:</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Role:</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${role.charAt(0).toUpperCase() + role.slice(1)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Invited By:</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${inviterName || 'Team Admin'}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 17px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.3);">
          Accept Invitation →
        </a>
      </div>

      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
          <strong>⏰ Important:</strong> This invitation expires in 7 days. If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>

      <p style="margin: 24px 0 0; color: #64748b; font-size: 14px; text-align: center;">
        Questions? Contact us at <a href="mailto:support@recouply.ai" style="color: #1e3a5f;">support@recouply.ai</a>
      </p>
    `;

    const branding = {
      business_name: "RecouplyAI Inc.",
      from_name: "Recouply.ai",
      primary_color: "#1e3a5f"
    };

    const htmlContent = wrapEmailContent(bodyContent, branding);

    const emailResponse = await resend.emails.send({
      from: 'RecouplyAI Inc. <notifications@send.inbound.services.recouply.ai>',
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
