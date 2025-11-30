import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * RESEND INBOUND EMAIL HANDLER - Platform-Wide
 * 
 * Handles ALL inbound emails from Resend for the entire platform:
 * 1. Stores raw email in inbound_emails table
 * 2. Auto-links to Debtors/Invoices via address patterns
 * 3. Triggers AI processing for summaries and action extraction
 * 
 * Address Patterns:
 * - invoice+<invoice_id>@inbound.services.recouply.ai
 * - debtor+<debtor_id>@inbound.services.recouply.ai
 * - collections@inbound.services.recouply.ai (general)
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
  email_id?: string;
  raw?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    {
      auth: { persistSession: false },
    }
  );

  let inboundEmailId: string | null = null;

  try {
    console.log("[INBOUND] ✅ Received webhook");

    // Parse payload
    let raw: any;
    try {
      raw = await req.json();
      console.log("[INBOUND] Payload preview:", JSON.stringify(raw).substring(0, 200));
    } catch (error: any) {
      console.error("[INBOUND] ❌ Failed to parse JSON:", error.message);
      return new Response(JSON.stringify({ success: true, message: "Received but could not parse" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract email object
    const email: ResendInboundEmail = raw?.data && (raw.type === "email.received" || raw.object === "event")
      ? raw.data
      : raw;

    const toArray = Array.isArray(email.to) ? email.to : [email.to];
    const fromEmail = email.from || "";
    const subject = email.subject || "";
    const textBody = email.text || "";
    const htmlBody = email.html || "";
    const messageId = email.message_id || `${Date.now()}-${Math.random()}`;

    console.log("[INBOUND] From:", fromEmail, "To:", toArray[0], "Subject:", subject);

    // Parse recipient pattern
    let taskLevel: "invoice" | "debtor" | "general" = "general";
    let refId: string | null = null;
    let userId: string | null = null;
    let debtorId: string | null = null;
    let invoiceId: string | null = null;

    const primaryTo = toArray[0] || "";
    const [localPart] = primaryTo.split("@");

    // Check for invoice+ or debtor+ pattern
    if (localPart.includes("+")) {
      const [prefix, id] = localPart.split("+");
      if (prefix === "invoice" && id) {
        taskLevel = "invoice";
        refId = id;
      } else if (prefix === "debtor" && id) {
        taskLevel = "debtor";
        refId = id;
      }
    } else if (localPart === "collections") {
      // General inbox - try to match by sender email
      taskLevel = "general";
      console.log("[INBOUND] General inbox, will try to match by sender:", fromEmail);
    }

    // Resolve user_id, debtor_id, invoice_id
    if (taskLevel === "invoice" && refId) {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("id, debtor_id, user_id")
        .eq("id", refId)
        .single();

      if (invoice) {
        invoiceId = invoice.id;
        debtorId = invoice.debtor_id;
        userId = invoice.user_id;
        console.log("[INBOUND] Linked to invoice:", invoiceId);
      }
    } else if (taskLevel === "debtor" && refId) {
      const { data: debtor } = await supabase
        .from("debtors")
        .select("id, user_id")
        .eq("id", refId)
        .single();

      if (debtor) {
        debtorId = debtor.id;
        userId = debtor.user_id;
        console.log("[INBOUND] Linked to debtor:", debtorId);
      }
    } else if (taskLevel === "general") {
      // Try to find debtor by email
      const { data: debtor } = await supabase
        .from("debtors")
        .select("id, user_id")
        .or(`email.eq.${fromEmail},ar_contact_email.eq.${fromEmail},primary_email.eq.${fromEmail}`)
        .limit(1)
        .single();

      if (debtor) {
        debtorId = debtor.id;
        userId = debtor.user_id;
        console.log("[INBOUND] Matched sender to debtor:", debtorId);
      }
    }

    // Insert into inbound_emails table
    const { data: inboundEmail, error: insertError } = await supabase
      .from("inbound_emails")
      .insert({
        user_id: userId,
        event_type: raw?.type || "email.received",
        raw_payload: raw,
        from_email: fromEmail,
        from_name: email.from,
        to_emails: toArray,
        cc_emails: email.cc ? (Array.isArray(email.cc) ? email.cc : [email.cc]) : null,
        bcc_emails: email.bcc ? (Array.isArray(email.bcc) ? email.bcc : [email.bcc]) : null,
        subject: subject,
        text_body: textBody,
        html_body: htmlBody,
        message_id: messageId,
        email_id: email.email_id,
        debtor_id: debtorId,
        invoice_id: invoiceId,
        status: (debtorId || invoiceId) ? "linked" : "received",
        error_message: null,
      })
      .select()
      .single();

    if (insertError || !inboundEmail) {
      console.error("[INBOUND] ❌ Failed to insert:", insertError);
      // Try to insert error record
      await supabase.from("inbound_emails").insert({
        user_id: userId,
        event_type: "error",
        raw_payload: raw,
        from_email: fromEmail,
        to_emails: toArray,
        subject: subject,
        message_id: messageId,
        status: "error",
        error_message: insertError?.message || "Unknown error",
      });

      return new Response(JSON.stringify({ success: true, warning: "Stored with errors" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    inboundEmailId = inboundEmail.id;
    console.log("[INBOUND] ✅ Stored email:", inboundEmailId);

    // Create collection task for backward compatibility
    if (userId && debtorId) {
      const emailContent = (textBody || htmlBody || "").toLowerCase();
      let taskType = "MANUAL_REVIEW";

      if (emailContent.includes("w9") || emailContent.includes("w-9")) {
        taskType = "W9_REQUEST";
      } else if (emailContent.includes("payment plan") || emailContent.includes("installments")) {
        taskType = "PAYMENT_PLAN_REQUEST";
      } else if (emailContent.includes("dispute") || emailContent.includes("wrong amount")) {
        taskType = "DISPUTE_CHARGES";
      } else if (emailContent.includes("call me") || emailContent.includes("phone call")) {
        taskType = "NEEDS_CALLBACK";
      }

      await supabase.from("collection_tasks").insert({
        user_id: userId,
        debtor_id: debtorId,
        invoice_id: invoiceId,
        task_type: taskType,
        priority: "normal",
        status: "open",
        summary: subject || "Email response received",
        details: textBody || htmlBody || "",
        source: "email",
      });
    }

    // Log as collection activity
    if (userId && debtorId) {
      await supabase.from("collection_activities").insert({
        user_id: userId,
        debtor_id: debtorId,
        invoice_id: invoiceId,
        activity_type: "customer_response",
        direction: "inbound",
        channel: "email",
        subject: subject,
        message_body: subject,
        response_message: textBody || htmlBody,
        responded_at: new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        inbound_email_id: inboundEmailId,
        linked: !!(debtorId || invoiceId),
        debtor_id: debtorId,
        invoice_id: invoiceId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[INBOUND] ❌ Error:", error);

    // Try to log error
    if (inboundEmailId) {
      await supabase
        .from("inbound_emails")
        .update({ status: "error", error_message: error.message })
        .eq("id", inboundEmailId);
    }

    return new Response(JSON.stringify({ success: true, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
