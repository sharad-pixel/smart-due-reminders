import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskAssignmentRequest {
  taskId: string;
  teamMemberId?: string;  // Legacy - maps to account_users.id or profiles.id
  accountUserId?: string; // account_users.id
  userId?: string;        // profiles.id (user_id in account_users)
  debtorId?: string;      // Optional context
  invoiceId?: string;     // Optional context
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

    // Determine which ID to use for finding the team member
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

    // Fetch team member from profiles table (the user_id from account_users links to profiles.id)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("id", memberUserId)
      .maybeSingle();

    // If no profile found directly, try to look up via account_users
    let teamMemberEmail = profile?.email;
    let teamMemberName = profile?.name || "Team Member";

    if (!profile) {
      console.log("[SEND-TASK-ASSIGNMENT] No profile found for ID, checking account_users...");
      
      // Try to find in account_users and get the linked email
      const { data: accountUser, error: auError } = await supabase
        .from("account_users")
        .select("id, user_id, email, role")
        .eq("id", memberUserId)
        .maybeSingle();

      if (accountUser) {
        // If account_users entry has an email directly, use it
        teamMemberEmail = accountUser.email;
        
        // If there's a user_id, fetch the profile for the name
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
        // Also try looking up by user_id in account_users
        const { data: accountUserByUserId } = await supabase
          .from("account_users")
          .select("id, user_id, email")
          .eq("user_id", memberUserId)
          .maybeSingle();

        if (accountUserByUserId) {
          teamMemberEmail = accountUserByUserId.email;
          
          // Get profile for name
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

    // Fetch branding settings for the task owner
    const { data: branding } = await supabase
      .from("branding_settings")
      .select("logo_url, business_name, from_name, email_signature, email_footer, primary_color")
      .eq("user_id", task.user_id)
      .maybeSingle();

    const businessName = branding?.business_name || branding?.from_name || "Your Organization";
    const primaryColor = branding?.primary_color || "#1e3a5f";

    // Build reply-to address for AI processing
    const replyTo = task.invoice_id 
      ? `invoice+${task.invoice_id}@inbound.services.recouply.ai`
      : `debtor+${task.debtor_id}@inbound.services.recouply.ai`;

    // Format task type
    const taskTypeLabel = task.task_type.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());

    // Build invoice details section
    let invoiceSection = "";
    if (task.invoices) {
      const dueDate = task.invoices.due_date 
        ? new Date(task.invoices.due_date).toLocaleDateString()
        : "N/A";
      invoiceSection = `
        <div style="background-color: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 12px 0; color: #333;">Invoice Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 8px; color: #666;">Invoice #:</td>
              <td style="padding: 4px 8px; font-weight: 600;">${task.invoices.invoice_number || "N/A"}</td>
            </tr>
            <tr>
              <td style="padding: 4px 8px; color: #666;">Amount:</td>
              <td style="padding: 4px 8px; font-weight: 600;">$${task.invoices.amount?.toLocaleString() || "0"}</td>
            </tr>
            <tr>
              <td style="padding: 4px 8px; color: #666;">Due Date:</td>
              <td style="padding: 4px 8px;">${dueDate}</td>
            </tr>
            <tr>
              <td style="padding: 4px 8px; color: #666;">Status:</td>
              <td style="padding: 4px 8px;">${task.invoices.status || "N/A"}</td>
            </tr>
            <tr>
              <td style="padding: 4px 8px; color: #666;">Aging Bucket:</td>
              <td style="padding: 4px 8px;">${task.invoices.aging_bucket?.replace(/_/g, " ") || "N/A"}</td>
            </tr>
          </table>
        </div>
      `;
    }

    // Build debtor details section
    let debtorSection = "";
    if (task.debtors) {
      debtorSection = `
        <div style="background-color: #f0f4f8; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 12px 0; color: #333;">Customer Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 8px; color: #666;">Name:</td>
              <td style="padding: 4px 8px; font-weight: 600;">${task.debtors.name}</td>
            </tr>
            <tr>
              <td style="padding: 4px 8px; color: #666;">Company:</td>
              <td style="padding: 4px 8px;">${task.debtors.company_name}</td>
            </tr>
            <tr>
              <td style="padding: 4px 8px; color: #666;">Email:</td>
              <td style="padding: 4px 8px;">${task.debtors.email || "N/A"}</td>
            </tr>
          </table>
        </div>
      `;
    }

    // Custom signature section
    const signatureSection = branding?.email_signature 
      ? `<p style="font-size: 14px; color: #374151; margin: 16px 0; white-space: pre-line;">${branding.email_signature}</p>`
      : "";

    // Logo section
    const logoSection = branding?.logo_url
      ? `<img src="${branding.logo_url}" alt="${businessName}" style="max-width: 140px; height: auto; margin-bottom: 12px;" />`
      : "";

    // Footer section
    const footerSection = branding?.email_footer
      ? `<p style="font-size: 12px; color: #64748b; margin-top: 12px;">${branding.email_footer}</p>`
      : "";

    // Build email HTML
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <div style="background: linear-gradient(135deg, ${primaryColor} 0%, #2d5a87 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          ${branding?.logo_url 
            ? `<img src="${branding.logo_url}" alt="${businessName}" style="max-height: 48px; max-width: 180px; height: auto; margin-bottom: 12px;" />`
            : `<h1 style="color: white; margin: 0; font-size: 24px;">${businessName}</h1>`
          }
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Task Assigned to You</p>
        </div>
        
        <div style="background-color: white; padding: 24px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin: 0 0 16px 0;">Hi ${teamMemberName},</p>
          <p style="margin: 0 0 20px 0;">A new collection task has been assigned to you:</p>
          
          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 16px 0;">
            <h2 style="margin: 0 0 8px 0; color: #856404; font-size: 18px;">${taskTypeLabel}</h2>
            <p style="margin: 0; color: #856404;">${task.summary}</p>
          </div>
          
          ${task.details ? `
            <div style="margin: 16px 0;">
              <h3 style="margin: 0 0 8px 0; color: #333;">Details</h3>
              <p style="margin: 0; color: #666;">${task.details}</p>
            </div>
          ` : ""}
          
          ${task.recommended_action ? `
            <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 16px; margin: 16px 0;">
              <h3 style="margin: 0 0 8px 0; color: #155724;">Recommended Action</h3>
              <p style="margin: 0; color: #155724;">${task.recommended_action}</p>
            </div>
          ` : ""}
          
          ${debtorSection}
          ${invoiceSection}
          
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0; font-size: 14px; color: #666;">
              <strong>Priority:</strong> ${task.priority}<br>
              ${task.due_date ? `<strong>Due Date:</strong> ${new Date(task.due_date).toLocaleDateString()}<br>` : ""}
              <strong>Created:</strong> ${new Date(task.created_at).toLocaleDateString()}
            </p>
          </div>
          
          <div style="margin-top: 24px; padding: 16px; background-color: #e7f3ff; border-radius: 8px;">
            <p style="margin: 0; font-size: 14px; color: #0066cc;">
              <strong>💡 Tip:</strong> Reply to this email to log your communication. Responses will be processed by AI for further task extraction.
            </p>
          </div>

          <!-- Signature Section -->
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
            ${signatureSection}
            ${logoSection}
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top: 16px;">
              <tr>
                <td style="vertical-align: top; padding-right: 12px;">
                  <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); border-radius: 8px; text-align: center; line-height: 40px;">
                    <span style="color: #ffffff; font-weight: bold; font-size: 16px;">R</span>
                  </div>
                </td>
                <td style="vertical-align: top;">
                  <p style="margin: 0; font-size: 13px; color: #64748b;">
                    Sent on behalf of <strong style="color: #1e293b;">${businessName}</strong>
                  </p>
                  <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">
                    Powered by <a href="https://recouply.ai" style="color: #2563eb; text-decoration: none;">Recouply.ai</a> • AI-Powered CashOps
                  </p>
                </td>
              </tr>
            </table>
            ${footerSection}
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Recouply.ai <notifications@send.inbound.services.recouply.ai>",
      to: [teamMemberEmail],
      subject: `[Task Assigned] ${taskTypeLabel} - ${task.debtors?.company_name || "Collection Task"}`,
      html,
      reply_to: replyTo,
    });

    console.log("[SEND-TASK-ASSIGNMENT] Email sent successfully:", emailResponse);

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
