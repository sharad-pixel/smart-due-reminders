import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailAttachment {
  filename: string;
  content: string; // base64
  type: string;    // mime type
}

interface SendEmailRequest {
  to: string | string[];
  from: string;
  reply_to?: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("RESEND_API_KEY is not configured");
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  let payload: SendEmailRequest;

  try {
    payload = await req.json();
  } catch (err) {
    console.error("Failed to parse JSON payload", err);
    return new Response(
      JSON.stringify({ error: "Invalid JSON payload" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Validate required fields
  if (!payload.to || !payload.from || !payload.subject) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: to, from, subject" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Normalize `to` to array
  const toAddresses = Array.isArray(payload.to) ? payload.to : [payload.to];

  // Build Resend API payload
  const resendPayload: Record<string, unknown> = {
    from: payload.from,
    to: toAddresses,
    subject: payload.subject,
  };

  if (payload.html) {
    resendPayload.html = payload.html;
  }

  if (payload.text) {
    resendPayload.text = payload.text;
  }

  if (payload.reply_to) {
    resendPayload.reply_to = payload.reply_to;
  }

  if (payload.attachments && payload.attachments.length > 0) {
    resendPayload.attachments = payload.attachments.map((att) => ({
      filename: att.filename,
      content: att.content,
      content_type: att.type,
    }));
  }

  console.log("Sending email via Resend", {
    to: toAddresses,
    from: payload.from,
    subject: payload.subject,
    hasHtml: !!payload.html,
    hasText: !!payload.text,
    attachmentCount: payload.attachments?.length ?? 0,
  });

  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API error", resendData);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: resendData }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Email sent successfully", { messageId: resendData.id });

    return new Response(
      JSON.stringify({
        status: "sent",
        message_id: resendData.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error calling Resend API", err);
    return new Response(
      JSON.stringify({ error: "Failed to send email" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
