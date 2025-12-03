import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ForwardRequest {
  email_ids: string[];
  forward_to: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const { email_ids, forward_to }: ForwardRequest = await req.json();

    if (!email_ids || email_ids.length === 0 || !forward_to) {
      return new Response(
        JSON.stringify({ error: "Missing email_ids or forward_to" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[FORWARD] Forwarding ${email_ids.length} emails to ${forward_to}`);

    // Fetch emails to forward
    const { data: emails, error: fetchError } = await supabase
      .from("inbound_emails")
      .select("*")
      .in("id", email_ids);

    if (fetchError || !emails) {
      throw new Error(`Failed to fetch emails: ${fetchError?.message}`);
    }

    let forwarded = 0;
    let errors = 0;

    for (const email of emails) {
      try {
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Forwarded Email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
  <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
    <p style="margin: 0 0 8px; color: #64748b; font-size: 14px;">
      <strong>Forwarded from Recouply.ai</strong>
    </p>
    <p style="margin: 0 0 4px; color: #334155;">
      <strong>From:</strong> ${email.from_name ? `${email.from_name} <${email.from_email}>` : email.from_email}
    </p>
    <p style="margin: 0 0 4px; color: #334155;">
      <strong>Subject:</strong> ${email.subject}
    </p>
    <p style="margin: 0 0 4px; color: #334155;">
      <strong>Received:</strong> ${new Date(email.created_at).toLocaleString()}
    </p>
    ${email.ai_category ? `<p style="margin: 0 0 4px; color: #334155;"><strong>Category:</strong> ${email.ai_category}</p>` : ""}
    ${email.ai_priority ? `<p style="margin: 0 0 4px; color: #334155;"><strong>Priority:</strong> ${email.ai_priority}</p>` : ""}
    ${email.ai_summary ? `<p style="margin: 12px 0 0; color: #475569; font-style: italic;"><strong>AI Summary:</strong> ${email.ai_summary}</p>` : ""}
  </div>
  
  <div style="border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px;">
    <h3 style="margin: 0 0 16px; color: #1e293b;">Original Message</h3>
    ${email.html_body || `<pre style="white-space: pre-wrap; font-family: inherit;">${email.text_body || "(No content)"}</pre>`}
  </div>
</body>
</html>`;

        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Recouply.ai <notifications@send.inbound.services.recouply.ai>",
            to: [forward_to],
            subject: `[Fwd] ${email.subject}`,
            html: htmlContent,
          }),
        });

        const resendData = await resendResponse.json();

        if (!resendResponse.ok) {
          console.error(`[FORWARD] Failed to forward email ${email.id}:`, resendData);
          errors++;
          continue;
        }

        // Update email record with forwarding info
        const existingForwards = email.forwarded_to || [];
        const newForwards = [...existingForwards, { email: forward_to, at: new Date().toISOString() }];

        await supabase
          .from("inbound_emails")
          .update({
            forwarded_to: newForwards,
            forwarded_at: new Date().toISOString(),
          })
          .eq("id", email.id);

        forwarded++;
        console.log(`[FORWARD] ✅ Forwarded email ${email.id} to ${forward_to}`);
      } catch (err: any) {
        console.error(`[FORWARD] Error forwarding ${email.id}:`, err.message);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, forwarded, errors, total: emails.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[FORWARD] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
