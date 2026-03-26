import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { wrapEnterpriseEmail, BRAND } from "../_shared/enterpriseEmailTemplate.ts";
import { INBOUND_EMAIL_DOMAIN } from "../_shared/emailConfig.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MentionNotificationRequest {
  mentionedUserId: string;
  senderName: string;
  senderId: string;
  taskId: string;
  taskSummary: string;
  noteContent?: string;
}

function generateMentionEmailBody(params: {
  recipientName: string;
  senderName: string;
  taskSummary: string;
  noteContent?: string;
  businessName: string;
}): string {
  const { recipientName, senderName, taskSummary, noteContent, businessName } = params;

  return `
    <p style="margin: 0 0 24px; color: ${BRAND.foreground}; font-size: 14px;">
      Hi <strong>${recipientName}</strong>,
    </p>
    <p style="margin: 0 0 24px; color: #475569; font-size: 14px; line-height: 1.7;">
      <strong style="color: ${BRAND.primary};">${senderName}</strong> mentioned you in a task note. Here are the details:
    </p>
    
    <!-- Task Card -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; border-left: 4px solid ${BRAND.primary}; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0 0 6px; color: ${BRAND.muted}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
            Related Task
          </p>
          <p style="margin: 0; color: ${BRAND.foreground}; font-size: 15px; font-weight: 600;">
            ${taskSummary}
          </p>
        </td>
      </tr>
    </table>
    
    ${noteContent ? `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; border-radius: 8px; margin-bottom: 24px; border: 1px solid ${BRAND.border};">
      <tr>
        <td style="padding: 16px 20px;">
          <p style="margin: 0 0 8px; color: ${BRAND.muted}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
            Note Content
          </p>
          <p style="margin: 0; color: #334155; font-size: 13px; background-color: white; padding: 12px; border-radius: 6px; border: 1px solid ${BRAND.border};">
            "${noteContent}"
          </p>
        </td>
      </tr>
    </table>
    ` : ""}
    
    <!-- CTA Button -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 24px;">
      <tr>
        <td align="center">
          <a href="https://recouply.ai/tasks" style="display: inline-block; background-color: ${BRAND.primary}; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 14px;">
            View Task &amp; Respond
          </a>
        </td>
      </tr>
    </table>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fef3c7; border-radius: 8px; margin-top: 24px; border: 1px solid #fde68a;">
      <tr>
        <td style="padding: 12px 16px;">
          <p style="margin: 0; color: #92400e; font-size: 12px;">
            💡 <strong>Tip:</strong> Reply to the note directly in Recouply to keep your team updated on this task.
          </p>
        </td>
      </tr>
    </table>
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

    if (!mentionedUserId || !taskId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: mentionedUser, error: userError } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("id", mentionedUserId)
      .single();

    if (userError || !mentionedUser?.email) {
      return new Response(
        JSON.stringify({ error: "Mentioned user not found or no email" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

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

    const bodyHtml = generateMentionEmailBody({
      recipientName: mentionedUser.name || "Team Member",
      senderName,
      taskSummary,
      noteContent,
      businessName,
    });

    const html = wrapEnterpriseEmail(bodyHtml, {
      headerStyle: 'gradient',
      title: '💬 You Were Mentioned',
      subtitle: businessName,
    });

    const emailResponse = await resend.emails.send({
      from: `Recouply.ai <notifications@send.inbound.services.recouply.ai>`,
      to: [mentionedUser.email],
      subject: `${senderName} mentioned you in a task - ${businessName}`,
      html,
      reply_to: `notifications@${INBOUND_EMAIL_DOMAIN}`,
    });

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
