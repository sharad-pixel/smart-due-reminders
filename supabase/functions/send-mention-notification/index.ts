import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { INBOUND_EMAIL_DOMAIN } from "../_shared/emailConfig.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Enterprise Company Info - use inbound domain for reply-capable addresses
const COMPANY_INFO = {
  legalName: "RecouplyAI Inc.",
  displayName: "Recouply.ai",
  tagline: "AI-Powered CashOps Platform",
  website: "https://recouply.ai",
  emails: {
    notifications: `notifications@${INBOUND_EMAIL_DOMAIN}`,
    support: `support@${INBOUND_EMAIL_DOMAIN}`,
    collections: `collections@${INBOUND_EMAIL_DOMAIN}`,
  },
  address: "Delaware, USA",
};

interface MentionNotificationRequest {
  mentionedUserId: string;
  senderName: string;
  senderId: string;
  taskId: string;
  taskSummary: string;
  noteContent?: string;
}

function generateEnterpriseMentionEmail(params: {
  recipientName: string;
  senderName: string;
  taskSummary: string;
  noteContent?: string;
  taskId: string;
  businessName: string;
  primaryColor: string;
  logoUrl?: string;
}): string {
  const { recipientName, senderName, taskSummary, noteContent, taskId, businessName, primaryColor, logoUrl } = params;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>You were mentioned - ${businessName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${primaryColor} 0%, #7c3aed 100%); border-radius: 16px 16px 0 0; padding: 32px 40px; text-align: center;">
              ${logoUrl 
                ? `<img src="${logoUrl}" alt="${businessName}" style="max-height: 48px; max-width: 180px; height: auto; margin-bottom: 16px;" />`
                : `<h1 style="color: #ffffff; margin: 0 0 8px; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">${businessName}</h1>`
              }
              <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 14px; font-weight: 500;">
                💬 You Were Mentioned
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px;">
              <p style="margin: 0 0 24px; color: #1e293b; font-size: 16px;">
                Hi <strong>${recipientName}</strong>,
              </p>
              <p style="margin: 0 0 28px; color: #475569; font-size: 15px;">
                <strong style="color: #7c3aed;">${senderName}</strong> mentioned you in a task note. Here are the details:
              </p>
              
              <!-- Task Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); border-left: 4px solid #7c3aed; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 8px; color: #6d28d9; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                      Related Task
                    </p>
                    <p style="margin: 0; color: #4c1d95; font-size: 16px; font-weight: 600;">
                      ${taskSummary}
                    </p>
                  </td>
                </tr>
              </table>
              
              ${noteContent ? `
              <!-- Note Content -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fafafa; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin: 0 0 12px; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                      Note Content
                    </p>
                    <p style="margin: 0; color: #334155; font-size: 14px; background-color: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
                      "${noteContent}"
                    </p>
                  </td>
                </tr>
              </table>
              ` : ""}
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 32px;">
                <tr>
                  <td align="center">
                    <a href="https://recouply.ai/tasks" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
                      View Task &amp; Respond
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Tip -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fef3c7; border-radius: 12px; margin-top: 28px;">
                <tr>
                  <td style="padding: 16px 24px;">
                    <p style="margin: 0; color: #92400e; font-size: 13px;">
                      💡 <strong>Tip:</strong> Reply to the note directly in Recouply to keep your team updated on this task.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Enterprise Footer -->
          <tr>
            <td style="background-color: #0f172a; border-radius: 0 0 16px 16px; padding: 32px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 20px;">
                      <tr>
                        <td style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); width: 40px; height: 40px; border-radius: 10px; text-align: center; vertical-align: middle;">
                          <span style="color: #ffffff; font-weight: bold; font-size: 18px;">R</span>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 600;">${COMPANY_INFO.displayName}</p>
                          <p style="margin: 2px 0 0; color: #94a3b8; font-size: 12px;">${COMPANY_INFO.tagline}</p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Feature Badges -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 20px;">
                      <tr>
                        <td style="padding: 0 8px;">
                          <span style="background-color: rgba(124, 58, 237, 0.2); color: #a78bfa; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 500;">
                            🤖 AI-Powered
                          </span>
                        </td>
                        <td style="padding: 0 8px;">
                          <span style="background-color: rgba(34, 197, 94, 0.2); color: #4ade80; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 500;">
                            👥 Team Collaboration
                          </span>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 0 0 16px; color: #94a3b8; font-size: 12px;">
                      <a href="mailto:${COMPANY_INFO.emails.support}" style="color: #a78bfa; text-decoration: none;">Support</a>
                      &nbsp;•&nbsp;
                      <a href="${COMPANY_INFO.website}" style="color: #a78bfa; text-decoration: none;">Website</a>
                    </p>
                    
                    <p style="margin: 16px 0 0; color: #64748b; font-size: 11px;">
                      © ${new Date().getFullYear()} ${COMPANY_INFO.legalName}. All rights reserved.
                    </p>
                    <p style="margin: 4px 0 0; color: #475569; font-size: 10px;">
                      This notification was sent via ${COMPANY_INFO.displayName} on behalf of <strong>${businessName}</strong>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: MentionNotificationRequest = await req.json();
    const { mentionedUserId, senderName, senderId, taskId, taskSummary, noteContent } = body;

    console.log("[SEND-MENTION-NOTIFICATION] Received request:", JSON.stringify(body));

    if (!mentionedUserId || !taskId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch mentioned user's profile
    const { data: mentionedUser, error: userError } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("id", mentionedUserId)
      .single();

    if (userError || !mentionedUser?.email) {
      console.error("[SEND-MENTION-NOTIFICATION] User not found or no email:", userError);
      return new Response(
        JSON.stringify({ error: "Mentioned user not found or no email" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch sender's organization branding
    const { data: task } = await supabase
      .from("collection_tasks")
      .select("user_id")
      .eq("id", taskId)
      .single();

    const { data: branding } = await supabase
      .from("branding_settings")
      .select("logo_url, business_name, primary_color")
      .eq("user_id", task?.user_id || senderId)
      .maybeSingle();

    const businessName = branding?.business_name || "Your Organization";
    const primaryColor = branding?.primary_color || "#7c3aed";

    // Generate enterprise email
    const html = generateEnterpriseMentionEmail({
      recipientName: mentionedUser.name || "Team Member",
      senderName,
      taskSummary,
      noteContent,
      taskId,
      businessName,
      primaryColor,
      logoUrl: branding?.logo_url,
    });

    // Send email
    const emailResponse = await resend.emails.send({
      from: `${COMPANY_INFO.displayName} <notifications@send.inbound.services.recouply.ai>`,
      to: [mentionedUser.email],
      subject: `${senderName} mentioned you in a task - ${businessName}`,
      html,
      reply_to: COMPANY_INFO.emails.notifications,
    });

    console.log("[SEND-MENTION-NOTIFICATION] Email sent:", emailResponse);

    // Also create in-app notification
    await supabase.from("user_notifications").insert({
      user_id: mentionedUserId,
      type: "mention",
      title: "You were mentioned in a task note",
      message: `${senderName} mentioned you in: "${taskSummary.substring(0, 50)}${taskSummary.length > 50 ? '...' : ''}"`,
      link: `/tasks`,
      source_type: "task",
      source_id: taskId,
      sender_id: senderId,
      sender_name: senderName,
    });

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[SEND-MENTION-NOTIFICATION] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
