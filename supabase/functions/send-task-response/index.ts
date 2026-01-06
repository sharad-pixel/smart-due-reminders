import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * SEND TASK RESPONSE
 * 
 * Sends AI-generated or user-edited responses for collection tasks.
 * Tracks response history and updates task status.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Email domain configuration
const VERIFIED_EMAIL_DOMAIN = "send.inbound.services.recouply.ai";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const { task_id, subject, body, send_to, was_edited } = await req.json();

    if (!task_id) {
      throw new Error("task_id is required");
    }

    console.log(`[SEND-TASK-RESPONSE] Processing response for task ${task_id}`);

    // Get task details with debtor info
    const { data: task, error: taskError } = await supabase
      .from("collection_tasks")
      .select(`
        *,
        debtors (name, company_name, email),
        invoices (invoice_number, amount)
      `)
      .eq("id", task_id)
      .single();

    if (taskError || !task) {
      throw new Error(`Task not found: ${taskError?.message || "Unknown"}`);
    }

    // Determine recipient email
    const recipientEmail = send_to || task.original_email_from || task.from_email;
    if (!recipientEmail) {
      throw new Error("No recipient email available");
    }

    // Get user's branding settings for from address
    const { data: branding } = await supabase
      .from("branding_settings")
      .select("business_name, from_name")
      .eq("user_id", task.user_id)
      .single();

    const fromName = branding?.from_name || branding?.business_name || "Recouply.ai";
    const fromEmail = `collections@${VERIFIED_EMAIL_DOMAIN}`;

    // Send via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    console.log(`[SEND-TASK-RESPONSE] Sending email to ${recipientEmail}`);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: recipientEmail,
        subject: subject,
        html: body.replace(/\n/g, "<br>"),
        text: body,
        reply_to: `inbound@inbound.services.recouply.ai`,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error(`[SEND-TASK-RESPONSE] Email failed:`, errorText);
      throw new Error(`Email failed: ${errorText}`);
    }

    const emailResult = await emailResponse.json();
    console.log(`[SEND-TASK-RESPONSE] Email sent successfully: ${emailResult.id}`);

    // Update task with response status
    const { error: updateError } = await supabase
      .from("collection_tasks")
      .update({
        response_status: was_edited ? "edited_sent" : "sent",
        response_sent_at: new Date().toISOString(),
        response_sent_to: recipientEmail,
      })
      .eq("id", task_id);

    if (updateError) {
      console.error(`[SEND-TASK-RESPONSE] Failed to update task:`, updateError);
    }

    // Log the response in task_responses table
    const { error: logError } = await supabase
      .from("task_responses")
      .insert({
        task_id: task_id,
        user_id: task.user_id,
        subject: subject,
        body: body,
        sent_to: recipientEmail,
        was_edited: was_edited || false,
        original_ai_body: task.suggested_response_body,
        resend_email_id: emailResult.id,
        delivery_status: "sent",
      });

    if (logError) {
      console.error(`[SEND-TASK-RESPONSE] Failed to log response:`, logError);
    }

    // Log collection activity
    await supabase.from("collection_activities").insert({
      user_id: task.user_id,
      debtor_id: task.debtor_id,
      invoice_id: task.invoice_id,
      activity_type: "smart_response_sent",
      channel: "email",
      direction: "outbound",
      subject: subject,
      message_body: body,
      sent_at: new Date().toISOString(),
      metadata: {
        task_id: task_id,
        task_type: task.task_type,
        was_edited: was_edited || false,
        resend_email_id: emailResult.id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        email_id: emailResult.id,
        sent_to: recipientEmail,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[SEND-TASK-RESPONSE] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
