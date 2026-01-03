import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyTaskCreatedRequest {
  taskId: string;
  creatorUserId: string;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Format task type for display
const formatTaskType = (type: string) => {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

// Get priority badge color
const getPriorityColor = (priority: string) => {
  switch (priority?.toLowerCase()) {
    case "urgent": return "#dc2626";
    case "high": return "#ea580c";
    case "normal": return "#2563eb";
    case "low": return "#6b7280";
    default: return "#2563eb";
  }
};

// Generate branded email HTML
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
  const appUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", "") || "https://app.recouply.ai";
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Task Created - Recouply</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 12px 12px 0 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">
                      🎯 Recouply
                    </h1>
                    <p style="margin: 8px 0 0 0; font-size: 14px; color: #94a3b8;">
                      AI-Powered Collections Platform
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600; color: #0f172a;">
                New Task Created
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #64748b;">
                Hi ${params.recipientName},
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569; line-height: 1.6;">
                <strong>${params.creatorName}</strong> has created a new task that requires your attention.
              </p>
              
              <!-- Task Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <!-- Priority Badge -->
                    <span style="display: inline-block; padding: 4px 12px; font-size: 12px; font-weight: 600; color: #ffffff; background-color: ${priorityColor}; border-radius: 9999px; text-transform: uppercase; margin-bottom: 12px;">
                      ${params.priority} Priority
                    </span>
                    
                    <h3 style="margin: 12px 0 8px 0; font-size: 18px; font-weight: 600; color: #0f172a;">
                      ${params.taskSummary}
                    </h3>
                    
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 16px;">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="font-size: 13px; color: #64748b; font-weight: 500;">Task Type:</span>
                          <span style="font-size: 14px; color: #0f172a; margin-left: 8px;">${params.taskType}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="font-size: 13px; color: #64748b; font-weight: 500;">Account:</span>
                          <span style="font-size: 14px; color: #0f172a; margin-left: 8px;">${params.debtorName}</span>
                        </td>
                      </tr>
                      ${params.details ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="font-size: 13px; color: #64748b; font-weight: 500;">Details:</span>
                          <p style="font-size: 14px; color: #475569; margin: 4px 0 0 0; line-height: 1.5;">${params.details}</p>
                        </td>
                      </tr>
                      ` : ""}
                      ${params.recommendedAction ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="font-size: 13px; color: #64748b; font-weight: 500;">Recommended Action:</span>
                          <p style="font-size: 14px; color: #475569; margin: 4px 0 0 0; line-height: 1.5;">${params.recommendedAction}</p>
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
                    <a href="https://app.recouply.ai/tasks" 
                       style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); text-decoration: none; border-radius: 8px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);">
                      View Task in Recouply
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">
                      This notification was sent by Recouply AI Collections Platform
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                      RecouplyAI Inc. • <a href="https://recouply.ai" style="color: #2563eb; text-decoration: none;">recouply.ai</a>
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

    // Get task details with debtor info
    const { data: task, error: taskError } = await supabase
      .from("collection_tasks")
      .select(`
        id,
        summary,
        task_type,
        priority,
        level,
        user_id,
        organization_id,
        debtor_id,
        details,
        recommended_action,
        debtors (
          name,
          company_name
        )
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

    console.log("[NOTIFY-TASK-CREATED] Task fetched:", { 
      taskId: task.id, 
      userId: task.user_id, 
      organizationId: task.organization_id 
    });

    // Get creator's profile
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", creatorUserId)
      .single();

    const creatorName = creatorProfile?.name || creatorProfile?.email || "A team member";
    console.log("[NOTIFY-TASK-CREATED] Creator:", creatorName);

    // Get the effective account ID - try organization first, then fallback to user's account
    let accountOwnerId = task.user_id;
    
    if (task.organization_id) {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("owner_user_id")
        .eq("id", task.organization_id)
        .single();
      
      if (orgData?.owner_user_id) {
        accountOwnerId = orgData.owner_user_id;
      }
    }
    
    // If still no account owner, check account_users for the creator
    if (accountOwnerId === task.user_id) {
      const { data: creatorAccount } = await supabase
        .from("account_users")
        .select("account_id")
        .eq("user_id", creatorUserId)
        .eq("status", "active")
        .limit(1)
        .single();
      
      if (creatorAccount?.account_id) {
        accountOwnerId = creatorAccount.account_id;
      }
    }

    console.log("[NOTIFY-TASK-CREATED] Account owner ID:", accountOwnerId);

    // Get all team members under this account (including the owner) with their profiles
    const { data: teamMembers, error: teamError } = await supabase
      .from("account_users")
      .select("user_id, email, profiles!account_users_user_id_fkey(id, name, email)")
      .eq("account_id", accountOwnerId)
      .eq("status", "active");

    if (teamError) {
      console.error("[NOTIFY-TASK-CREATED] Error fetching team members:", teamError);
    }

    console.log("[NOTIFY-TASK-CREATED] Team members found:", teamMembers?.length || 0);

    // Collect all users to notify (including creator). Email is optional; in-app notifications require user_id.
    type NotifyRecipient = { userId?: string; name: string; email?: string };
    const recipientMap = new Map<string, NotifyRecipient>();

    if (teamMembers) {
      for (const member of teamMembers) {
        // deno-lint-ignore no-explicit-any
        const memberUserId = (member as any).user_id as string | null;
        // deno-lint-ignore no-explicit-any
        const profile = (member as any).profiles as any;

        const email = profile?.email || (member as any).email || undefined;
        const name = profile?.name || (email ? email.split("@")[0] : "Team member");

        const key = memberUserId || email;
        if (!key) continue;

        recipientMap.set(key, { userId: memberUserId || undefined, name, email });
      }
    }

    // Ensure owner is included (covers edge cases where the owner row is missing in account_users)
    if (accountOwnerId && !recipientMap.has(accountOwnerId)) {
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("id, name, email")
        .eq("id", accountOwnerId)
        .single();

      const { data: ownerAccount } = await supabase
        .from("account_users")
        .select("email")
        .eq("user_id", accountOwnerId)
        .eq("status", "active")
        .limit(1)
        .single();

      const ownerEmail = ownerProfile?.email || ownerAccount?.email || undefined;
      const ownerName = ownerProfile?.name || (ownerEmail ? ownerEmail.split("@")[0] : "Account owner");

      recipientMap.set(accountOwnerId, { userId: accountOwnerId, name: ownerName, email: ownerEmail });
    }

    const usersToNotify = Array.from(recipientMap.values());

    console.log(
      "[NOTIFY-TASK-CREATED] Users to notify:",
      usersToNotify.map((u) => ({ userId: u.userId, email: u.email }))
    );

    if (usersToNotify.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, emailsSent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // deno-lint-ignore no-explicit-any
    const debtorInfo = task.debtors as any;
    const debtorName = debtorInfo?.company_name || debtorInfo?.name || "Unknown Account";
    const taskTypeName = formatTaskType(task.task_type);

    // Create in-app notifications (only for recipients that have a userId)
    const inAppRecipients = usersToNotify.filter((u) => !!u.userId) as Array<
      { userId: string; name: string; email?: string }
    >;

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
      console.log("[NOTIFY-TASK-CREATED] Inserting notifications:", JSON.stringify(notifications, null, 2));
      const { error: insertError } = await supabase
        .from("user_notifications")
        .insert(notifications);

      if (insertError) {
        console.error("[NOTIFY-TASK-CREATED] Error creating notifications:", insertError);
      }
    } else {
      console.log("[NOTIFY-TASK-CREATED] No in-app recipients (user_id missing for all recipients)");
    }

    // Send email notifications (only to users with an email)
    let emailsSent = 0;
    const emailErrors: string[] = [];

    for (const user of usersToNotify) {
      if (!user.email) {
        console.log(`[NOTIFY-TASK-CREATED] Skipping email (no email on file) for recipient=${user.userId || 'no_user_id'}`);
        continue;
      }

      try {
        console.log(`[NOTIFY-TASK-CREATED] Sending email to ${user.email}`);

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
          from: "Recouply <notifications@recouply.ai>",
          to: [user.email],
          subject: `🎯 New Task: ${task.summary.substring(0, 50)}${task.summary.length > 50 ? "..." : ""}`,
          html: emailHtml,
        });

        console.log(`[NOTIFY-TASK-CREATED] Email sent to ${user.email}:`, emailResult);
        emailsSent++;
      } catch (emailError) {
        const errorMsg = emailError instanceof Error ? emailError.message : "Unknown error";
        console.error(`[NOTIFY-TASK-CREATED] Failed to send email to ${user.email}:`, errorMsg);
        emailErrors.push(`${user.email}: ${errorMsg}`);
      }
    }

    console.log(
      `[NOTIFY-TASK-CREATED] Successfully created ${notifications.length} notifications and sent ${emailsSent} emails`
    );

    return new Response(
      JSON.stringify({
        success: true,
        notified: notifications.length,
        emailsSent,
        emailErrors: emailErrors.length > 0 ? emailErrors : undefined,
      }),
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
