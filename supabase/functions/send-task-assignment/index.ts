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
  teamMemberId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { taskId, teamMemberId }: TaskAssignmentRequest = await req.json();

    if (!taskId || !teamMemberId) {
      return new Response(
        JSON.stringify({ error: "Missing taskId or teamMemberId" }),
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
      console.error("Task fetch error:", taskError);
      return new Response(
        JSON.stringify({ error: "Task not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch team member
    const { data: teamMember, error: memberError } = await supabase
      .from("team_members")
      .select("*")
      .eq("id", teamMemberId)
      .single();

    if (memberError || !teamMember) {
      console.error("Team member fetch error:", memberError);
      return new Response(
        JSON.stringify({ error: "Team member not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

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

    // Build email HTML
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Task Assigned to You</h1>
        </div>
        
        <div style="background-color: white; padding: 24px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin: 0 0 16px 0;">Hi ${teamMember.name},</p>
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
        </div>
        
        <div style="text-align: center; padding: 16px; color: #999; font-size: 12px;">
          <p style="margin: 0;">Sent by Recouply.ai • AI-Powered Collections Platform</p>
        </div>
      </body>
      </html>
    `;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Recouply.ai <notifications@send.inbound.services.recouply.ai>",
      to: [teamMember.email],
      subject: `[Task Assigned] ${taskTypeLabel} - ${task.debtors?.company_name || "Collection Task"}`,
      html,
      reply_to: replyTo,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-task-assignment:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
