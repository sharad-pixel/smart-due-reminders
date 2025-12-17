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

// Retry configuration for transient failures
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 500;

// Sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Exponential backoff retry wrapper
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  retries = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Don't retry client errors (4xx) except 429 (rate limit)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }
      
      // Retry on rate limit (429) or server errors (5xx)
      if (response.status === 429 || response.status >= 500) {
        if (attempt < retries) {
          const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
          console.log(`Resend API returned ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries + 1})`);
          await sleep(delay);
          continue;
        }
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < retries) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
        console.log(`Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${retries + 1}):`, error);
        await sleep(delay);
      }
    }
  }
  
  throw lastError || new Error("Max retries exceeded");
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

  // Normalize `to` to array and filter valid emails
  const toAddresses = (Array.isArray(payload.to) ? payload.to : [payload.to])
    .filter(email => email && email.includes("@"));

  if (toAddresses.length === 0) {
    return new Response(
      JSON.stringify({ error: "No valid email addresses provided" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

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

  const startTime = Date.now();

  try {
    const resendResponse = await fetchWithRetry("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    const resendData = await resendResponse.json();
    const duration = Date.now() - startTime;

    if (!resendResponse.ok) {
      console.error("Resend API error", { status: resendResponse.status, data: resendData, duration });
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: resendData }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Email sent successfully", { messageId: resendData.id, duration });

    return new Response(
      JSON.stringify({
        status: "sent",
        message_id: resendData.id,
        duration_ms: duration,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error("Error calling Resend API", { error: err, duration });
    return new Response(
      JSON.stringify({ error: "Failed to send email after retries" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
