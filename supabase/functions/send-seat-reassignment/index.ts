import { Resend } from 'https://esm.sh/resend@2.0.0';
import { wrapEnterpriseEmail, BRAND } from "../_shared/enterpriseEmailTemplate.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-SEAT-REASSIGNMENT] ${step}${detailsStr}`);
};

interface ReassignmentRequest {
  newUserEmail: string;
  newUserName?: string;
  role: string;
  inviteToken?: string;
  isExistingUser: boolean;
  oldUserEmail?: string;
  oldUserName?: string;
  accountOwnerName: string;
  reassignedByName: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) throw new Error('RESEND_API_KEY not configured');

    const resend = new Resend(resendApiKey);
    const body: ReassignmentRequest = await req.json();
    const { newUserEmail, newUserName, role, inviteToken, isExistingUser, oldUserEmail, oldUserName, accountOwnerName, reassignedByName } = body;

    logStep('Processing reassignment emails', { newUserEmail, isExistingUser });

    const siteUrl = Deno.env.get('SITE_URL') || 'https://recouply.ai';
    const results: { newUserSent: boolean; oldUserSent: boolean; errors: string[] } = { newUserSent: false, oldUserSent: false, errors: [] };

    // EMAIL 1: New User
    try {
      let newUserBodyContent: string;
      let newUserSubject: string;
      const needsInviteAcceptance = !isExistingUser || inviteToken;

      if (isExistingUser && !inviteToken) {
        newUserSubject = `You've been added to ${accountOwnerName}'s team on Recouply.ai`;
        newUserBodyContent = `
          <h2 style="margin: 0 0 24px; color: ${BRAND.foreground}; font-size: 22px; font-weight: 700;">
            🎉 Welcome to the Team!
          </h2>
          <p style="margin: 0 0 20px; color: #475569; font-size: 14px; line-height: 1.7;">
            Great news! <strong>${reassignedByName}</strong> has added you to <strong>${accountOwnerName}'s</strong> team on Recouply.ai.
          </p>

          <div style="background-color: ${BRAND.primary}; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
            <p style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 700;">Your Role: ${role.charAt(0).toUpperCase() + role.slice(1)}</p>
            <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 13px;">You now have access to the team's collections data and AI agents</p>
          </div>

          <div style="background-color: #f0fdf4; border-left: 4px solid ${BRAND.accent}; border-radius: 4px; padding: 14px; margin: 24px 0;">
            <p style="margin: 0; color: #166534; font-size: 13px; line-height: 1.6;">
              <strong>✅ Immediate Access:</strong> Your account is already set up. Log in to start collaborating with your team.
            </p>
          </div>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${siteUrl}/dashboard" style="display: inline-block; background-color: ${BRAND.accent}; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 14px; font-weight: 600;">
              Go to Dashboard →
            </a>
          </div>

          <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0; border: 1px solid ${BRAND.border};">
            <h3 style="margin: 0 0 12px; color: ${BRAND.foreground}; font-size: 15px; font-weight: 600;">🚀 Quick Start Tips</h3>
            <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.8;">
              <li>Review assigned collection tasks in your inbox</li>
              <li>Check the dashboard for team activity overview</li>
              <li>Explore AI-powered outreach drafts awaiting approval</li>
            </ul>
          </div>
        `;
      } else {
        const setupLink = `${siteUrl}/accept-invite?token=${inviteToken}`;
        const ctaLabel = isExistingUser ? 'Accept Invitation →' : 'Accept & Set Up Account →';
        newUserSubject = `You're invited to join ${accountOwnerName}'s team on Recouply.ai`;

        newUserBodyContent = `
          <h2 style="margin: 0 0 24px; color: ${BRAND.foreground}; font-size: 22px; font-weight: 700;">
            🎉 ${isExistingUser ? "You've Been Invited to Join a Team!" : "You're Invited to Join a Team!"}
          </h2>
          <p style="margin: 0 0 20px; color: #475569; font-size: 14px; line-height: 1.7;">
            <strong>${reassignedByName}</strong> has invited you to join <strong>${accountOwnerName}'s</strong> team on Recouply.ai${isExistingUser ? '.' : ', the AI-powered Collection Intelligence Platform.'}
          </p>

          <div style="background-color: ${BRAND.primary}; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
            <p style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 700;">Your Role: ${role.charAt(0).toUpperCase() + role.slice(1)}</p>
            <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 13px;">You'll have access to the team's collections data and AI agents</p>
          </div>

          ${isExistingUser ? `
          <div style="background-color: #f0fdf4; border-left: 4px solid ${BRAND.accent}; border-radius: 4px; padding: 14px; margin: 24px 0;">
            <p style="margin: 0; color: #166534; font-size: 13px; line-height: 1.6;">
              <strong>✅ You already have an account!</strong> Just click below to accept the invitation and join the team.
            </p>
          </div>
          ` : `
          <div style="background-color: #f0fdf4; border-left: 4px solid ${BRAND.accent}; border-radius: 4px; padding: 14px; margin: 24px 0;">
            <h4 style="margin: 0 0 10px; color: #166534; font-size: 14px; font-weight: 600;">📋 What happens next:</h4>
            <ol style="margin: 0; padding-left: 20px; color: #166534; font-size: 13px; line-height: 1.8;">
              <li>Click the button below to accept</li>
              <li>Create your account with a secure password</li>
              <li>Complete your profile setup</li>
              <li>Start collaborating with your team!</li>
            </ol>
          </div>
          `}

          <div style="text-align: center; margin: 28px 0;">
            <a href="${setupLink}" style="display: inline-block; background-color: ${BRAND.accent}; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 14px; font-weight: 600;">
              ${ctaLabel}
            </a>
          </div>

          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 14px; margin: 24px 0;">
            <p style="margin: 0; color: #92400e; font-size: 12px; line-height: 1.6;">
              <strong>⏰ Important:</strong> This invitation expires in 7 days. If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        `;
      }

      const newUserHtml = wrapEnterpriseEmail(newUserBodyContent, {
        headerStyle: 'gradient',
        title: 'Team Invitation',
        subtitle: `Join ${accountOwnerName}'s team`,
      });

      await resend.emails.send({
        from: 'Recouply.ai <notifications@send.inbound.services.recouply.ai>',
        to: [newUserEmail],
        reply_to: 'support@recouply.ai',
        subject: newUserSubject,
        html: newUserHtml,
      });
      results.newUserSent = true;
    } catch (error) {
      results.errors.push(`New user email failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // EMAIL 2: Old User - Access Revoked
    if (oldUserEmail) {
      try {
        const oldUserDisplayName = oldUserName || oldUserEmail.split('@')[0];
        const oldUserBodyContent = `
          <h2 style="margin: 0 0 24px; color: ${BRAND.foreground}; font-size: 22px; font-weight: 700;">
            Team Access Update
          </h2>
          <p style="margin: 0 0 20px; color: #475569; font-size: 14px; line-height: 1.7;">Hi ${oldUserDisplayName},</p>
          <p style="margin: 0 0 20px; color: #475569; font-size: 14px; line-height: 1.7;">
            Your access to <strong>${accountOwnerName}'s</strong> team on Recouply.ai has been reassigned by <strong>${reassignedByName}</strong>.
          </p>

          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px; padding: 16px; margin: 24px 0;">
            <h4 style="margin: 0 0 10px; color: #991b1b; font-size: 14px; font-weight: 600;">🔒 What this means:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #991b1b; font-size: 13px; line-height: 1.8;">
              <li>Your access to this team's data has been revoked</li>
              <li>Any tasks previously assigned to you have been unassigned</li>
              <li>You will no longer receive notifications for this team</li>
            </ul>
          </div>

          <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0; border: 1px solid ${BRAND.border};">
            <h3 style="margin: 0 0 12px; color: ${BRAND.foreground}; font-size: 15px; font-weight: 600;">Have questions?</h3>
            <p style="margin: 0; color: #475569; font-size: 13px; line-height: 1.7;">
              If you believe this was done in error, please contact your team administrator or reach out to ${accountOwnerName} directly.
            </p>
          </div>

          <p style="margin: 24px 0; color: ${BRAND.muted}; font-size: 13px; line-height: 1.7;">
            If you have your own Recouply.ai account or are part of other teams, those access rights remain unchanged.
          </p>
        `;

        const oldUserHtml = wrapEnterpriseEmail(oldUserBodyContent, {
          headerStyle: 'light',
          title: 'Access Update',
        });

        await resend.emails.send({
          from: 'Recouply.ai <notifications@send.inbound.services.recouply.ai>',
          to: [oldUserEmail],
          reply_to: 'support@recouply.ai',
          subject: `Your access to ${accountOwnerName}'s team has been reassigned`,
          html: oldUserHtml,
        });
        results.oldUserSent = true;
      } catch (error) {
        results.errors.push(`Old user email failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    return new Response(JSON.stringify({ success: results.newUserSent || results.oldUserSent, ...results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logStep('Error', { error: error instanceof Error ? error.message : error });
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
