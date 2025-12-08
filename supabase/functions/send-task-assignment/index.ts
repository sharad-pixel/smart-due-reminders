import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Enterprise Company Info
const COMPANY_INFO = {
  legalName: "RecouplyAI Inc.",
  displayName: "Recouply.ai",
  tagline: "AI-Powered CashOps Platform",
  website: "https://recouply.ai",
  emails: {
    notifications: "notifications@recouply.ai",
    support: "support@recouply.ai",
    collections: "collections@recouply.ai",
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

function generateEnterpriseTaskEmail(params: {
  teamMemberName: string;
  businessName: string;
  primaryColor: string;
  logoUrl?: string;
  task: any;
  invoiceSection: string;
  debtorSection: string;
  signatureSection: string;
  footerSection: string;
}): string {
  const { teamMemberName, businessName, primaryColor, logoUrl, task, invoiceSection, debtorSection, signatureSection, footerSection } = params;
  
  const taskTypeLabel = task.task_type.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
  const priorityBadge = task.priority === 'high' 
    ? '<span style="background: #dc2626; color: white; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase;">High Priority</span>'
    : task.priority === 'normal'
    ? '<span style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase;">Normal</span>'
    : '<span style="background: #6b7280; color: white; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase;">Low</span>';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Task Assignment - ${businessName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Main Container -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header with Branding -->
          <tr>
            <td style="background: linear-gradient(135deg, ${primaryColor} 0%, #1e40af 100%); border-radius: 16px 16px 0 0; padding: 32px 40px; text-align: center;">
              ${logoUrl 
                ? `<img src="${logoUrl}" alt="${businessName}" style="max-height: 48px; max-width: 180px; height: auto; margin-bottom: 16px;" />`
                : `<h1 style="color: #ffffff; margin: 0 0 8px; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">${businessName}</h1>`
              }
              <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 14px; font-weight: 500;">
                📋 New Task Assigned to You
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px;">
              <!-- Greeting -->
              <p style="margin: 0 0 24px; color: #1e293b; font-size: 16px;">
                Hi <strong>${teamMemberName}</strong>,
              </p>
              <p style="margin: 0 0 28px; color: #475569; font-size: 15px;">
                A new collection task has been assigned to you. Please review the details below and take appropriate action.
              </p>
              
              <!-- Task Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td>
                          <p style="margin: 0 0 8px; color: #92400e; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                            Task Type
                          </p>
                          <h2 style="margin: 0 0 12px; color: #78350f; font-size: 20px; font-weight: 700;">
                            ${taskTypeLabel}
                          </h2>
                          <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                            ${task.summary}
                          </p>
                        </td>
                        <td style="vertical-align: top; text-align: right; width: 100px;">
                          ${priorityBadge}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              ${task.details ? `
              <!-- Task Details -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin: 0 0 8px; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                      Details
                    </p>
                    <p style="margin: 0; color: #334155; font-size: 14px;">
                      ${task.details}
                    </p>
                  </td>
                </tr>
              </table>
              ` : ""}
              
              ${task.recommended_action ? `
              <!-- Recommended Action -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); border-left: 4px solid #22c55e; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin: 0 0 8px; color: #166534; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                      💡 Recommended Action
                    </p>
                    <p style="margin: 0; color: #15803d; font-size: 14px; font-weight: 500;">
                      ${task.recommended_action}
                    </p>
                  </td>
                </tr>
              </table>
              ` : ""}
              
              ${debtorSection}
              ${invoiceSection}
              
              <!-- Task Metadata -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 24px;">
                <tr>
                  <td style="padding-top: 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      ${task.due_date ? `
                      <tr>
                        <td style="padding: 4px 16px 4px 0; color: #64748b; font-size: 13px;">Due Date:</td>
                        <td style="padding: 4px 0; color: #1e293b; font-size: 13px; font-weight: 600;">${new Date(task.due_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      </tr>
                      ` : ""}
                      <tr>
                        <td style="padding: 4px 16px 4px 0; color: #64748b; font-size: 13px;">Created:</td>
                        <td style="padding: 4px 0; color: #1e293b; font-size: 13px;">${new Date(task.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 32px;">
                <tr>
                  <td align="center">
                    <a href="https://recouply.ai/tasks" style="display: inline-block; background: linear-gradient(135deg, ${primaryColor} 0%, #1e40af 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
                      View Task in Recouply
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- AI Response Tip -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #eff6ff; border-radius: 12px; margin-top: 28px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align: top; padding-right: 12px;">
                          <span style="font-size: 20px;">🤖</span>
                        </td>
                        <td>
                          <p style="margin: 0 0 4px; color: #1e40af; font-size: 13px; font-weight: 600;">
                            AI-Powered Response Tracking
                          </p>
                          <p style="margin: 0; color: #3b82f6; font-size: 13px;">
                            Reply to this email to log your communication. Your response will be processed by our AI for automatic task extraction and follow-up tracking.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              ${signatureSection}
            </td>
          </tr>
          
          <!-- Enterprise Footer -->
          <tr>
            <td style="background-color: #0f172a; border-radius: 0 0 16px 16px; padding: 32px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <!-- Recouply Badge -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 20px;">
                      <tr>
                        <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); width: 40px; height: 40px; border-radius: 10px; text-align: center; vertical-align: middle;">
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
                          <span style="background-color: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 500;">
                            🤖 6 AI Agents
                          </span>
                        </td>
                        <td style="padding: 0 8px;">
                          <span style="background-color: rgba(34, 197, 94, 0.2); color: #4ade80; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 500;">
                            ⏰ 24/7 Automation
                          </span>
                        </td>
                        <td style="padding: 0 8px;">
                          <span style="background-color: rgba(168, 85, 247, 0.2); color: #c084fc; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 500;">
                            📊 Smart Analytics
                          </span>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Contact Links -->
                    <p style="margin: 0 0 16px; color: #94a3b8; font-size: 12px;">
                      <a href="mailto:${COMPANY_INFO.emails.support}" style="color: #60a5fa; text-decoration: none;">Support</a>
                      &nbsp;•&nbsp;
                      <a href="mailto:${COMPANY_INFO.emails.collections}" style="color: #60a5fa; text-decoration: none;">Collections</a>
                      &nbsp;•&nbsp;
                      <a href="${COMPANY_INFO.website}" style="color: #60a5fa; text-decoration: none;">Website</a>
                    </p>
                    
                    ${footerSection}
                    
                    <!-- Legal -->
                    <p style="margin: 16px 0 0; color: #64748b; font-size: 11px;">
                      © ${new Date().getFullYear()} ${COMPANY_INFO.legalName}. All rights reserved.
                    </p>
                    <p style="margin: 4px 0 0; color: #475569; font-size: 10px;">
                      This email was sent on behalf of <strong>${businessName}</strong> via ${COMPANY_INFO.displayName}.
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
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; border-radius: 12px; margin-bottom: 16px;">
          <tr>
            <td style="padding: 20px 24px;">
              <p style="margin: 0 0 12px; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                📄 Invoice Details
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="50%" style="padding: 6px 0;">
                    <span style="color: #64748b; font-size: 13px;">Invoice #:</span>
                    <span style="color: #1e293b; font-size: 13px; font-weight: 600; margin-left: 8px;">${task.invoices.invoice_number || "N/A"}</span>
                  </td>
                  <td width="50%" style="padding: 6px 0;">
                    <span style="color: #64748b; font-size: 13px;">Amount:</span>
                    <span style="color: #1e293b; font-size: 13px; font-weight: 600; margin-left: 8px;">$${task.invoices.amount?.toLocaleString() || "0"}</span>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding: 6px 0;">
                    <span style="color: #64748b; font-size: 13px;">Due:</span>
                    <span style="color: #1e293b; font-size: 13px; margin-left: 8px;">${dueDate}</span>
                  </td>
                  <td width="50%" style="padding: 6px 0;">
                    <span style="color: #64748b; font-size: 13px;">Status:</span>
                    <span style="color: #1e293b; font-size: 13px; margin-left: 8px;">${task.invoices.status || "N/A"}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;
    }

    // Build debtor section
    let debtorSection = "";
    if (task.debtors) {
      debtorSection = `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f0f9ff; border-radius: 12px; margin-bottom: 16px;">
          <tr>
            <td style="padding: 20px 24px;">
              <p style="margin: 0 0 12px; color: #0369a1; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                🏢 Account Details
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding: 4px 0;">
                    <span style="color: #0c4a6e; font-size: 15px; font-weight: 600;">${task.debtors.name}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 0;">
                    <span style="color: #0369a1; font-size: 13px;">${task.debtors.company_name}</span>
                  </td>
                </tr>
                ${task.debtors.email ? `
                <tr>
                  <td style="padding: 4px 0;">
                    <span style="color: #0284c7; font-size: 13px;">${task.debtors.email}</span>
                  </td>
                </tr>
                ` : ""}
              </table>
            </td>
          </tr>
        </table>
      `;
    }

    // Custom signature section
    const signatureSection = branding?.email_signature 
      ? `<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
           <p style="font-size: 14px; color: #374151; margin: 0; white-space: pre-line;">${branding.email_signature}</p>
         </div>`
      : "";

    // Footer section
    const footerSection = branding?.email_footer
      ? `<p style="margin: 12px 0 0; color: #94a3b8; font-size: 11px;">${branding.email_footer}</p>`
      : "";

    // Generate enterprise email HTML
    const html = generateEnterpriseTaskEmail({
      teamMemberName,
      businessName,
      primaryColor,
      logoUrl: branding?.logo_url,
      task,
      invoiceSection,
      debtorSection,
      signatureSection,
      footerSection,
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
