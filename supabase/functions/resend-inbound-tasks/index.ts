// supabase/functions/resend-inbound-tasks/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Types ------------------------------------------------------------------

interface ResendRecipient {
  email?: string;
  address?: string;
  name?: string;
}

interface ResendAttachment {
  filename: string;
  content: string;
  type: string;
  size?: number;
}

interface ResendEmailData {
  to?: (string | ResendRecipient)[];
  from?: string | ResendRecipient | (string | ResendRecipient)[];
  subject?: string;
  text?: string;
  html?: string;
  raw?: string;
  headers?: Record<string, string>;
  attachments?: ResendAttachment[];
  email_id?: string;
  message_id?: string;
  created_at?: string;
  cc?: (string | ResendRecipient)[];
  bcc?: (string | ResendRecipient)[];
}

interface ResendWebhookPayload {
  type?: string;
  created_at?: string;
  data?: ResendEmailData;
  // Also support direct payload format
  to?: (string | ResendRecipient)[];
  from?: string | ResendRecipient | (string | ResendRecipient)[];
  subject?: string;
  text?: string;
  html?: string;
  raw?: string;
  headers?: Record<string, string>;
  attachments?: ResendAttachment[];
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractEmailAddress(recipient: string | ResendRecipient | undefined): string | null {
  if (!recipient) return null;
  if (typeof recipient === "string") return recipient.toLowerCase();
  return (recipient.address || recipient.email || "").toLowerCase() || null;
}

function extractEmailName(recipient: string | ResendRecipient | undefined): string | null {
  if (!recipient || typeof recipient === "string") return null;
  return recipient.name || null;
}

function getFirstToEmail(toArray: (string | ResendRecipient)[] | undefined): string | null {
  if (!toArray || toArray.length === 0) return null;
  return extractEmailAddress(toArray[0]);
}

function getFromEmail(from: string | ResendRecipient | (string | ResendRecipient)[] | undefined): string | null {
  if (!from) return null;
  if (Array.isArray(from)) return from.length > 0 ? extractEmailAddress(from[0]) : null;
  return extractEmailAddress(from);
}

function getFromName(from: string | ResendRecipient | (string | ResendRecipient)[] | undefined): string | null {
  if (!from) return null;
  if (Array.isArray(from)) return from.length > 0 ? extractEmailName(from[0]) : null;
  return extractEmailName(from);
}

function toEmailArray(arr: (string | ResendRecipient)[] | undefined): string[] {
  if (!arr) return [];
  return arr.map(r => extractEmailAddress(r)).filter(Boolean) as string[];
}

// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let rawPayload: ResendWebhookPayload;

  try {
    rawPayload = await req.json();
  } catch (err) {
    console.error("Failed to parse JSON payload", err);
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("Received webhook payload type:", rawPayload.type || "direct");

  // Handle both wrapped webhook format and direct format
  const emailData: ResendEmailData = rawPayload.data || rawPayload;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase env vars");
    return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const toEmail = getFirstToEmail(emailData.to);
  const fromEmail = getFromEmail(emailData.from);
  const fromName = getFromName(emailData.from);

  if (!toEmail) {
    console.error("No 'to' address in payload", rawPayload);
    return new Response(JSON.stringify({ error: "Missing 'to' address" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("Inbound email from:", fromEmail, "to:", toEmail, "subject:", emailData.subject);

  const [localPart] = toEmail.split("@");
  let invoiceId: string | null = null;
  let debtorId: string | null = null;
  let userId: string | null = null;
  let routedTo: "invoice" | "debtor" | "generic" = "generic";

  // Parse routing from email address
  if (localPart.startsWith("invoice+")) {
    const maybeId = localPart.slice("invoice+".length);
    if (UUID_REGEX.test(maybeId)) {
      invoiceId = maybeId;
      routedTo = "invoice";
      console.log("Routed to invoice:", invoiceId);
    }
  } else if (localPart.startsWith("debtor+")) {
    const maybeId = localPart.slice("debtor+".length);
    if (UUID_REGEX.test(maybeId)) {
      debtorId = maybeId;
      routedTo = "debtor";
      console.log("Routed to debtor:", debtorId);
    }
  }

  // Look up user_id from invoice or debtor
  if (invoiceId) {
    const { data: invoice } = await supabase
      .from("invoices")
      .select("user_id, debtor_id")
      .eq("id", invoiceId)
      .single();
    
    if (invoice) {
      userId = invoice.user_id;
      debtorId = debtorId || invoice.debtor_id;
      console.log("Found user from invoice:", userId);
    }
  } else if (debtorId) {
    const { data: debtor } = await supabase
      .from("debtors")
      .select("user_id")
      .eq("id", debtorId)
      .single();
    
    if (debtor) {
      userId = debtor.user_id;
      console.log("Found user from debtor:", userId);
    }
  }

  if (!userId) {
    console.error("Could not determine user_id for inbound email");
    return new Response(JSON.stringify({ error: "Could not route email to user" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Insert into inbound_emails table
  const { data, error } = await supabase
    .from("inbound_emails")
    .insert([
      {
        user_id: userId,
        event_type: rawPayload.type || "email.received",
        raw_payload: rawPayload,
        from_email: fromEmail || "",
        from_name: fromName,
        to_emails: toEmailArray(emailData.to),
        cc_emails: toEmailArray(emailData.cc),
        bcc_emails: toEmailArray(emailData.bcc),
        subject: emailData.subject || "(No Subject)",
        text_body: emailData.text || null,
        html_body: emailData.html || null,
        message_id: emailData.message_id || `msg-${Date.now()}`,
        email_id: emailData.email_id || null,
        debtor_id: debtorId,
        invoice_id: invoiceId,
        status: "received",
      },
    ])
    .select("id")
    .single();

  if (error) {
    console.error("Error inserting inbound email:", error);
    return new Response(JSON.stringify({ error: "Failed to store email", details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const emailId = data.id as string;
  console.log("Inbound email stored with ID:", emailId);

  // Trigger AI processing
  try {
    const { error: aiError } = await supabase.functions.invoke("process-inbound-ai", {
      body: { email_id: emailId },
    });
    if (aiError) {
      console.warn("AI processing call failed:", aiError);
    } else {
      console.log("AI processing triggered for email:", emailId);
    }
  } catch (err) {
    console.warn("Failed to trigger AI processing:", err);
  }

  return new Response(
    JSON.stringify({
      status: "ok",
      email_id: emailId,
      routed_to: routedTo,
      user_id: userId,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
