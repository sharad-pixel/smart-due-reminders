import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Fetch received emails from Resend's Receiving API
    console.log("[REPLAY] Fetching inbound emails from Resend...");
    const listResponse = await fetch("https://api.resend.com/emails/receiving", {
      headers: { Authorization: `Bearer ${resendApiKey}` },
    });

    if (!listResponse.ok) {
      const errText = await listResponse.text();
      console.error("[REPLAY] Failed to list emails from Resend:", listResponse.status, errText);
      return new Response(JSON.stringify({ error: "Failed to fetch from Resend", status: listResponse.status, details: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailList = await listResponse.json();
    const emails = emailList.data || emailList || [];
    console.log(`[REPLAY] Found ${emails.length} emails in Resend`);

    // Get already-processed email IDs from inbound_emails table
    const { data: existingEmails } = await supabase
      .from("inbound_emails")
      .select("email_id")
      .not("email_id", "is", null);

    const processedIds = new Set((existingEmails || []).map((e: { email_id: string }) => e.email_id));
    console.log(`[REPLAY] Already processed: ${processedIds.size} emails`);

    const unprocessed = emails.filter((e: { id: string }) => !processedIds.has(e.id));
    console.log(`[REPLAY] Unprocessed emails to replay: ${unprocessed.length}`);

    const results: { id: string; status: string; error?: string }[] = [];

    for (const email of unprocessed) {
      try {
        // Fetch full email content
        console.log(`[REPLAY] Fetching email ${email.id}...`);
        const detailResponse = await fetch(`https://api.resend.com/emails/receiving/${email.id}`, {
          headers: { Authorization: `Bearer ${resendApiKey}` },
        });

        if (!detailResponse.ok) {
          const errText = await detailResponse.text();
          console.warn(`[REPLAY] Failed to fetch email ${email.id}:`, detailResponse.status, errText);
          results.push({ id: email.id, status: "fetch_failed", error: errText });
          continue;
        }

        const fullEmail = await detailResponse.json();
        console.log(`[REPLAY] Processing email ${email.id} from ${fullEmail.from} to ${fullEmail.to}, subject: ${fullEmail.subject}`);

        // Forward to resend-inbound-tasks as if it were a webhook event
        const webhookPayload = {
          type: "email.received",
          created_at: fullEmail.created_at || new Date().toISOString(),
          data: {
            email_id: email.id,
            from: fullEmail.from,
            to: Array.isArray(fullEmail.to) ? fullEmail.to : [fullEmail.to],
            cc: fullEmail.cc || [],
            bcc: fullEmail.bcc || [],
            subject: fullEmail.subject,
            text: fullEmail.text || null,
            html: fullEmail.html || null,
            message_id: fullEmail.message_id || null,
            headers: fullEmail.headers || {},
            attachments: fullEmail.attachments || [],
          },
        };

        const { error: invokeError } = await supabase.functions.invoke("resend-inbound-tasks", {
          body: webhookPayload,
        });

        if (invokeError) {
          console.warn(`[REPLAY] Error processing email ${email.id}:`, invokeError);
          results.push({ id: email.id, status: "process_failed", error: String(invokeError) });
        } else {
          console.log(`[REPLAY] Successfully replayed email ${email.id}`);
          results.push({ id: email.id, status: "replayed" });
        }
      } catch (emailErr) {
        console.error(`[REPLAY] Error with email ${email.id}:`, emailErr);
        results.push({ id: email.id, status: "error", error: String(emailErr) });
      }
    }

    const replayed = results.filter(r => r.status === "replayed").length;
    const failed = results.filter(r => r.status !== "replayed").length;

    console.log(`[REPLAY] Done. Replayed: ${replayed}, Failed: ${failed}`);

    return new Response(JSON.stringify({
      total_in_resend: emails.length,
      already_processed: processedIds.size,
      replayed,
      failed,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[REPLAY] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
