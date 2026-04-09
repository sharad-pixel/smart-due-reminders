import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { wrapEnterpriseEmail, BRAND } from "../_shared/enterpriseEmailTemplate.ts";

/**
 * CONSOLIDATED INBOUND TASK NOTIFICATION
 * 
 * Sends ONE email per inbound email, listing all AI-extracted tasks together.
 * This replaces the per-task notify-task-created calls for inbound AI tasks.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const formatTaskType = (type: string) =>
  type.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

const getPriorityColor = (priority: string) => {
  switch (priority?.toLowerCase()) {
    case "urgent": return "#dc2626";
    case "high": return "#ea580c";
    case "normal": return "#3b82f6";
    case "low": return "#6b7280";
    default: return "#3b82f6";
  }
};

interface InboundTasksRequest {
  taskIds: string[];
  inboundEmailId: string;
  creatorUserId: string;
}

function generateConsolidatedEmailHtml(params: {
  recipientName: string;
  inboundEmail: any;
  tasks: any[];
  debtorName: string;
}): string {
  const { recipientName, inboundEmail, tasks, debtorName } = params;

  const taskRows = tasks.map((t: any) => {
    const priorityColor = getPriorityColor(t.priority);
    return `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid ${BRAND.border};">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; padding: 3px 10px; font-size: 10px; font-weight: 700; color: #fff; background-color: ${priorityColor}; border-radius: 9999px; text-transform: uppercase;">${t.priority}</span>
            <span style="font-size: 11px; color: ${BRAND.muted}; font-weight: 600; text-transform: uppercase; margin-left: 8px;">${formatTaskType(t.task_type)}</span>
          </div>
          <p style="margin: 6px 0 0; font-size: 13px; color: ${BRAND.foreground}; font-weight: 500;">${t.summary}</p>
          ${t.recommended_action ? `<p style="margin: 4px 0 0; font-size: 12px; color: #15803d;">💡 ${t.recommended_action}</p>` : ""}
        </td>
      </tr>`;
  }).join("");

  const bodyContent = `
    <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: ${BRAND.foreground};">
      Inbound Email Processed
    </h2>
    <p style="margin: 0 0 20px; font-size: 14px; color: ${BRAND.muted};">
      Hi ${recipientName}, a new inbound email has been analyzed and ${tasks.length} task${tasks.length > 1 ? "s" : ""} created.
    </p>

    <!-- Inbound Email Card -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; margin-bottom: 20px;">
      <tr>
        <td style="padding: 16px;">
          <p style="margin: 0 0 6px; font-size: 11px; font-weight: 600; color: ${BRAND.primary}; text-transform: uppercase; letter-spacing: 0.5px;">📧 Inbound Email</p>
          <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: ${BRAND.foreground};">${inboundEmail.subject || "(No subject)"}</p>
          <p style="margin: 0 0 4px; font-size: 12px; color: ${BRAND.muted};">From: ${inboundEmail.from_name ? `${inboundEmail.from_name} &lt;${inboundEmail.from_email}&gt;` : inboundEmail.from_email}</p>
          <p style="margin: 0 0 4px; font-size: 12px; color: ${BRAND.muted};">Account: ${debtorName}</p>
          ${inboundEmail.ai_summary ? `<p style="margin: 8px 0 0; font-size: 12px; color: #475569; font-style: italic;">"${inboundEmail.ai_summary}"</p>` : ""}
        </td>
      </tr>
    </table>

    <!-- Tasks Table -->
    <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: ${BRAND.foreground};">Tasks Created (${tasks.length})</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; border: 1px solid ${BRAND.border}; border-radius: 8px; margin-bottom: 24px;">
      ${taskRows}
    </table>

    <!-- CTA Button -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td style="text-align: center;">
          <a href="https://recouply.ai/tasks"
             style="display: inline-block; padding: 12px 28px; font-size: 14px; font-weight: 600; color: #ffffff; background-color: ${BRAND.primary}; text-decoration: none; border-radius: 6px;">
            View Tasks in Recouply →
          </a>
        </td>
      </tr>
    </table>
  `;

  return wrapEnterpriseEmail(bodyContent, {
    headerStyle: "gradient",
    title: `📋 ${tasks.length} Task${tasks.length > 1 ? "s" : ""} from Inbound Email`,
    subtitle: "Collections & Risk Intelligence CRM",
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { taskIds, inboundEmailId, creatorUserId }: InboundTasksRequest = await req.json();

    if (!taskIds?.length || !inboundEmailId || !creatorUserId) {
      return new Response(
        JSON.stringify({ error: "taskIds, inboundEmailId, and creatorUserId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[NOTIFY-INBOUND-TASKS] Processing ${taskIds.length} tasks for inbound email ${inboundEmailId}`);

    // Fetch all tasks
    const { data: tasks, error: tasksError } = await supabase
      .from("collection_tasks")
      .select("id, summary, task_type, priority, details, recommended_action, user_id, organization_id, debtor_id, debtors(name, company_name)")
      .in("id", taskIds);

    if (tasksError || !tasks?.length) {
      console.error("[NOTIFY-INBOUND-TASKS] Error fetching tasks:", tasksError);
      return new Response(
        JSON.stringify({ error: "Tasks not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch inbound email
    const { data: inboundEmail } = await supabase
      .from("inbound_emails")
      .select("id, subject, from_email, from_name, ai_summary, ai_category, ai_priority")
      .eq("id", inboundEmailId)
      .single();

    if (!inboundEmail) {
      return new Response(
        JSON.stringify({ error: "Inbound email not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get debtor name from first task
    const debtorInfo = (tasks[0] as any).debtors;
    const debtorName = debtorInfo?.company_name || debtorInfo?.name || "Unknown Account";

    // Get creator info
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", creatorUserId)
      .single();
    const creatorName = creatorProfile?.name || creatorProfile?.email || "AI System";

    // Find account owner / team members to notify
    const firstTask = tasks[0] as any;
    let accountOwnerId = firstTask.user_id;

    if (firstTask.organization_id) {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("owner_user_id")
        .eq("id", firstTask.organization_id)
        .single();
      if (orgData?.owner_user_id) accountOwnerId = orgData.owner_user_id;
    }

    if (accountOwnerId === firstTask.user_id) {
      const { data: creatorAccount } = await supabase
        .from("account_users")
        .select("account_id")
        .eq("user_id", creatorUserId)
        .eq("status", "active")
        .limit(1)
        .single();
      if (creatorAccount?.account_id) accountOwnerId = creatorAccount.account_id;
    }

    const { data: teamMembers } = await supabase
      .from("account_users")
      .select("user_id, email, profiles!account_users_user_id_fkey(id, name, email)")
      .eq("account_id", accountOwnerId)
      .eq("status", "active");

    type Recipient = { userId?: string; name: string; email?: string };
    const recipientMap = new Map<string, Recipient>();

    if (teamMembers) {
      for (const member of teamMembers) {
        const memberUserId = (member as any).user_id as string | null;
        const profile = (member as any).profiles as any;
        const email = profile?.email || (member as any).email || undefined;
        const name = profile?.name || (email ? email.split("@")[0] : "Team member");
        const key = memberUserId || email;
        if (!key) continue;
        recipientMap.set(key, { userId: memberUserId || undefined, name, email });
      }
    }

    if (accountOwnerId && !recipientMap.has(accountOwnerId)) {
      const { data: ownerProfile } = await supabase.from("profiles").select("id, name, email").eq("id", accountOwnerId).single();
      const ownerEmail = ownerProfile?.email;
      const ownerName = ownerProfile?.name || (ownerEmail ? ownerEmail.split("@")[0] : "Account owner");
      recipientMap.set(accountOwnerId, { userId: accountOwnerId, name: ownerName, email: ownerEmail || undefined });
    }

    const usersToNotify = Array.from(recipientMap.values());

    // Create ONE in-app notification per user (consolidated)
    const inAppRecipients = usersToNotify.filter((u) => !!u.userId) as Array<{ userId: string; name: string; email?: string }>;
    const taskSummaries = tasks.map((t: any) => formatTaskType(t.task_type)).join(", ");
    const existingNotificationUserIds = new Set<string>();

    if (inAppRecipients.length > 0) {
      const { data: existingNotifications, error: existingNotificationsError } = await supabase
        .from("user_notifications")
        .select("user_id")
        .eq("type", "task_created")
        .eq("source_type", "inbound_email")
        .eq("source_id", inboundEmailId)
        .in("user_id", inAppRecipients.map((user) => user.userId));

      if (existingNotificationsError) {
        console.error("[NOTIFY-INBOUND-TASKS] Error checking existing notifications:", existingNotificationsError);
      } else {
        for (const notification of existingNotifications || []) {
          existingNotificationUserIds.add((notification as any).user_id);
        }
      }
    }

    const usersNeedingInAppNotification = inAppRecipients.filter((user) => !existingNotificationUserIds.has(user.userId));

    const notifications = usersNeedingInAppNotification.map((user) => ({
      user_id: user.userId,
      type: "task_created",
      title: `${tasks.length} Task${tasks.length > 1 ? "s" : ""} from Inbound Email`,
      message: `AI created ${tasks.length} task${tasks.length > 1 ? "s" : ""} (${taskSummaries}) from email: "${inboundEmail.subject?.substring(0, 40) || "No subject"}..." for ${debtorName}`,
      link: "/tasks",
      source_type: "inbound_email",
      source_id: inboundEmailId,
      sender_id: creatorUserId,
      sender_name: creatorName,
    }));

    if (notifications.length > 0) {
      const { error: insertError } = await supabase.from("user_notifications").insert(notifications);
      if (insertError) console.error("[NOTIFY-INBOUND-TASKS] Error creating notifications:", insertError);
    }

    // Send ONE consolidated email per user
    let emailsSent = 0;
    const emailRecipients = usersToNotify.filter((user) => !user.userId || !existingNotificationUserIds.has(user.userId));

    for (const user of emailRecipients) {
      if (!user.email) continue;
      try {
        const emailHtml = generateConsolidatedEmailHtml({
          recipientName: user.name,
          inboundEmail,
          tasks,
          debtorName,
        });

        await resend.emails.send({
          from: "Recouply <notifications@send.inbound.services.recouply.ai>",
          to: [user.email],
          subject: `📋 ${tasks.length} Task${tasks.length > 1 ? "s" : ""} Created: ${inboundEmail.subject?.substring(0, 40) || "Inbound Email"}`,
          html: emailHtml,
        });
        emailsSent++;
      } catch (emailError) {
        console.error(`[NOTIFY-INBOUND-TASKS] Email error for ${user.email}:`, emailError);
      }
    }

    console.log(`[NOTIFY-INBOUND-TASKS] ✅ Sent ${emailsSent} consolidated emails, ${notifications.length} in-app notifications (${existingNotificationUserIds.size} duplicate recipients skipped)`);

    return new Response(
      JSON.stringify({ success: true, notified: notifications.length, emailsSent, tasksCount: tasks.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[NOTIFY-INBOUND-TASKS] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
