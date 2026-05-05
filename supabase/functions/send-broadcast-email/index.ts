import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { wrapMarketingEmailHtml, wrapMarketingEmailText, hydrateMarketingTokens } from "../_shared/marketingEmailWrapper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BroadcastRequest {
  broadcast_id?: string;
  template_key?: string;
  subject?: string;
  body_html?: string;
  body_text?: string;
  audience?: "all_active" | "paid_only" | "free_only" | "specific_emails" | "all_leads";
  specific_emails?: string[];
  test_mode?: boolean;
  test_email?: string;
  // New: resume mode (called by cron or "resend failed" button). When true,
  // skips materialization and just drains pending recipients for broadcast_id.
  resume?: boolean;
  // New: when true, flip all 'failed' rows back to 'pending' before draining.
  retry_failed?: boolean;
  // Internal: bypass admin auth check (used by cron worker with service role).
  internal_invoke?: boolean;
}

const PLATFORM_FROM_EMAIL = "Recouply.ai <notifications@send.inbound.services.recouply.ai>";

// Per-invocation budgets — kept under edge function rate limit (~120 invokes/min)
const PER_INVOCATION_MAX = 200;        // max recipients drained per call
const BATCH_SIZE = 4;                   // concurrent sends per batch
const INTER_BATCH_DELAY_MS = 1100;      // ~218 emails/min sustained

