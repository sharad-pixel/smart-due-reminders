import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { wrapEnterpriseEmail, BRAND } from "../_shared/enterpriseEmailTemplate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyTaskCreatedRequest {
  taskId: string;
  creatorUserId: string;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const formatTaskType = (type: string) => {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const getPriorityColor = (priority: string) => {
  switch (priority?.toLowerCase()) {
    case "urgent": return "#dc2626";
    case "high": return "#ea580c";
    case "normal": return "#3b82f6";
    case "low": return "#6b7280";
    default: return "#3b82f6";
  }
};

const generateTaskEmailHtml = (params: {
  recipientName: string;
  creatorName: string;
  taskSummary: string;
  taskType: string;
  priority: string;
  debtorName: string;
  details?: string;
  recommendedAction?: string;
}) => {
  const priorityColor = getPriorityColor(params.priority);

  const bodyContent = `
    <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: ${BRAND.foreground};">
      New Task Created
    </h2>
    <p style="margin: 0 0 24px; font-size: 14px; color: ${BRAND.muted};">
      Hi ${params.recipientName},
    </p>
    <p style="margin: 0 0 24px; font-size: 14px; color: #475569; line-height: 1.6;">
      <strong>${params.creatorName}</strong> has created a new task that requires your attention.
    </p>
    
    <!-- Task Card -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; border: 1px solid ${BRAND.border}; border-radius: 8px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 20px;">
          <span style="display: inline-block; padding: 4px 12px; font-size: 11px; font-weight: 600; color: #ffffff; background-color: ${priorityColor}; border-radius: 9999px; text-transform: uppercase; margin-bottom: 12px;">
            ${params.priority} Priority
          </span>
          
          <h3 style="margin: 12px 0 8px; font-size: 16px; font-weight: 600; color: ${BRAND.foreground};">
            ${params.taskSummary}
          </h3>
          
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 12px;">
            <tr>
              <td style="padding: 6px 0;">
                <span style="font-size: 12px; color: ${BRAND.muted}; font-weight: 500;">Task Type:</span>
                <span style="font-size: 13px; color: ${BRAND.foreground}; margin-left: 8px;">${params.taskType}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0;">
                <span style="font-size: 12px; color: ${BRAND.muted}; font-weight: 500;">Account:</span>
                <span style="font-size: 13px; color: ${BRAND.foreground}; margin-left: 8px;">${params.debtorName}</span>
              </td>
            </tr>
            ${params.details ? `
            <tr>
              <td style="padding: 6px 0;">
                <span style="font-size: 12px; color: ${BRAND.muted}; font-weight: 500;">Details:</span>
                <p style="font-size: 13px; color: #475569; margin: 4px 0 0; line-height: 1.5;">${params.details}</p>
              </td>
            </tr>
            ` : ""}
            ${params.recommendedAction ? `
            <tr>
              <td style="padding: 6px 0;">
                <span style="font-size: 12px; color: ${BRAND.muted}; font-weight: 500;">Recommended Action:</span>
                <p style="font-size: 13px; color: #475569; margin: 4px 0 0; line-height: 1.5;">${params.recommendedAction}</p>
              </td>
            </tr>
            ` : ""}
          </table>
        </td>
      </tr>
    </table>
    
    <!-- CTA Button -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td style="text-align: center;">
          <a href="https://recouply.ai/tasks" 
             style="display: inline-block; padding: 12px 28px; font-size: 14px; font-weight: 600; color: #ffffff; background-color: ${BRAND.primary}; text-decoration: none; border-radius: 6px;">
            View Task in Recouply
          </a>
        </td>
      </tr>
    </table>
  `;

  return wrapEnterpriseEmail(bodyContent, {
    headerStyle: 'gradient',
    title: '🎯 New Task',
    subtitle: 'Collections & Risk Intelligence CRM',
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[NOTIFY-TASK-CREATED] Function started");

    const { taskId, creatorUserId }: NotifyTaskCreatedRequest = await req.json();
    console.log("[NOTIFY-TASK-CREATED] Request received:", { taskId, creatorUserId });

    if (!taskId || !creatorUserId) {
      console.error("[NOTIFY-TASK-CREATED] Missing required fields");
      return new Response(
        JSON.stringify({ error: "taskId and creatorUserId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: task, error: taskError } = await supabase
      .from("collection_tasks")
      .select(`
        id, summary, task_type, priority, level, user_id, organization_id, debtor_id, details, recommended_action,
        debtors ( name, company_name )
      `)
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      console.error("[NOTIFY-TASK-CREATED] Error fetching task:", taskError);
      return new Response(
        JSON.stringify({ error: "Task not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", creatorUserId)
      .single();

    const creatorName = creatorProfile?.name || creatorProfile?.email || "A team member";

    let accountOwnerId = task.user_id;
    
    if (task.organization_id) {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("owner_user_id")
        .eq("id", task.organization_id)
        .single();
      if (orgData?.owner_user_id) accountOwnerId = orgData.owner_user_id;
    }
    
    if (accountOwnerId === task.user_id) {
      const { data: creatorAccount } = await supabase
        .from("account_users")
        .select("account_id")
        .eq("user_id", creatorUserId)
        .eq("status", "active")
        .limit(1)
        .single();
      if (creatorAccount?.account_id) accountOwnerId = creatorAccount.account_id;
    }

    const { data: teamMembers, error: teamError } = await supabase
      .from("account_users")
      .select("user_id, email, profiles!account_users_user_id_fkey(id, name, email)")
      .eq("account_id", accountOwnerId)
      .eq("status", "active");

    if (teamError) console.error("[NOTIFY-TASK-CREATED] Error fetching team members:", teamError);

    type NotifyRecipient = { userId?: string; name: string; email?: string };
    const recipientMap = new Map<string, NotifyRecipient>();

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
      const { data: ownerAccount } = await supabase.from("account_users").select("email").eq("user_id", accountOwnerId).eq("status", "active").limit(1).single();
      const ownerEmail = ownerProfile?.email || ownerAccount?.email || undefined;
      const ownerName = ownerProfile?.name || (ownerEmail ? ownerEmail.split("@")[0] : "Account owner");
      recipientMap.set(accountOwnerId, { userId: accountOwnerId, name: ownerName, email: ownerEmail });
    }

    const usersToNotify = Array.from(recipientMap.values());

    if (usersToNotify.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, emailsSent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const debtorInfo = task.debtors as any;
    const debtorName = debtorInfo?.company_name || debtorInfo?.name || "Unknown Account";
    const taskTypeName = formatTaskType(task.task_type);

    const inAppRecipients = usersToNotify.filter((u) => !!u.userId) as Array<{ userId: string; name: string; email?: string }>;

    const notifications = inAppRecipients.map((user) => ({
      user_id: user.userId,
      type: "task_created",
      title: "New Task Created",
      message: `${creatorName} created a new ${task.priority} priority task: "${task.summary.substring(0, 50)}${task.summary.length > 50 ? "..." : ""}" for ${debtorName}`,
      link: "/tasks",
      source_type: "task",
      source_id: taskId,
      sender_id: creatorUserId,
      sender_name: creatorName,
    }));

    if (notifications.length > 0) {
      const { error: insertError } = await supabase.from("user_notifications").insert(notifications);
      if (insertError) console.error("[NOTIFY-TASK-CREATED] Error creating notifications:", insertError);
    }

    let emailsSent = 0;
    const emailErrors: string[] = [];

    for (const user of usersToNotify) {
      if (!user.email) continue;
      try {
        const emailHtml = generateTaskEmailHtml({
          recipientName: user.name,
          creatorName,
          taskSummary: task.summary,
          taskType: taskTypeName,
          priority: task.priority,
          debtorName,
          details: task.details || undefined,
          recommendedAction: task.recommended_action || undefined,
        });

        const emailResult = await resend.emails.send({
          from: "Recouply <notifications@send.inbound.services.recouply.ai>",
          to: [user.email],
          subject: `🎯 New Task: ${task.summary.substring(0, 50)}${task.summary.length > 50 ? "..." : ""}`,
          html: emailHtml,
        });
        emailsSent++;
      } catch (emailError) {
        const errorMsg = emailError instanceof Error ? emailError.message : "Unknown error";
        emailErrors.push(`${user.email}: ${errorMsg}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, notified: notifications.length, emailsSent, emailErrors: emailErrors.length > 0 ? emailErrors : undefined }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in notify-task-created:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
