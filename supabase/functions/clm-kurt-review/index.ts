import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KURT_SYSTEM = `You are Kurt, a senior General Counsel AI advising on a SaaS company's contract amendments.
Be concise, plain-English, and pragmatic. Focus on:
- material risk (liability, indemnity, IP, term, exclusivity, payment, data)
- clarity & enforceability
- deviations from the prior version
- missing standard protections
You only RECOMMEND. Humans decide. Never claim to provide binding legal advice.`;

async function callKurt(payload: any) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: KURT_SYSTEM },
        {
          role: "user",
          content: `Review this proposed contract amendment.

Section: ${payload.section_title || payload.section_key}
Editor: ${payload.edited_by_name || "unknown"}
Editor's note: ${payload.change_summary || "(none)"}

PREVIOUS VERSION:
"""
${payload.previous_body || "(empty)"}
"""

PROPOSED VERSION:
"""
${payload.new_body || "(empty)"}
"""

Return JSON ONLY matching this schema:
{
  "recommendation": "approve" | "request_changes" | "reject",
  "confidence": number 0..1,
  "summary": string (2-3 sentences plain English),
  "key_changes": string[] (bullet list of what materially changed),
  "risks": string[] (risks/concerns; empty if none),
  "suggested_edits": string[] (concrete redline suggestions; empty if approve)
}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) throw new Error(`Gateway ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(raw);
}

async function processRevision(admin: any, revisionId: string) {
  const { data: rev } = await admin
    .from("clm_section_revisions")
    .select("*")
    .eq("id", revisionId)
    .maybeSingle();
  if (!rev) return { skipped: "missing revision" };

  // Skip if already reviewed
  const { data: existing } = await admin
    .from("clm_kurt_recommendations")
    .select("id")
    .eq("revision_id", revisionId)
    .maybeSingle();
  if (existing) return { skipped: "already reviewed" };

  const result = await callKurt(rev);
  const recommendation =
    ["approve", "request_changes", "reject"].includes(result.recommendation)
      ? result.recommendation
      : "request_changes";

  await admin.from("clm_kurt_recommendations").insert({
    revision_id: revisionId,
    instance_id: rev.instance_id,
    recommendation,
    confidence: Number(result.confidence) || 0.5,
    summary: String(result.summary || "").slice(0, 2000),
    key_changes: Array.isArray(result.key_changes) ? result.key_changes : [],
    risks: Array.isArray(result.risks) ? result.risks : [],
    suggested_edits: Array.isArray(result.suggested_edits) ? result.suggested_edits : [],
    model: "google/gemini-2.5-flash",
  });

  // Optional audit trail
  try {
    await admin.from("audit_logs").insert({
      action_type: "clm_kurt_recommendation",
      entity_type: "clm_section_revision",
      entity_id: revisionId,
      metadata: { recommendation, confidence: result.confidence },
    });
  } catch {
    // audit_logs schema may differ; ignore
  }

  return { recommendation };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    let revisionId: string | null = null;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      revisionId = body.revisionId || body.revision_id || null;
    }

    if (revisionId) {
      const out = await processRevision(admin, revisionId);
      return new Response(JSON.stringify({ success: true, ...out }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Drain queue
    const { data: queue } = await admin
      .from("clm_notification_queue")
      .select("*")
      .eq("status", "pending")
      .eq("kind", "kurt_review")
      .order("created_at", { ascending: true })
      .limit(15);

    let processed = 0;
    for (const job of queue ?? []) {
      try {
        await processRevision(admin, job.revision_id);
        await admin.from("clm_notification_queue").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts: (job.attempts ?? 0) + 1,
        }).eq("id", job.id);
        processed++;
      } catch (e: any) {
        await admin.from("clm_notification_queue").update({
          status: (job.attempts ?? 0) + 1 >= 3 ? "failed" : "pending",
          attempts: (job.attempts ?? 0) + 1,
          last_error: String(e?.message ?? e).slice(0, 500),
        }).eq("id", job.id);
      }
    }

    return new Response(JSON.stringify({ success: true, processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[clm-kurt-review]", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