function formatBodyAsHtml(body: string): string {
  if (!body) return "";
  if (/<[a-z][\s\S]*>/i.test(body)) return body;
  const paragraphs = body.split(/\n\n+/);
  return paragraphs
    .map(p => {
      const lines = p.trim().split(/\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return "";
      return `<p style="margin:0 0 16px 0;line-height:1.6;">${lines.join("<br>")}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: BroadcastRequest = await req.json();
    const {
      broadcast_id,
      template_key,
      subject,
      body_html,
      body_text,
      audience = "all_active",
      specific_emails,
      test_mode = false,
      test_email,
      resume = false,
      retry_failed = false,
      internal_invoke = false,
    } = payload;

    // Auth: admin OR internal service-role invocation
    let actingUser: { id: string; email?: string | null } | null = null;
    if (!internal_invoke) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Authorization required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Authentication failed" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
      if (!profile?.is_admin) {
        return new Response(JSON.stringify({ error: "Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      actingUser = { id: user.id, email: user.email };
    }

    // ---- Resolve email content (subject / body) ----
    let emailSubject = subject;
    let emailHtml = body_html;
    let emailText = body_text;

    if (!resume && !retry_failed && template_key) {
      const { data: template, error: templateError } = await supabase
        .from("email_templates")
        .select("*")
        .eq("template_key", template_key)
        .eq("is_active", true)
        .single();
      if (templateError || !template) {
        return new Response(JSON.stringify({ error: `Template '${template_key}' not found` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      emailSubject = emailSubject || template.subject_template;
      emailHtml = emailHtml || template.body_html;
      emailText = emailText || template.body_text;
    }

    // For resume/retry_failed we always need to load the broadcast content
    if ((resume || retry_failed) && broadcast_id) {
      const { data: bc } = await supabase
        .from("email_broadcasts")
        .select("subject, body_html, body_text")
        .eq("id", broadcast_id)
        .single();
      if (bc) {
        emailSubject = emailSubject || bc.subject;
        emailHtml = emailHtml || bc.body_html;
        emailText = emailText || bc.body_text;
      }
    }

    // ---- Test mode (single send, unchanged behavior) ----
    if (test_mode) {
      if (!emailSubject || !emailHtml) {
        return new Response(JSON.stringify({ error: "Subject and body_html are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const targetEmail = test_email || actingUser?.email;
      const unsubscribeUrl = `${supabaseUrl}/functions/v1/handle-unsubscribe?email=${encodeURIComponent(targetEmail!)}`;
      const formattedBody = formatBodyAsHtml(emailHtml);
      const html = wrapMarketingEmailHtml({ subject: `[TEST] ${emailSubject}`, bodyHtml: formattedBody, unsubscribeUrl });
      const text = wrapMarketingEmailText({ bodyText: emailText || emailHtml, unsubscribeUrl });
      const { error: sendError } = await supabase.functions.invoke("send-email", {
        body: { to: targetEmail, from: PLATFORM_FROM_EMAIL, subject: `[TEST] ${emailSubject}`, html, text },
      });
      if (sendError) {
        return new Response(JSON.stringify({ error: "Failed to send test email" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: true, message: `Test email sent to ${targetEmail}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!broadcast_id) {
      return new Response(JSON.stringify({ error: "broadcast_id is required for non-test sends" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!emailSubject || !emailHtml) {
      return new Response(JSON.stringify({ error: "Subject and body_html are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- Materialize recipients on first run (idempotent via UNIQUE constraint) ----
    if (!resume && !retry_failed) {
      const { data: unsubscribed } = await supabase.from("email_unsubscribes").select("email");
      const unsubscribedEmails = new Set((unsubscribed || []).map((u: any) => u.email.toLowerCase()));

      let recipients: { email: string; name: string | null; company: string | null; unsubscribe_token: string | null }[] = [];

      if (audience === "specific_emails" && specific_emails?.length) {
        const lower = specific_emails.map(e => e.toLowerCase());
        const { data: matched } = await supabase
          .from("marketing_leads")
          .select("email, name, company, unsubscribe_token")
          .in("email", lower);
        const byEmail = new Map((matched || []).map((l: any) => [l.email.toLowerCase(), l]));
        recipients = specific_emails
          .filter(e => !unsubscribedEmails.has(e.toLowerCase()))
          .map(email => {
            const l = byEmail.get(email.toLowerCase()) as any;
            return { email, name: l?.name ?? null, company: l?.company ?? null, unsubscribe_token: l?.unsubscribe_token ?? null };
          });
      } else if (audience === "all_leads") {
        const { data: leads } = await supabase
          .from("marketing_leads")
          .select("email, name, company, unsubscribe_token")
          .eq("status", "active");
        recipients = (leads || [])
          .filter((l: any) => l.email && !unsubscribedEmails.has(l.email.toLowerCase()))
          .map((l: any) => ({ email: l.email, name: l.name, company: l.company, unsubscribe_token: l.unsubscribe_token }));
      } else {
        let query = supabase.from("profiles")
          .select("email, name, plan_type, subscription_status")
          .eq("is_suspended", false)
          .not("email", "is", null);
        if (audience === "paid_only") query = query.in("subscription_status", ["active", "trialing"]);
        else if (audience === "free_only") query = query.or("subscription_status.is.null,plan_type.eq.free");
        const { data: profiles } = await query;
        recipients = (profiles || [])
          .filter((p: any) => p.email && !unsubscribedEmails.has(p.email.toLowerCase()))
          .map((p: any) => ({ email: p.email, name: p.name, company: null, unsubscribe_token: null }));
      }

      // Dedupe by email within this batch
      const seen = new Set<string>();
      const deduped = recipients.filter(r => {
        const k = r.email.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      console.log(`Materializing ${deduped.length} recipients for broadcast ${broadcast_id}`);

      // Insert in chunks; UNIQUE(broadcast_id,email) prevents duplicates on re-runs
      const chunkSize = 500;
      for (let i = 0; i < deduped.length; i += chunkSize) {
        const chunk = deduped.slice(i, i + chunkSize).map(r => ({
          broadcast_id,
          email: r.email,
          name: r.name,
          company: r.company,
          unsubscribe_token: r.unsubscribe_token,
          status: "pending",
        }));
        const { error: insErr } = await supabase
          .from("broadcast_recipients")
          .upsert(chunk, { onConflict: "broadcast_id,email", ignoreDuplicates: true });
        if (insErr) console.error("Recipient insert error:", insErr);
      }

      await supabase.from("email_broadcasts").update({
        status: "sending",
        total_recipients: deduped.length,
      }).eq("id", broadcast_id);
    }

    // ---- Optional: reset failed → pending ----
    if (retry_failed) {
      await supabase.from("broadcast_recipients")
        .update({ status: "pending", last_error: null })
        .eq("broadcast_id", broadcast_id)
        .eq("status", "failed");
      await supabase.from("email_broadcasts").update({ status: "sending" }).eq("id", broadcast_id);
    }

    // ---- Drain pending recipients (bounded) ----
    const { data: pendingBatch } = await supabase
      .from("broadcast_recipients")
      .select("id, email, name, company, unsubscribe_token, attempts")
      .eq("broadcast_id", broadcast_id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(PER_INVOCATION_MAX);

    // Mid-broadcast unsubscribe check: skip and mark any recipients that
    // have unsubscribed since the broadcast was materialized.
    let toSend = pendingBatch || [];
    if (toSend.length > 0) {
      const { data: unsubs } = await supabase
        .from("email_unsubscribes")
        .select("email")
        .in("email", toSend.map((r: any) => r.email.toLowerCase()));
      const blocked = new Set((unsubs || []).map((u: any) => String(u.email).toLowerCase()));
      if (blocked.size > 0) {
        const blockedIds = toSend.filter((r: any) => blocked.has(r.email.toLowerCase())).map((r: any) => r.id);
        if (blockedIds.length > 0) {
          await supabase.from("broadcast_recipients")
            .update({ status: "skipped", last_error: "unsubscribed" })
            .in("id", blockedIds);
        }
        toSend = toSend.filter((r: any) => !blocked.has(r.email.toLowerCase()));
      }
    }
    let sentThisRun = 0;
    let failedThisRun = 0;

    const sendOne = async (r: any): Promise<"sent" | "failed" | "retry"> => {
      const vars = { name: r.name, company: r.company };
      const personalizedSubject = hydrateMarketingTokens(emailSubject!, vars);
      const rawBody = hydrateMarketingTokens(emailHtml!, vars);
      const rawText = hydrateMarketingTokens(emailText || emailHtml || "", vars);
      const unsubscribeUrl = r.unsubscribe_token
        ? `${supabaseUrl}/functions/v1/handle-unsubscribe?token=${r.unsubscribe_token}`
        : `${supabaseUrl}/functions/v1/handle-unsubscribe?email=${encodeURIComponent(r.email)}`;
      const html = wrapMarketingEmailHtml({ subject: personalizedSubject, bodyHtml: formatBodyAsHtml(rawBody), unsubscribeUrl });
      const text = wrapMarketingEmailText({ bodyText: rawText, unsubscribeUrl });

      try {
        const { error: sendError } = await supabase.functions.invoke("send-email", {
          body: { to: r.email, from: PLATFORM_FROM_EMAIL, subject: personalizedSubject, html, text, marketing: true },
        });
        if (!sendError) {
          await supabase.from("broadcast_recipients").update({
            status: "sent", sent_at: new Date().toISOString(), attempts: (r.attempts || 0) + 1, last_error: null,
          }).eq("id", r.id);
          return "sent";
        }
        const ctx: any = (sendError as any)?.context;
        const isRateLimit = ctx?.name === "RateLimitError" || /rate limit/i.test(String(sendError?.message || ""));
        if (isRateLimit) {
          // Leave as pending so the next cron tick retries it; don't increment attempts harshly
          await supabase.from("broadcast_recipients").update({
            attempts: (r.attempts || 0) + 1,
            last_error: `Rate limited (will retry)`,
          }).eq("id", r.id);
          return "retry";
        }
        await supabase.from("broadcast_recipients").update({
          status: "failed",
          attempts: (r.attempts || 0) + 1,
          last_error: String(sendError?.message || sendError),
        }).eq("id", r.id);
        return "failed";
      } catch (err: any) {
        await supabase.from("broadcast_recipients").update({
          status: "failed", attempts: (r.attempts || 0) + 1, last_error: String(err?.message || err),
        }).eq("id", r.id);
        return "failed";
      }
    };

    for (let i = 0; i < toSend.length; i += BATCH_SIZE) {
      const batch = toSend.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(sendOne));
      for (const r of results) {
        if (r === "sent") sentThisRun++;
        else if (r === "failed") failedThisRun++;
      }
      // If anything got rate-limited in this batch, back off harder
      const hadRateLimit = results.includes("retry");
      if (i + BATCH_SIZE < toSend.length) {
        await new Promise(res => setTimeout(res, hadRateLimit ? 5000 : INTER_BATCH_DELAY_MS));
      }
    }

    // ---- Recompute totals from broadcast_recipients ----
    const [{ count: sentTotal }, { count: failedTotal }, { count: pendingRemaining }, { count: total }] = await Promise.all([
      supabase.from("broadcast_recipients").select("*", { count: "exact", head: true }).eq("broadcast_id", broadcast_id).eq("status", "sent"),
      supabase.from("broadcast_recipients").select("*", { count: "exact", head: true }).eq("broadcast_id", broadcast_id).eq("status", "failed"),
      supabase.from("broadcast_recipients").select("*", { count: "exact", head: true }).eq("broadcast_id", broadcast_id).eq("status", "pending"),
      supabase.from("broadcast_recipients").select("*", { count: "exact", head: true }).eq("broadcast_id", broadcast_id),
    ]);

    const isComplete = (pendingRemaining ?? 0) === 0;
    await supabase.from("email_broadcasts").update({
      status: isComplete ? "completed" : "sending",
      sent_count: sentTotal ?? 0,
      failed_count: failedTotal ?? 0,
      total_recipients: total ?? 0,
      sent_at: isComplete ? new Date().toISOString() : null,
    }).eq("id", broadcast_id);

    console.log(`Broadcast ${broadcast_id}: +${sentThisRun} sent, +${failedThisRun} failed this run. Pending remaining: ${pendingRemaining ?? 0}`);

    return new Response(JSON.stringify({
      success: true,
      sent_this_run: sentThisRun,
      failed_this_run: failedThisRun,
      pending_remaining: pendingRemaining ?? 0,
      sent_total: sentTotal ?? 0,
      failed_total: failedTotal ?? 0,
      total_recipients: total ?? 0,
      complete: isComplete,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    console.error("Broadcast error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
