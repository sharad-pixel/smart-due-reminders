import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EscalationRequest {
  user_id?: string;
  organization_id?: string;
  page_route: string;
  question: string;
  confidence_score?: number;
  escalation_reason: string;
  transcript_excerpt?: string;
  user_email?: string;
  user_name?: string;
  issue_category?: string;
  issue_description?: string;
  urgency?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const resend = new Resend(resendApiKey);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: EscalationRequest = await req.json();
    console.log('Escalation request received:', body);

    const {
      user_id,
      organization_id,
      page_route,
      question,
      confidence_score,
      escalation_reason,
      transcript_excerpt,
      user_email,
      user_name,
      issue_category,
      issue_description,
      urgency
    } = body;

    // Validate required fields
    if (!question || !page_route || !escalation_reason) {
      throw new Error('Missing required fields: question, page_route, escalation_reason');
    }

    // Log escalation to database
    const { data: escalationLog, error: insertError } = await supabaseClient
      .from('nicolas_escalations')
      .insert({
        user_id: user_id || null,
        organization_id: organization_id || null,
        page_route,
        question,
        confidence_score: confidence_score || null,
        escalation_reason,
        transcript_excerpt: transcript_excerpt || null,
        email_sent: false,
        user_name: user_name || null,
        user_email: user_email || null,
        issue_category: issue_category || null,
        urgency: urgency || 'medium'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error logging escalation:', insertError);
      // Continue anyway to send email
    }

    // Format the email body
    const userType = user_id ? 'Authenticated User' : 'Public Website Visitor';
    const timestamp = new Date().toISOString();
    const urgencyColor = urgency === 'high' ? '#dc2626' : urgency === 'medium' ? '#f59e0b' : '#10b981';
    const urgencyLabel = urgency === 'high' ? '🔴 HIGH PRIORITY' : urgency === 'medium' ? '🟡 Medium Priority' : '🟢 Low Priority';

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a; border-bottom: 2px solid ${urgencyColor}; padding-bottom: 10px;">
          🤖 Nicolas Support Escalation
        </h2>

        ${urgency === 'high' ? `
        <div style="background: #fef2f2; padding: 12px; border-radius: 8px; margin: 15px 0; border: 1px solid #fecaca;">
          <p style="margin: 0; color: #991b1b; font-weight: bold;">${urgencyLabel} - Immediate attention requested</p>
        </div>
        ` : ''}

        ${issue_category ? `
        <div style="margin: 15px 0;">
          <span style="background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 500;">
            ${issue_category}
          </span>
        </div>
        ` : ''}
        
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">User Question</h3>
          <p style="font-size: 16px; color: #1f2937; background: white; padding: 15px; border-radius: 6px; border-left: 4px solid ${urgencyColor};">
            ${question}
          </p>
        </div>

        ${issue_description ? `
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Issue Details</h3>
          <p style="font-size: 14px; color: #1f2937; background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #6366f1;">
            ${issue_description}
          </p>
        </div>
        ` : ''}

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">User Type</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${userType}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">User Name</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${user_name || 'Not provided'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">User Email</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${user_email || 'Not available'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Priority</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: ${urgencyColor}; font-weight: bold;">${urgencyLabel}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Page Route</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${page_route}</code></td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Timestamp</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${timestamp}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">User ID</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${user_id || 'Not logged in'}</td>
          </tr>
        </table>

        ${transcript_excerpt ? `
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Conversation Transcript</h3>
          <pre style="font-size: 13px; color: #4b5563; background: white; padding: 15px; border-radius: 6px; white-space: pre-wrap; overflow-x: auto;">
${transcript_excerpt}
          </pre>
        </div>
        ` : ''}

        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            <strong>Action Required:</strong> Please respond to this user's inquiry as soon as possible.
          </p>
        </div>

        <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; text-align: center;">
          This email was automatically generated by Nicolas, the Recouply.ai Knowledge Base Agent.
        </p>
      </div>
    `;

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: 'Recouply.ai <notifications@send.inbound.services.recouply.ai>',
      to: ['support@recouply.ai'],
      subject: `Nicolas Support Escalation – User Needs Assistance`,
      html: emailHtml,
      replyTo: user_email || undefined
    });

    console.log('Email sent successfully:', emailResponse);

    // Send Slack notification
    const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
    let slackSent = false;
    
    if (slackWebhookUrl) {
      try {
        // Determine urgency emoji
        const urgencyEmoji = urgency === 'high' ? '🔴' : urgency === 'medium' ? '🟡' : '🟢';
        const urgencyLabel = urgency === 'high' ? 'HIGH PRIORITY' : urgency === 'medium' ? 'Medium' : 'Low';
        
        const slackBlocks: any[] = [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `${urgencyEmoji} Nicolas Support Escalation`,
              emoji: true
            }
          }
        ];

        // Add category if provided
        if (issue_category) {
          slackBlocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Category:* ${issue_category}`
            }
          });
        }

        // Add the user's original question
        slackBlocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*User Question:*\n>${question}`
          }
        });

        // Add issue description if provided
        if (issue_description) {
          slackBlocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Issue Details:*\n>${issue_description}`
            }
          });
        }

        // Add user info fields
        slackBlocks.push({
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*User:*\n${user_name || 'Not provided'}`
            },
            {
              type: "mrkdwn",
              text: `*Email:*\n${user_email || 'Not available'}`
            },
            {
              type: "mrkdwn",
              text: `*Page:*\n\`${page_route}\``
            },
            {
              type: "mrkdwn",
              text: `*Priority:*\n${urgencyLabel}`
            }
          ]
        });

        // Add context footer
        slackBlocks.push({
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `${timestamp} | ${user_id ? 'Logged-in user' : 'Public visitor'}`
            }
          ]
        });

        // Add transcript if available
        if (transcript_excerpt) {
          slackBlocks.push({
            type: "divider"
          });
          slackBlocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Conversation:*\n\`\`\`${transcript_excerpt.substring(0, 2500)}\`\`\``
            }
          });
        }

        const slackMessage = { blocks: slackBlocks };

        const slackResponse = await fetch(slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackMessage)
        });

        if (slackResponse.ok) {
          slackSent = true;
          console.log('Slack notification sent successfully');
        } else {
          console.error('Slack webhook failed:', await slackResponse.text());
        }
      } catch (slackError) {
        console.error('Error sending Slack notification:', slackError);
      }
    } else {
      console.log('SLACK_WEBHOOK_URL not configured, skipping Slack notification');
    }

    // Update escalation log to mark notifications as sent
    if (escalationLog?.id) {
      await supabaseClient
        .from('nicolas_escalations')
        .update({ 
          email_sent: true,
          slack_sent: slackSent
        })
        .eq('id', escalationLog.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Escalation sent successfully',
        escalation_id: escalationLog?.id 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error in nicolas-escalate-support:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
