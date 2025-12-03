// supabase/functions/resend-inbound-tasks/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Types ------------------------------------------------------------------

// Resend can send recipients as strings or objects
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
}

// Resend webhook wraps data in a `data` field with `type`
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

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper to extract email address from various formats
function extractEmailAddress(recipient: string | ResendRecipient | undefined): string | null {
  if (!recipient) return null;
  
  if (typeof recipient === "string") {
    return recipient.toLowerCase();
  }
  
  return (recipient.address || recipient.email || "").toLowerCase() || null;
}

// Helper to get first email from to array (handles both string[] and object[])
function getFirstToEmail(toArray: (string | ResendRecipient)[] | undefined): string | null {
  if (!toArray || toArray.length === 0) return null;
  return extractEmailAddress(toArray[0]);
}

// Helper to get from email (handles string, object, or array)
function getFromEmail(from: string | ResendRecipient | (string | ResendRecipient)[] | undefined): string | null {
  if (!from) return null;
  
  if (Array.isArray(from)) {
    return from.length > 0 ? extractEmailAddress(from[0]) : null;
  }
  
  return extractEmailAddress(from);
}

// ---------------------------------------------------------------------------

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  let rawPayload: ResendWebhookPayload;

  try {
    rawPayload = await req.json();
  } catch (err) {
    console.error("Failed to parse JSON payload", err);
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  console.log("Received webhook payload type:", rawPayload.type || "direct");

  // Handle both wrapped webhook format and direct format
  // Resend webhooks come as { type: "email.received", data: { ... } }
  const emailData: ResendEmailData = rawPayload.data || rawPayload;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase env vars");
    return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const toEmail = getFirstToEmail(emailData.to);
  const fromEmail = getFromEmail(emailData.from);

  if (!toEmail) {
    console.error("No 'to' address in payload", rawPayload);
    return new Response(JSON.stringify({ error: "Missing 'to' address" }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  console.log("Inbound email from:", fromEmail, "to:", toEmail, "subject:", emailData.subject);

  const [localPart] = toEmail.split("@");
  let invoiceId: string | null = null;
  let debtorId: string | null = null;
  let routedTo: "invoice" | "debtor" | "generic" = "generic";

  if (localPart.startsWith("invoice+")) {
    const maybeId = localPart.slice("invoice+".length);
    if (UUID_REGEX.test(maybeId)) {
      invoiceId = maybeId;
      routedTo = "invoice";
      console.log("Routed to invoice:", invoiceId);
    } else {
      console.warn("Invalid invoice UUID in address:", maybeId);
    }
  } else if (localPart.startsWith("debtor+")) {
    const maybeId = localPart.slice("debtor+".length);
    if (UUID_REGEX.test(maybeId)) {
      debtorId = maybeId;
      routedTo = "debtor";
      console.log("Routed to debtor:", debtorId);
    } else {
      console.warn("Invalid debtor UUID in address:", maybeId);
    }
  }

  const attachments = emailData.attachments ?? [];

  const { data, error } = await supabase
    .from("messages")
    .insert([
      {
        type: "inbound",
        invoice_id: invoiceId,
        debtor_id: debtorId,
        user_id: null, // external sender, not an authenticated user
        from_email: fromEmail || "",
        to_email: toEmail,
        subject: emailData.subject ?? null,
        html_body: emailData.html ?? null,
        text_body: emailData.text ?? null,
        raw_body: emailData.raw ?? null,
        attachments,
      },
    ])
    .select("id")
    .single();

  if (error) {
    console.error("Error inserting message:", error);
    return new Response(JSON.stringify({ error: "Failed to store message", details: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const messageId = data.id as string;
  console.log("Message stored with ID:", messageId);

  // Fire-and-forget AI processing
  const aiBase = Deno.env.get("INTERNAL_API_BASE_URL") || "";
  if (aiBase) {
    const aiUrl = `${aiBase.replace(/\/$/, "")}/internal/ai/process-message`;
    try {
      await fetch(aiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId }),
      });
    } catch (err) {
      console.error("Failed to call AI processor:", err);
      // Don't fail the webhook because of downstream processing
    }
  } else {
    console.log("INTERNAL_API_BASE_URL not set – skipping AI processing call");
  }

  return new Response(
    JSON.stringify({
      status: "ok",
      message_id: messageId,
      routed_to: routedTo,
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
});
