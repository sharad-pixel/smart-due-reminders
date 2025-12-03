// supabase/functions/resend-inbound-tasks/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Types ------------------------------------------------------------------

// Some Resend payloads use `email`, some use `address` – support both.
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

interface ResendPayload {
  to?: ResendRecipient[];
  from?: ResendRecipient[];
  subject?: string;
  text?: string;
  html?: string;
  raw?: string;
  headers?: Record<string, string>;
  attachments?: ResendAttachment[];
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper to get email/address from recipient
function recipientAddress(recipient?: ResendRecipient): string | null {
  if (!recipient) return null;
  return (recipient.address || recipient.email || "").toLowerCase() || null;
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

  let payload: ResendPayload;

  try {
    payload = await req.json();
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

  const to = payload.to && payload.to[0] ? payload.to[0] : undefined;
  const from = payload.from && payload.from[0] ? payload.from[0] : undefined;

  const toEmail = recipientAddress(to);
  const fromEmail = recipientAddress(from);

  if (!toEmail) {
    console.error("No 'to' address in payload", payload);
    return new Response(JSON.stringify({ error: "Missing 'to' address" }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  console.log("Inbound email to:", toEmail);

  const [localPart] = toEmail.split("@");
  let invoiceId: string | null = null;
  let debtorId: string | null = null;
  let routedTo: "invoice" | "debtor" | "generic" = "generic";

  if (localPart.startsWith("invoice+")) {
    const maybeId = localPart.slice("invoice+".length);
    if (UUID_REGEX.test(maybeId)) {
      invoiceId = maybeId;
      routedTo = "invoice";
    } else {
      console.warn("Invalid invoice UUID in address:", maybeId);
    }
  } else if (localPart.startsWith("debtor+")) {
    const maybeId = localPart.slice("debtor+".length);
    if (UUID_REGEX.test(maybeId)) {
      debtorId = maybeId;
      routedTo = "debtor";
    } else {
      console.warn("Invalid debtor UUID in address:", maybeId);
    }
  }

  const attachments = payload.attachments ?? [];

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
        subject: payload.subject ?? null,
        html_body: payload.html ?? null,
        text_body: payload.text ?? null,
        raw_body: payload.raw ?? null,
        attachments,
      },
    ])
    .select("id")
    .single();

  if (error) {
    console.error("Error inserting message:", error);
    return new Response(JSON.stringify({ error: "Failed to store message" }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const messageId = data.id as string;

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
    console.warn("INTERNAL_API_BASE_URL not set – skipping AI processing call");
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
