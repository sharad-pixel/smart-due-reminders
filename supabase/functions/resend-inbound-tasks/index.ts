import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

/**
 * RESEND INBOUND TASKS EDGE FUNCTION
 * 
 * This function handles inbound email webhooks from Resend and automatically:
 * 1. Parses Resend webhook payload (handles both event wrapper and direct email formats)
 * 2. Routes emails based on subaddressing (invoice+<id> or debtor+<id>)
 * 3. Creates tasks in collection_tasks table with full email data
 * 4. Logs activity in collection_activities for history tracking
 * 
 * SETUP INSTRUCTIONS:
 * 1. In Resend dashboard, create an inbound route
 * 2. Set the destination to: https://kguurazunazhhrhasahd.supabase.co/functions/v1/resend-inbound-tasks
 * 3. Configure DNS MX records as specified by Resend
 * 4. Use format: invoice+<invoice_id>@recouply.ai or debtor+<debtor_id>@recouply.ai
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResendInboundEmail {
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  attachments?: Array<{
    content: string;
    filename: string;
    content_type: string;
    size: number;
  }>;
  reply_to?: string;
  cc?: string | string[];
  bcc?: string | string[];
  in_reply_to?: string;
  message_id?: string;
  raw?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    console.log("[RESEND-INBOUND] Received webhook");

    // Verify webhook signature for security (optional for inbound routes)
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    const payload = await req.text();
    const requestHeaders = Object.fromEntries(req.headers);
    
    let raw: any;
    
    // Try signature verification if secret exists and headers are present
    if (webhookSecret && (requestHeaders['svix-id'] || requestHeaders['webhook-id'])) {
      const wh = new Webhook(webhookSecret);
      
      try {
        raw = wh.verify(payload, requestHeaders);
        console.log("[RESEND-INBOUND] Webhook signature verified");
      } catch (error: any) {
        console.error("[RESEND-INBOUND] Webhook verification failed:", error.message);
        return new Response(
          JSON.stringify({ error: "Invalid webhook signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Inbound Email Route without signature - parse directly
      console.log("[RESEND-INBOUND] Processing inbound email route (no signature verification)");
      try {
        raw = JSON.parse(payload);
      } catch (error: any) {
        console.error("[RESEND-INBOUND] Failed to parse payload:", error.message);
        return new Response(
          JSON.stringify({ error: "Invalid payload format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Parse Resend webhook payload
    // Handle both formats: { object: "event", type: "email.received", data: {...} } OR direct email object
    console.log("[RESEND-INBOUND] Payload verified and parsed");

    const email: ResendInboundEmail = (raw?.data && (raw.type === "email.received" || raw.object === "event"))
      ? raw.data
      : raw;
    // Extract email fields
    const toArray = email.to ?? [];
    const toEmail: string = (Array.isArray(toArray) ? (toArray[0] || "") : toArray).toString();
    const fromEmail: string = email.from || "";
    const subject: string = email.subject || "";
    const htmlBody: string = email.html || "";
    const textBody: string = email.text || "";
    const emailHeaders = email.headers || {};
    const attachments = email.attachments || [];

    console.log("[RESEND-INBOUND] From:", fromEmail, "To:", toEmail, "Subject:", subject);

    // Parse the recipient local part for routing
    // Expected: invoice+<uuid>@recouply.ai OR debtor+<uuid>@recouply.ai
    let taskLevel: "invoice" | "debtor" | "unknown" = "unknown";
    let refUuid: string | null = null;

    if (toEmail) {
      const [localPart] = toEmail.split("@");
      const [prefix, uuidCandidate] = localPart.split("+");

      if (prefix === "invoice" && uuidCandidate) {
        taskLevel = "invoice";
        refUuid = uuidCandidate;
      } else if (prefix === "debtor" && uuidCandidate) {
        taskLevel = "debtor";
        refUuid = uuidCandidate;
      }
    }

    // Guard unknown patterns
    if (taskLevel === "unknown" || !refUuid) {
      console.warn("[RESEND-INBOUND] Unrecognized recipient pattern:", toEmail);
      return new Response(
        JSON.stringify({ success: true, warning: "Unrecognized recipient pattern" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[RESEND-INBOUND] Parsed:", taskLevel, "ID:", refUuid);

    // Resolve invoice_id and debtor_id based on routing
    let invoiceId: string | null = null;
    let debtorId: string | null = null;
    let userId: string | null = null;

    if (taskLevel === "invoice") {
      invoiceId = refUuid;
      
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select("debtor_id, user_id")
        .eq("id", invoiceId)
        .single();

      if (invoiceError || !invoice) {
        console.error("[RESEND-INBOUND] Invoice not found:", invoiceId);
        return new Response(
          JSON.stringify({ success: false, error: "Invoice not found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      debtorId = invoice.debtor_id;
      userId = invoice.user_id;
      console.log("[RESEND-INBOUND] Invoice-level email, debtor:", debtorId);
    } else if (taskLevel === "debtor") {
      debtorId = refUuid;
      
      const { data: debtor, error: debtorError } = await supabase
        .from("debtors")
        .select("id, user_id")
        .eq("id", debtorId)
        .single();

      if (debtorError || !debtor) {
        console.error("[RESEND-INBOUND] Debtor not found:", debtorId);
        return new Response(
          JSON.stringify({ success: false, error: "Debtor not found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = debtor.user_id;
      console.log("[RESEND-INBOUND] Debtor-level email");
    }

    // Classify task type using rule-based classification
    const emailContent = (textBody || htmlBody || "").toLowerCase();
    let taskType = "MANUAL_REVIEW";
    
    if (emailContent.includes("payment plan") || emailContent.includes("installments")) {
      taskType = "SETUP_PAYMENT_PLAN";
    } else if (emailContent.includes("dispute") || emailContent.includes("wrong amount")) {
      taskType = "REVIEW_DISPUTE";
    } else if (emailContent.includes("call me") || emailContent.includes("phone call")) {
      taskType = "CALL_CUSTOMER";
    } else if (emailContent.includes("update card") || emailContent.includes("payment method")) {
      taskType = "UPDATE_PAYMENT_METHOD";
    } else if (emailContent.includes("pay now") || emailContent.includes("ready to pay")) {
      taskType = "SEND_PAYMENT_LINK";
    }

    console.log("[RESEND-INBOUND] Task type:", taskType);

    // Build comprehensive metadata with ALL email data
    const fullMetadata = {
      from_email: fromEmail,
      to_email: toEmail,
      cc: email.cc,
      bcc: email.bcc,
      reply_to: email.reply_to,
      message_id: email.message_id,
      in_reply_to: email.in_reply_to,
      headers: emailHeaders,
      attachments: attachments.map((att: any) => ({
        filename: att.filename,
        content_type: att.content_type,
        size: att.size,
        content: att.size < 100000 ? att.content : '[Content too large]'
      })),
      has_attachments: attachments.length > 0,
      raw_email: email.raw || null
    };

    // Create task directly
    const taskSummary = subject || "Email response received";
    const taskDetails = textBody || htmlBody || "";

    const { data: task, error: taskError } = await supabase
      .from("collection_tasks")
      .insert({
        user_id: userId,
        debtor_id: debtorId,
        invoice_id: invoiceId,
        task_type: taskType,
        priority: "normal",
        status: "open",
        summary: taskSummary,
        details: taskDetails,
        level: taskLevel,
        from_email: fromEmail,
        to_email: toEmail,
        subject: subject,
        raw_email: JSON.stringify(fullMetadata),
        source: "email",
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (taskError) {
      console.error("[RESEND-INBOUND] Error creating task:", taskError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create task" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[RESEND-INBOUND] Task created:", task.id);

    // Also log as collection activity for history
    const { error: activityError } = await supabase
      .from("collection_activities")
      .insert({
        user_id: userId,
        debtor_id: debtorId,
        invoice_id: invoiceId,
        activity_type: "customer_response",
        direction: "inbound",
        channel: "email",
        subject: subject,
        message_body: taskSummary,
        response_message: taskDetails,
        responded_at: new Date().toISOString(),
        metadata: fullMetadata
      });

    if (activityError) {
      console.error("[RESEND-INBOUND] Error logging activity:", activityError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        task_id: task.id,
        task_type: taskType,
        level: taskLevel,
        summary: taskSummary
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[RESEND-INBOUND] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
