import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { INBOUND_EMAIL_DOMAIN } from "../_shared/emailConfig.ts";
import { BRAND, wrapEnterpriseEmail } from "../_shared/enterpriseEmailTemplate.ts";

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

interface TaskAssignmentRequest {
  taskId: string;
  teamMemberId?: string;
  accountUserId?: string;
  userId?: string;
  debtorId?: string;
  invoiceId?: string;
}

function generateTaskBodyContent(params: {
  teamMemberName: string;
  task: any;
  invoiceSection: string;
  debtorSection: string;
  signatureSection: string;
}): string {
  const { teamMemberName, task, invoiceSection, debtorSection, signatureSection } = params;
  const FONT_STACK = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;
  
  const taskTypeLabel = task.task_type.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
  const priorityBadge = task.priority === 'high' 
    ? `<span style="background: ${BRAND.destructive}; color: white; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase;">High</span>`
    : task.priority === 'normal'
    ? `<span style="background: ${BRAND.warning}; color: white; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase;">Normal</span>`
    : `<span style="background: ${BRAND.muted}; color: white; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase;">Low</span>`;

  return `
    <p style="margin: 0 0 16px; color: ${BRAND.foreground}; font-size: 13px; font-family: ${FONT_STACK};">
      Hi <strong>${teamMemberName}</strong>,
    </p>
    <p style="margin: 0 0 20px; color: ${BRAND.muted}; font-size: 13px; font-family: ${FONT_STACK};">
      A new collection task has been assigned to you. Please review the details below.
    </p>
    
    <!-- Task Card -->
    <div style="background-color: #fefce8; border: 1px solid #fde68a; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td>
            <p style="margin: 0 0 4px; color: ${BRAND.muted}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-family: ${FONT_STACK};">Task Type</p>
            <p style="margin: 0 0 8px; color: ${BRAND.foreground}; font-size: 15px; font-weight: 700; font-family: ${FONT_STACK};">${taskTypeLabel}</p>
            <p style="margin: 0; color: #92400e; font-size: 12.5px; line-height: 1.5; font-family: ${FONT_STACK};">${task.summary}</p>
          </td>
          <td style="vertical-align: top; text-align: right; width: 80px;">${priorityBadge}</td>
        </tr>
      </table>
    </div>
    
    ${task.details ? `
    <div style="background-color: ${BRAND.surfaceLight}; border: 1px solid ${BRAND.border}; border-radius: 6px; padding: 14px 16px; margin-bottom: 20px;">
      <p style="margin: 0 0 6px; color: ${BRAND.muted}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-family: ${FONT_STACK};">Details</p>
      <p style="margin: 0; color: ${BRAND.foreground}; font-size: 12.5px; font-family: ${FONT_STACK};">${task.details}</p>
    </div>
    ` : ""}
    
    ${task.recommended_action ? `
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-left: 3px solid ${BRAND.accent}; border-radius: 0 6px 6px 0; padding: 14px 16px; margin-bottom: 20px;">
      <p style="margin: 0 0 6px; color: #166534; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-family: ${FONT_STACK};">💡 Recommended Action</p>
      <p style="margin: 0; color: #15803d; font-size: 12.5px; font-weight: 500; font-family: ${FONT_STACK};">${task.recommended_action}</p>
    </div>
    ` : ""}
    
    ${debtorSection}
    ${invoiceSection}
    
    <!-- Task Metadata -->
    <div style="border-top: 1px solid ${BRAND.border}; padding-top: 14px; margin-top: 20px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
        ${task.due_date ? `
        <tr>
          <td style="padding: 3px 12px 3px 0; color: ${BRAND.muted}; font-size: 12px; font-family: ${FONT_STACK};">Due Date:</td>
          <td style="padding: 3px 0; color: ${BRAND.foreground}; font-size: 12px; font-weight: 600; font-family: ${FONT_STACK};">${new Date(task.due_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td>
        </tr>
        ` : ""}
        <tr>
          <td style="padding: 3px 12px 3px 0; color: ${BRAND.muted}; font-size: 12px; font-family: ${FONT_STACK};">Created:</td>
          <td style="padding: 3px 0; color: ${BRAND.foreground}; font-size: 12px; font-family: ${FONT_STACK};">${new Date(task.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td>
        </tr>
      </table>
    </div>
    
    <!-- CTA Button -->
    <div style="text-align: center; margin: 24px 0;">
      <a href="https://recouply.ai/tasks" style="display: inline-block; background-color: ${BRAND.primary}; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 14px; font-family: ${FONT_STACK};">
        View Task in Recouply →
      </a>
    </div>
    
    <!-- AI Tip -->
    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 14px 16px; margin-top: 20px;">
      <p style="margin: 0 0 4px; color: #1e40af; font-size: 12px; font-weight: 600; font-family: ${FONT_STACK};">🤖 AI-Powered Response Tracking</p>
      <p style="margin: 0; color: ${BRAND.primary}; font-size: 12px; font-family: ${FONT_STACK};">
        Reply to this email to log your communication. Your response will be processed by our AI for automatic task extraction and follow-up tracking.
      </p>
    </div>
    
    ${signatureSection}
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

    const body: TaskAssignmentRequest = await req.json();
    const { taskId, teamMemberId, accountUserId, userId, debtorId, invoiceId } = body;

    console.log("[SEND-TASK-ASSIGNMENT] Received request:", JSON.stringify(body));

    if (!taskId) {
      return new Response(
        JSON.stringify({ error: "Missing taskId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const memberUserId = userId || teamMemberId || accountUserId;
    
    if (!memberUserId) {
      return new Response(
        JSON.stringify({ error: "Missing teamMemberId, userId, or accountUserId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch task with debtor and invoice details
    const { data: task, error: taskError } = await supabase
      .from("collection_tasks")
      .select(`
        *,
        debtors(name, company_name, email),
        invoices(invoice_number, amount, due_date, status, aging_bucket)
      `)
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      console.error("[SEND-TASK-ASSIGNMENT] Task fetch error:", taskError);
      return new Response(
        JSON.stringify({ error: "Task not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[SEND-TASK-ASSIGNMENT] Task fetched:", task.id);

    // Fetch team member from profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("id", memberUserId)
      .maybeSingle();

    let teamMemberEmail = profile?.email;
    let teamMemberName = profile?.name || "Team Member";

    if (!profile) {
      console.log("[SEND-TASK-ASSIGNMENT] No profile found for ID, checking account_users...");
      
      const { data: accountUser, error: auError } = await supabase
        .from("account_users")
        .select("id, user_id, email, role")
        .eq("id", memberUserId)
        .maybeSingle();

      if (accountUser) {
        teamMemberEmail = accountUser.email;
        
        if (accountUser.user_id) {
          const { data: linkedProfile } = await supabase
            .from("profiles")
            .select("name, email")
            .eq("id", accountUser.user_id)
            .maybeSingle();
          
          if (linkedProfile) {
            teamMemberName = linkedProfile.name || "Team Member";
            teamMemberEmail = linkedProfile.email || teamMemberEmail;
          }
        }
      } else {
        const { data: accountUserByUserId } = await supabase
          .from("account_users")
          .select("id, user_id, email")
          .eq("user_id", memberUserId)
          .maybeSingle();

        if (accountUserByUserId) {
          teamMemberEmail = accountUserByUserId.email;
          
          const { data: userProfile } = await supabase
            .from("profiles")
            .select("name, email")
            .eq("id", memberUserId)
            .maybeSingle();

          if (userProfile) {
            teamMemberName = userProfile.name || "Team Member";
            teamMemberEmail = userProfile.email || teamMemberEmail;
          }
        }
      }
    }

    if (!teamMemberEmail) {
      console.error("[SEND-TASK-ASSIGNMENT] No email found for team member:", memberUserId);
      return new Response(
        JSON.stringify({ error: "Team member email not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[SEND-TASK-ASSIGNMENT] Sending to:", teamMemberEmail, "Name:", teamMemberName);

    // Fetch branding settings
    const { data: branding } = await supabase
      .from("branding_settings")
      .select("logo_url, business_name, from_name, email_signature, email_footer, primary_color")
      .eq("user_id", task.user_id)
      .maybeSingle();

    const businessName = branding?.business_name || branding?.from_name || "Your Organization";
    const primaryColor = branding?.primary_color || "#1e3a5f";

    // Build reply-to address
    const replyTo = task.invoice_id 
      ? `invoice+${task.invoice_id}@inbound.services.recouply.ai`
      : `debtor+${task.debtor_id}@inbound.services.recouply.ai`;

    const taskTypeLabel = task.task_type.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());

    // Build invoice section
    let invoiceSection = "";
    if (task.invoices) {
      const dueDate = task.invoices.due_date 
        ? new Date(task.invoices.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : "N/A";
      invoiceSection = `
        <div style="background-color: ${BRAND.surfaceLight}; border: 1px solid ${BRAND.border}; border-radius: 6px; padding: 14px 16px; margin-bottom: 16px;">
          <p style="margin: 0 0 10px; color: ${BRAND.muted}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">📄 Invoice Details</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="50%" style="padding: 4px 0;"><span style="color: ${BRAND.muted}; font-size: 12px;">Invoice #:</span> <span style="color: ${BRAND.foreground}; font-size: 12px; font-weight: 600;">${task.invoices.invoice_number || "N/A"}</span></td>
              <td width="50%" style="padding: 4px 0;"><span style="color: ${BRAND.muted}; font-size: 12px;">Amount:</span> <span style="color: ${BRAND.foreground}; font-size: 12px; font-weight: 600;">$${task.invoices.amount?.toLocaleString() || "0"}</span></td>
            </tr>
            <tr>
              <td width="50%" style="padding: 4px 0;"><span style="color: ${BRAND.muted}; font-size: 12px;">Due:</span> <span style="color: ${BRAND.foreground}; font-size: 12px;">${dueDate}</span></td>
              <td width="50%" style="padding: 4px 0;"><span style="color: ${BRAND.muted}; font-size: 12px;">Status:</span> <span style="color: ${BRAND.foreground}; font-size: 12px;">${task.invoices.status || "N/A"}</span></td>
            </tr>
          </table>
        </div>
      `;
    }

    // Build debtor section
    let debtorSection = "";
    if (task.debtors) {
      debtorSection = `
        <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 14px 16px; margin-bottom: 16px;">
          <p style="margin: 0 0 10px; color: ${BRAND.primary}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">🏢 Account Details</p>
          <p style="margin: 0 0 4px; color: ${BRAND.foreground}; font-size: 13px; font-weight: 600;">${task.debtors.name}</p>
          <p style="margin: 0 0 4px; color: ${BRAND.muted}; font-size: 12px;">${task.debtors.company_name}</p>
          ${task.debtors.email ? `<p style="margin: 0; color: ${BRAND.primary}; font-size: 12px;">${task.debtors.email}</p>` : ""}
        </div>
      `;
    }

    // Custom signature section
    const signatureSection = branding?.email_signature 
      ? `<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid ${BRAND.border};">
           <p style="font-size: 12px; color: ${BRAND.foreground}; margin: 0; white-space: pre-line;">${branding.email_signature}</p>
         </div>`
      : "";

    // Generate email HTML using shared wrapper
    const bodyContent = generateTaskBodyContent({
      teamMemberName,
      task,
      invoiceSection,
      debtorSection,
      signatureSection,
    });

    const html = wrapEnterpriseEmail(bodyContent, {
      headerStyle: 'gradient',
      title: '📋 Task Assigned',
      subtitle: businessName,
    });

    // Send email
    const emailResponse = await resend.emails.send({
      from: `${COMPANY_INFO.displayName} <notifications@send.inbound.services.recouply.ai>`,
      to: [teamMemberEmail],
      subject: `[Task Assigned] ${taskTypeLabel} - ${task.debtors?.company_name || "Collection Task"}`,
      html,
      reply_to: replyTo,
    });

    console.log("[SEND-TASK-ASSIGNMENT] Email sent successfully:", emailResponse);

    // Update task to mark assignment email sent
    await supabase
      .from("collection_tasks")
      .update({ assignment_email_sent_at: new Date().toISOString() })
      .eq("id", taskId);

    // Create in-app notification for the assigned user
    // First, find the actual user_id (if memberUserId is an account_users.id, we need the linked user_id)
    let notifyUserId = memberUserId;
    if (profile?.id) {
      notifyUserId = profile.id;
    } else {
      // Try to get user_id from account_users
      const { data: au } = await supabase
        .from("account_users")
        .select("user_id")
        .eq("id", memberUserId)
        .maybeSingle();
      if (au?.user_id) {
        notifyUserId = au.user_id;
      }
    }

    // Get assigner name
    const { data: assignerProfile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", task.user_id)
      .maybeSingle();
    
    const assignerName = assignerProfile?.name || assignerProfile?.email || "A team member";
    const debtorName = task.debtors?.company_name || task.debtors?.name || "Unknown Account";

    // Create notification
    const { error: notifyError } = await supabase
      .from("user_notifications")
      .insert({
        user_id: notifyUserId,
        type: "task_assigned",
        title: "Task Assigned to You",
        message: `${assignerName} assigned you a ${task.priority} priority task: "${task.summary.substring(0, 50)}${task.summary.length > 50 ? "..." : ""}" for ${debtorName}`,
        link: "/tasks",
        source_type: "task",
        source_id: taskId,
        sender_id: task.user_id,
        sender_name: assignerName,
      });

    if (notifyError) {
      console.error("[SEND-TASK-ASSIGNMENT] Failed to create notification:", notifyError);
    } else {
      console.log("[SEND-TASK-ASSIGNMENT] In-app notification created for user:", notifyUserId);
    }

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[SEND-TASK-ASSIGNMENT] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
