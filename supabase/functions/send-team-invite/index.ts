import { Resend } from 'https://esm.sh/resend@2.0.0';

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

    const emailResponse = await resend.emails.send({
      from: 'Recouply.ai <notifications@send.inbound.services.recouply.ai>',
      to: [email],
      subject: `You're invited to join ${accountOwnerName || 'a team'} on Recouply.ai`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #7C3AED; margin: 0;">Recouply.ai</h1>
          </div>
          
          <div style="background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%); border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 30px;">
            <h2 style="color: white; margin: 0 0 10px 0;">You're Invited!</h2>
            <p style="color: rgba(255,255,255,0.9); margin: 0;">
              ${inviterName || 'A team admin'} has invited you to join their team on Recouply.ai
            </p>
          </div>
          
          <div style="background: #F9FAFB; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <p style="margin: 0 0 10px 0;"><strong>Role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1)}</p>
            <p style="margin: 0;"><strong>Email:</strong> ${email}</p>
          </div>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${inviteLink}" style="display: inline-block; background: #7C3AED; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Accept Invitation
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; text-align: center;">
            This invitation expires in 7 days. If you didn't expect this invitation, you can safely ignore this email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            Recouply.ai - AI-Powered Collections Management
          </p>
        </body>
        </html>
      `,
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
