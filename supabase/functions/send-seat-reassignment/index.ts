import { Resend } from 'https://esm.sh/resend@2.0.0';
import { wrapEmailContent } from "../_shared/emailSignature.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-SEAT-REASSIGNMENT] ${step}${detailsStr}`);
};

interface ReassignmentRequest {
  // New user details
  newUserEmail: string;
  newUserName?: string;
  role: string;
  inviteToken?: string; // Only for new users who need to sign up
  isExistingUser: boolean;
  
  // Old user details
  oldUserEmail?: string;
  oldUserName?: string;
  
  // Context
  accountOwnerName: string;
  reassignedByName: string;
}

const branding = {
  business_name: "RecouplyAI Inc.",
  from_name: "Recouply.ai",
  primary_color: "#1e3a5f"
};

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
    const body: ReassignmentRequest = await req.json();
    const { 
      newUserEmail, 
      newUserName,
      role, 
      inviteToken,
      isExistingUser,
      oldUserEmail, 
      oldUserName,
      accountOwnerName,
      reassignedByName
    } = body;

    logStep('Processing reassignment emails', { newUserEmail, oldUserEmail, isExistingUser });

    const siteUrl = Deno.env.get('SITE_URL') || 'https://recouply.ai';
    const results: { newUserSent: boolean; oldUserSent: boolean; errors: string[] } = {
      newUserSent: false,
      oldUserSent: false,
      errors: []
    };

    // ============================================
    // EMAIL 1: New User - Welcome / Setup Email
    // ============================================
    try {
      let newUserBodyContent: string;
      let newUserSubject: string;
      
      if (isExistingUser) {
        // Existing user - immediate access, link to dashboard
        newUserSubject = `You've been added to ${accountOwnerName}'s team on Recouply.ai`;
        newUserBodyContent = `
          <h2 style="margin: 0 0 24px; color: #1e293b; font-size: 26px; font-weight: 700;">
            🎉 Welcome to the Team!
          </h2>
          
          <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.7;">
            Great news! <strong>${reassignedByName}</strong> has added you to <strong>${accountOwnerName}'s</strong> team on Recouply.ai.
          </p>

          <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); border-radius: 12px; padding: 28px; margin: 28px 0; text-align: center;">
            <p style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">
              Your Role: ${role.charAt(0).toUpperCase() + role.slice(1)}
            </p>
            <p style="margin: 12px 0 0; color: #d1fae5; font-size: 15px;">
              You now have access to the team's collections data and AI agents
            </p>
          </div>

          <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 4px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; color: #166534; font-size: 14px; line-height: 1.6;">
              <strong>✅ Immediate Access:</strong> Your account is already set up. Log in to start collaborating with your team.
            </p>
          </div>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${siteUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 17px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(30, 58, 95, 0.3);">
              Go to Dashboard →
            </a>
          </div>

          <div style="background-color: #f1f5f9; border-radius: 8px; padding: 24px; margin: 24px 0;">
            <h3 style="margin: 0 0 16px; color: #1e3a5f; font-size: 18px; font-weight: 600;">
              🚀 Quick Start Tips
            </h3>
            <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.8;">
              <li>Review assigned collection tasks in your inbox</li>
              <li>Check the dashboard for team activity overview</li>
              <li>Explore AI-powered outreach drafts awaiting approval</li>
            </ul>
          </div>
        `;
      } else {
        // New user - needs to accept invite and set up account
        const setupLink = `${siteUrl}/accept-invite?token=${inviteToken}`;
        newUserSubject = `You're invited to join ${accountOwnerName}'s team on Recouply.ai`;
        newUserBodyContent = `
          <h2 style="margin: 0 0 24px; color: #1e293b; font-size: 26px; font-weight: 700;">
            🎉 You're Invited to Join a Team!
          </h2>
          
          <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.7;">
            <strong>${reassignedByName}</strong> has invited you to join <strong>${accountOwnerName}'s</strong> team on Recouply.ai, the AI-powered CashOps platform.
          </p>

          <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); border-radius: 12px; padding: 28px; margin: 28px 0; text-align: center;">
            <p style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">
              Your Role: ${role.charAt(0).toUpperCase() + role.slice(1)}
            </p>
            <p style="margin: 12px 0 0; color: #93c5fd; font-size: 15px;">
              You'll have access to the team's collections data and AI agents
            </p>
          </div>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${setupLink}" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 17px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.3);">
              Accept & Set Up Account →
            </a>
          </div>

          <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 4px; padding: 16px; margin: 24px 0;">
            <h4 style="margin: 0 0 12px; color: #166534; font-size: 15px; font-weight: 600;">
              📋 What happens next:
            </h4>
            <ol style="margin: 0; padding-left: 20px; color: #166534; font-size: 14px; line-height: 1.8;">
              <li>Click the button above to accept the invitation</li>
              <li>Create your account with a secure password</li>
              <li>Complete your profile setup</li>
              <li>Start collaborating with your team!</li>
            </ol>
          </div>

          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
              <strong>⏰ Important:</strong> This invitation expires in 7 days. If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        `;
      }

      const newUserHtml = wrapEmailContent(newUserBodyContent, branding);

      const newUserEmailResponse = await resend.emails.send({
        from: 'RecouplyAI Inc. <notifications@send.inbound.services.recouply.ai>',
        to: [newUserEmail],
        reply_to: 'support@recouply.ai',
        subject: newUserSubject,
        html: newUserHtml,
      });

      logStep('New user email sent', { data: newUserEmailResponse.data });
      results.newUserSent = true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logStep('Failed to send new user email', { error: errorMsg });
      results.errors.push(`New user email failed: ${errorMsg}`);
    }

    // ============================================
    // EMAIL 2: Old User - Access Revoked Notice
    // ============================================
    if (oldUserEmail) {
      try {
        const oldUserDisplayName = oldUserName || oldUserEmail.split('@')[0];
        
        const oldUserBodyContent = `
          <h2 style="margin: 0 0 24px; color: #1e293b; font-size: 26px; font-weight: 700;">
            Team Access Update
          </h2>
          
          <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.7;">
            Hi ${oldUserDisplayName},
          </p>
          
          <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.7;">
            This is to inform you that your access to <strong>${accountOwnerName}'s</strong> team on Recouply.ai has been reassigned by <strong>${reassignedByName}</strong>.
          </p>

          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px; padding: 20px; margin: 24px 0;">
            <h4 style="margin: 0 0 12px; color: #991b1b; font-size: 15px; font-weight: 600;">
              🔒 What this means:
            </h4>
            <ul style="margin: 0; padding-left: 20px; color: #991b1b; font-size: 14px; line-height: 1.8;">
              <li>Your access to this team's data has been revoked</li>
              <li>Any tasks previously assigned to you have been unassigned</li>
              <li>You will no longer receive notifications for this team</li>
            </ul>
          </div>

          <div style="background-color: #f1f5f9; border-radius: 8px; padding: 24px; margin: 24px 0;">
            <h3 style="margin: 0 0 16px; color: #1e3a5f; font-size: 18px; font-weight: 600;">
              Have questions?
            </h3>
            <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.7;">
              If you believe this was done in error, please contact your team administrator or reach out to ${accountOwnerName} directly.
            </p>
          </div>

          <p style="margin: 24px 0; color: #64748b; font-size: 14px; line-height: 1.7;">
            If you have your own Recouply.ai account or are part of other teams, those access rights remain unchanged.
          </p>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 24px;">
            <p style="margin: 0; color: #64748b; font-size: 13px; text-align: center;">
              Questions? Contact us at <a href="mailto:support@recouply.ai" style="color: #1e3a5f;">support@recouply.ai</a>
            </p>
          </div>
        `;

        const oldUserHtml = wrapEmailContent(oldUserBodyContent, branding);

        const oldUserEmailResponse = await resend.emails.send({
          from: 'RecouplyAI Inc. <notifications@send.inbound.services.recouply.ai>',
          to: [oldUserEmail],
          reply_to: 'support@recouply.ai',
          subject: `Your access to ${accountOwnerName}'s team has been reassigned`,
          html: oldUserHtml,
        });

        logStep('Old user email sent', { data: oldUserEmailResponse.data });
        results.oldUserSent = true;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        logStep('Failed to send old user email', { error: errorMsg });
        results.errors.push(`Old user email failed: ${errorMsg}`);
      }
    }

    return new Response(JSON.stringify({ 
      success: results.newUserSent || results.oldUserSent,
      ...results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logStep('Error in send-seat-reassignment', { error: error instanceof Error ? error.message : error });
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
