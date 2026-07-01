import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const user = userData.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { assessmentId, prompt } = body ?? {};
    if (!assessmentId || !prompt || typeof prompt !== "string" || prompt.length > 4000) {
      return json({ error: "assessmentId and prompt (<=4000 chars) required" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: assessment, error: aerr } = await admin
      .from("ai_assessments")
      .select("id, user_id, scope, subject_type, subject_id, title, summary, findings, model")
      .eq("id", assessmentId)
      .maybeSingle();
    if (aerr || !assessment) return json({ error: "Assessment not found" }, 404);
    if (assessment.user_id !== user.id) return json({ error: "Forbidden" }, 403);

    // Load prior supplemental prompts for continuity
    const { data: history } = await admin
      .from("ai_assessment_prompts")
      .select("prompt, response, created_at")
      .eq("assessment_id", assessmentId)
      .order("created_at", { ascending: true })
      .limit(10);

    // Insert pending row
    const { data: pending, error: perr } = await admin
      .from("ai_assessment_prompts")
      .insert({ assessment_id: assessmentId, user_id: user.id, prompt, status: "pending", model: MODEL })
      .select()
      .single();
    if (perr) return json({ error: perr.message }, 500);

    const systemPrompt = `You are the AI ${assessment.scope.replace(/_/g, " ")} advisor.
The user has an existing assessment titled "${assessment.title}" attached to ${assessment.subject_type} ${assessment.subject_id}.
Answer supplemental questions strictly using the pinned findings, prior supplemental Q&A, and standard best practices for this domain.
Be concise, practical, and cite which finding you're referencing when possible. If information is missing, say what evidence to add.`;

    const priorMsgs = (history ?? []).flatMap((h) => ([
      { role: "user", content: h.prompt },
      { role: "assistant", content: h.response ?? "" },
    ]));

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "system",
        content: `PINNED ASSESSMENT\nSummary: ${assessment.summary ?? "n/a"}\nFindings JSON: ${JSON.stringify(assessment.findings ?? {}).slice(0, 8000)}`,
      },
      ...priorMsgs,
      { role: "user", content: prompt },
    ];

    let reply = "";
    try {
      reply = await callAi(messages);
    } catch (err: any) {
      await admin.from("ai_assessment_prompts")
        .update({ status: "error", error: err.message ?? "AI error" })
        .eq("id", pending.id);
      return json({ error: err.message ?? "AI error" }, 502);
    }

    const { data: updated } = await admin
      .from("ai_assessment_prompts")
      .update({ status: "complete", response: reply })
      .eq("id", pending.id)
      .select()
      .single();

    return json({ prompt: updated });
  } catch (e: any) {
    console.error("[ai-assessment-supplement]", e);
    return json({ error: e?.message ?? "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callAi(messages: Array<{ role: string; content: string }>) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("AI service is not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({ model: MODEL, messages }),
  });
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 429) throw new Error("Rate limit reached. Please retry.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings.");
    throw new Error(`AI service error (${res.status}): ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}
