import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyTaskCreatedRequest {
  taskId: string;
  creatorUserId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { taskId, creatorUserId }: NotifyTaskCreatedRequest = await req.json();

    if (!taskId || !creatorUserId) {
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
        debtors (
          name,
          company_name
        )
      `)
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      console.error("Error fetching task:", taskError);
      return new Response(
        JSON.stringify({ error: "Task not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get creator's profile
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", creatorUserId)
      .single();

    const creatorName = creatorProfile?.name || creatorProfile?.email || "A team member";

    // Get the effective account ID (owner of the organization)
    const { data: orgData } = await supabase
      .from("organizations")
      .select("owner_user_id")
      .eq("id", task.organization_id)
      .single();

    const accountOwnerId = orgData?.owner_user_id || task.user_id;

    // Get all team members under this account (including the owner)
    const { data: teamMembers, error: teamError } = await supabase
      .from("account_users")
      .select("user_id")
      .eq("account_id", accountOwnerId)
      .eq("status", "active");

    if (teamError) {
      console.error("Error fetching team members:", teamError);
    }

    // Collect all user IDs to notify (team members + owner, excluding creator)
    const userIdsToNotify = new Set<string>();
    
    // Add owner
    if (accountOwnerId && accountOwnerId !== creatorUserId) {
      userIdsToNotify.add(accountOwnerId);
    }
    
    // Add team members
    if (teamMembers) {
      for (const member of teamMembers) {
        if (member.user_id && member.user_id !== creatorUserId) {
          userIdsToNotify.add(member.user_id);
        }
      }
    }

    if (userIdsToNotify.size === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format task type for display
    const formatTaskType = (type: string) => {
      return type
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
    };

    // deno-lint-ignore no-explicit-any
    const debtorInfo = task.debtors as any;
    const debtorName = debtorInfo?.company_name || debtorInfo?.name || "Unknown Account";
    const taskTypeName = formatTaskType(task.task_type);

    // Create notifications for all users
    const notifications = Array.from(userIdsToNotify).map((userId) => ({
      user_id: userId,
      type: "task_created",
      title: "New Task Created",
      message: `${creatorName} created a new ${task.priority} priority task: "${task.summary.substring(0, 50)}${task.summary.length > 50 ? "..." : ""}" for ${debtorName}`,
      link: "/tasks",
      source_type: "task",
      source_id: taskId,
      sender_id: creatorUserId,
      sender_name: creatorName,
    }));

    const { error: insertError } = await supabase
      .from("user_notifications")
      .insert(notifications);

    if (insertError) {
      console.error("Error creating notifications:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create notifications" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Created ${notifications.length} task creation notifications`);

    return new Response(
      JSON.stringify({ success: true, notified: notifications.length }),
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
