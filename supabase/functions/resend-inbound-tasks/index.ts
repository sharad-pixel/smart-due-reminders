import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * RESEND INBOUND TASKS EDGE FUNCTION
 * 
 * This function handles inbound email webhooks from Resend and automatically creates tasks
 * based on customer replies to collection emails.
 * 
 * SETUP INSTRUCTIONS:
 * 1. In Resend dashboard (https://resend.com/inbound), create an inbound route
 * 2. Set the destination to: https://kguurazunazhhrhasahd.supabase.co/functions/v1/resend-inbound-tasks
 * 3. Configure DNS MX records as specified by Resend
 * 4. Test with: invoice+<invoice_id>@recouply.ai or debtor+<debtor_id>@recouply.ai
 * 
 * EMAIL SUBADDRESSING:
 * - invoice+<invoice_id>@recouply.ai → Creates invoice-level task
 * - debtor+<debtor_id>@recouply.ai → Creates debtor-level task
 * 
 * TASK CLASSIFICATION:
 * Currently uses rule-based classification. Future versions will use LLM for better accuracy.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResendInboundEmail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[RESEND-INBOUND] Received webhook");

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
    const payload = await req.json();
    console.log("[RESEND-INBOUND] Payload type:", payload.type);

    // Resend sends type: "email.received"
    if (payload.type !== "email.received") {
      return new Response(
        JSON.stringify({ error: "Invalid webhook type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email: ResendInboundEmail = payload.data;
    console.log("[RESEND-INBOUND] Processing email from:", email.from, "to:", email.to);

    // Parse the "to" email to determine level and IDs
    // Expected formats:
    // - invoice+<invoice_id>@recouply.ai
    // - debtor+<debtor_id>@recouply.ai
    
    const toEmailMatch = email.to.match(/^(invoice|debtor)\+([a-f0-9\-]+)@/i);
    
    if (!toEmailMatch) {
      console.log("[RESEND-INBOUND] Email format not recognized:", email.to);
      return new Response(
        JSON.stringify({ success: false, error: "Unrecognized email format" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [, level, id] = toEmailMatch;
    console.log("[RESEND-INBOUND] Parsed level:", level, "id:", id);

    let invoiceId: string | null = null;
    let debtorId: string | null = null;

    // INVOICE-LEVEL TASK
    // Links to a specific invoice, debtor is looked up from the invoice
    if (level.toLowerCase() === "invoice") {
      invoiceId = id;
      
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select("debtor_id, user_id")
        .eq("id", invoiceId)
        .single();

      if (invoiceError || !invoice) {
        console.error("[RESEND-INBOUND] Invoice not found:", invoiceId, invoiceError);
        return new Response(
          JSON.stringify({ success: false, error: "Invoice not found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      debtorId = invoice.debtor_id;
      console.log("[RESEND-INBOUND] Invoice-level task, debtor:", debtorId);
    }
    // DEBTOR-LEVEL TASK
    // Links to overall customer account, not a specific invoice
    else if (level.toLowerCase() === "debtor") {
      debtorId = id;
      
      const { data: debtor, error: debtorError } = await supabase
        .from("debtors")
        .select("id, user_id")
        .eq("id", debtorId)
        .single();

      if (debtorError || !debtor) {
        console.error("[RESEND-INBOUND] Debtor not found:", debtorId, debtorError);
        return new Response(
          JSON.stringify({ success: false, error: "Debtor not found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[RESEND-INBOUND] Debtor-level task");
    }

    // Classify task type using rule-based classification
    // Future: Replace with LLM for better accuracy
    const emailContent = (email.text || email.html || "").toLowerCase();
    let taskType = "MANUAL_REVIEW";
    
    if (emailContent.includes("payment plan") || emailContent.includes("installments") || emailContent.includes("cannot pay in full")) {
      taskType = "SETUP_PAYMENT_PLAN";
    } else if (emailContent.includes("dispute") || emailContent.includes("wrong amount") || emailContent.includes("not my invoice")) {
      taskType = "REVIEW_DISPUTE";
    } else if (emailContent.includes("call me") || emailContent.includes("phone call") || emailContent.includes("call back")) {
      taskType = "CALL_CUSTOMER";
    } else if (emailContent.includes("update card") || emailContent.includes("new card") || emailContent.includes("payment method")) {
      taskType = "UPDATE_PAYMENT_METHOD";
    } else if (emailContent.includes("pay now") || emailContent.includes("ready to pay") || emailContent.includes("send link")) {
      taskType = "SEND_PAYMENT_LINK";
    }

    console.log("[RESEND-INBOUND] Classified as:", taskType);

    // Generate task summary (first 200 chars of email text)
    const summary = (email.text || email.subject || "Customer reply received")
      .substring(0, 200)
      .trim() + (email.text && email.text.length > 200 ? "..." : "");

    // Get user_id for the task
    const { data: debtor } = await supabase
      .from("debtors")
      .select("user_id")
      .eq("id", debtorId)
      .single();

    if (!debtor) {
      throw new Error("Could not determine user_id for task");
    }

    // Insert task into collection_tasks
    const { data: task, error: taskError } = await supabase
      .from("collection_tasks")
      .insert({
        debtor_id: debtorId,
        invoice_id: invoiceId,
        user_id: debtor.user_id,
        from_email: email.from,
        to_email: email.to,
        subject: email.subject,
        level: level.toLowerCase(),
        task_type: taskType,
        summary: summary,
        details: email.text || email.html,
        raw_email: JSON.stringify(email),
        status: "open",
        source: "email_reply",
        priority: taskType === "REVIEW_DISPUTE" ? "high" : "normal",
      })
      .select()
      .single();

    if (taskError) {
      console.error("[RESEND-INBOUND] Error creating task:", taskError);
      throw taskError;
    }

    console.log("[RESEND-INBOUND] Task created successfully:", task.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        task_id: task.id,
        task_type: taskType,
        level: level.toLowerCase()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
