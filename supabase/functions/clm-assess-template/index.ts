import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_AI_CHARS = 18000;
const MODEL = "openai/gpt-5-mini";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let template_id: string | undefined;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    template_id = body.template_id;
    if (!template_id) return json({ error: "template_id required" }, 400);

    const { data: tmpl, error: tErr } = await supabase
      .from("clm_templates")
      .select("id, raw_text, name")
      .eq("id", template_id)
      .single();
    if (tErr || !tmpl) return json({ error: "Template not found" }, 404);

    const rawText = (tmpl.raw_text ?? "").trim();
    if (!rawText) {
      await supabase.from("clm_templates").update({
        assessment_status: "failed",
        assessment_error: "No extracted text available — sectionalize the template first.",
      }).eq("id", template_id);
      return json({ error: "no text" }, 400);
    }

    await supabase.from("clm_templates").update({
      assessment_status: "running", assessment_error: null,
    }).eq("id", template_id);

    // Smart trim
    let aiInput = rawText;
    if (rawText.length > MAX_AI_CHARS) {
      const head = rawText.slice(0, Math.floor(MAX_AI_CHARS * 0.7));
      const tail = rawText.slice(-Math.floor(MAX_AI_CHARS * 0.3));
      aiInput = `${head}\n\n[... middle truncated ...]\n\n${tail}`;
    }

    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!aiKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: `You are a senior commercial contracts attorney. Assess the provided contract for negotiation risk and operational viability. Return JSON only with this exact shape:
{
  "overall_risk": "low" | "medium" | "high",
  "risk_score": 0-100,
  "executive_summary": "2-3 sentence plain-English summary aimed at a non-lawyer founder/CFO.",
  "key_risks": [
    { "title": "Short risk title", "severity": "low" | "medium" | "high", "clause": "Section or clause name (e.g. 'Limitation of Liability')", "explanation": "1-2 sentences explaining why this is risky." }
  ],
  "recommendations": [
    { "title": "Short recommendation", "priority": "low" | "medium" | "high", "rationale": "1-2 sentences explaining the suggested change." }
  ],
  "missing_clauses": ["Standard clauses that appear absent (e.g. 'Force Majeure')"],
  "favorability": "favors_us" | "favors_counterparty" | "balanced"
}
Be specific and reference actual clause language when possible. Limit to the 5-8 most important risks and 3-5 highest-impact recommendations.`,
          },
          { role: "user", content: `Contract: ${tmpl.name}\n\n${aiInput}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      const msg = aiResp.status === 429
        ? "AI rate limit — please retry"
        : aiResp.status === 402
          ? "AI credits exhausted — add credits in Settings"
          : `AI error ${aiResp.status}`;
      await supabase.from("clm_templates").update({
        assessment_status: "failed", assessment_error: msg,
      }).eq("id", template_id);
      return json({ error: msg, details: txt.slice(0, 500) }, 502);
    }

    const aiJson = await aiResp.json();
    const content = aiJson.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(content); } catch {
      await supabase.from("clm_templates").update({
        assessment_status: "failed", assessment_error: "AI returned non-JSON",
      }).eq("id", template_id);
      return json({ error: "bad_ai_json" }, 502);
    }

    await supabase.from("clm_templates").update({
      assessment: parsed,
      assessment_status: "ready",
      assessment_error: null,
      assessed_at: new Date().toISOString(),
      assessment_model: MODEL,
    }).eq("id", template_id);

    return json({ success: true });
  } catch (e: any) {
    console.error("clm-assess-template error", e);
    if (template_id) {
      await supabase.from("clm_templates").update({
        assessment_status: "failed",
        assessment_error: (e?.message ?? "Unknown error").slice(0, 500),
      }).eq("id", template_id);
    }
    return json({ error: e?.message ?? "unknown" }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
