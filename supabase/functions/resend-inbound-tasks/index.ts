import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * RESEND INBOUND TASKS EDGE FUNCTION
 * 
 * This function handles inbound email webhooks from Resend and automatically:
 * 1. Captures customer responses to outreach efforts
 * 2. Summarizes the response using Lovable AI
 * 3. Links the response to the original outreach
 * 4. Logs the activity and auto-generates tasks
 * 
 * SETUP INSTRUCTIONS:
 * 1. In Resend dashboard (https://resend.com/inbound), create an inbound route
 * 2. Set the destination to: https://kguurazunazhhrhasahd.supabase.co/functions/v1/resend-inbound-tasks
 * 3. Configure DNS MX records as specified by Resend
 * 4. Test with: invoice+<invoice_id>@recouply.ai or debtor+<debtor_id>@recouply.ai
 * 
 * EMAIL SUBADDRESSING:
 * - invoice+<invoice_id>@recouply.ai → Creates invoice-level response
 * - debtor+<debtor_id>@recouply.ai → Creates debtor-level response
 * 
 * RESPONSE FLOW:
 * 1. Parse email and identify invoice/debtor
 * 2. Use AI to summarize customer's response
 * 3. Log as collection activity (links to original outreach if found)
 * 4. Auto-extract tasks based on response content
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
    
    // Handle both array and string formats for email.to
    const toEmail = Array.isArray(email.to) ? email.to[0] : email.to;
    const toEmailMatch = toEmail.match(/^(invoice|debtor)\+([a-f0-9\-]+)@/i);
    
    if (!toEmailMatch) {
      console.log("[RESEND-INBOUND] Email format not recognized:", toEmail);
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

    // Get user_id and debtor details
    const { data: debtor } = await supabase
      .from("debtors")
      .select("user_id, name, email")
      .eq("id", debtorId)
      .single();

    if (!debtor) {
      throw new Error("Could not determine user_id for task");
    }

    // Use Lovable AI to generate intelligent summary
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let aiSummary = "";
    
    if (LOVABLE_API_KEY) {
      try {
        console.log("[RESEND-INBOUND] Generating AI summary");
        
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: "You are an AR collections assistant. Summarize customer responses in 1-2 concise sentences, highlighting key points like payment intent, disputes, or action requests."
              },
              {
                role: "user",
                content: `Summarize this customer response:\n\nFrom: ${email.from}\nSubject: ${email.subject}\n\n${email.text || email.html}`
              }
            ]
          })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiSummary = aiData.choices?.[0]?.message?.content || "";
          console.log("[RESEND-INBOUND] AI summary generated");
        }
      } catch (aiError) {
        console.error("[RESEND-INBOUND] AI summarization failed (non-fatal):", aiError);
      }
    }

    // Fallback to simple summary if AI fails
    const summary = aiSummary || 
      (email.text || email.subject || "Customer reply received")
        .substring(0, 200)
        .trim() + (email.text && email.text.length > 200 ? "..." : "");

    // Try to find the original outreach this is responding to
    // Check for Message-ID in headers or recent outreach to this debtor/invoice
    let linkedOutreachId = null;
    
    try {
      const { data: recentOutreach } = await supabase
        .from("outreach_logs")
        .select("id")
        .eq("debtor_id", debtorId)
        .eq("invoice_id", invoiceId || debtorId)
        .order("sent_at", { ascending: false })
        .limit(1)
        .single();
      
      if (recentOutreach) {
        linkedOutreachId = recentOutreach.id;
        console.log("[RESEND-INBOUND] Linked to outreach:", linkedOutreachId);
      }
    } catch (e) {
      console.log("[RESEND-INBOUND] Could not find linked outreach (ok)");
    }

    // Log this as a collection activity (inbound response)
    const { data: activity, error: activityError } = await supabase
      .from("collection_activities")
      .insert({
        user_id: debtor.user_id,
        debtor_id: debtorId,
        invoice_id: invoiceId,
        activity_type: "customer_response",
        direction: "inbound",
        channel: "email",
        subject: email.subject,
        message_body: summary,
        response_message: email.text || email.html,
        linked_outreach_log_id: linkedOutreachId,
        responded_at: new Date().toISOString(),
        metadata: {
          task_type: taskType,
          from_email: email.from,
          to_email: email.to,
          ai_generated_summary: !!aiSummary
        }
      })
      .select()
      .single();

    if (activityError) {
      console.error("[RESEND-INBOUND] Error logging activity:", activityError);
    } else {
      console.log("[RESEND-INBOUND] Activity logged:", activity.id);
    }

    // Call extract-collection-tasks to auto-generate tasks
    let tasksCreated = 0;
    
    try {
      console.log("[RESEND-INBOUND] Triggering task extraction");
      
      const extractResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/extract-collection-tasks`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          activity_id: activity?.id,
          message: email.text || email.html,
          debtor_id: debtorId,
          invoice_id: invoiceId
        })
      });

      if (extractResponse.ok) {
        const extractData = await extractResponse.json();
        tasksCreated = extractData.tasks_created || 0;
        console.log("[RESEND-INBOUND] Tasks auto-created:", tasksCreated);
      }
    } catch (extractError) {
      console.error("[RESEND-INBOUND] Task extraction failed (non-fatal):", extractError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        activity_id: activity?.id,
        tasks_created: tasksCreated,
        summary: summary,
        level: level.toLowerCase(),
        linked_to_outreach: !!linkedOutreachId
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
