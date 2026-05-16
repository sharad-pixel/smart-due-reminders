import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "openai/gpt-5.5";

const SYSTEM_PROMPT = `You are an ASC 606 (Revenue from Contracts with Customers) compliance advisor.
You answer questions about a SPECIFIC contract that the user has already paid to assess.
Use ONLY the contract context, the latest ASC 606 assessment report, stored guidance history, and standard ASC 606 guidance.
Provide practical guidance, cite the relevant ASC 606 step (1-5) when applicable, and state what evidence/documentation is needed.
If asked something outside ASC 606 or unrelated to this contract, politely redirect.
Never invent contract terms — if information is missing, say so and recommend what to clarify.`;

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

    const { contractId, messages } = await req.json();
    if (!contractId || !Array.isArray(messages)) return json({ error: "Missing contractId or messages" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: assessments } = await admin
      .from("asc606_assessments")
      .select("id, status, risk_score, risk_band, report_jsonb, report_markdown, completed_at, account_id")
      .eq("contract_id", contractId)
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(1);

    const latest = assessments?.[0];
    if (!latest) {
      return json({
        error: "ASC 606 assessment required",
        message: "Purchase and run an ASC 606 assessment for this contract to unlock AI prompts.",
      }, 403);
    }

    const { data: canAccess } = await admin.rpc("is_asc606_admin", { _user_id: user.id, _account_id: latest.account_id });
    if (!canAccess) return json({ error: "Owner or Admin role required" }, 403);

    const contractCtx = await loadContractContext(admin, contractId);
    const { data: priorGuidance } = await admin
      .from("asc606_guidance_messages")
      .select("prompt, guidance, created_at")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false })
      .limit(8);

    const contextBlock = {
      contract: contractCtx,
      latest_assessment: {
        risk_score: latest.risk_score,
        risk_band: latest.risk_band,
        completed_at: latest.completed_at,
        report_jsonb: latest.report_jsonb,
        report_markdown: latest.report_markdown,
      },
      stored_guidance_history: priorGuidance ?? [],
    };

    const chatMsgs = messages
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-20)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

    if (chatMsgs.length === 0) return json({ error: "No messages provided" }, 400);

    const reply = await callAi([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `Contract, assessment, and guidance context:\n${JSON.stringify(contextBlock, null, 2)}` },
      ...chatMsgs,
    ]);

    const lastUser = [...chatMsgs].reverse().find((m) => m.role === "user");
    if (lastUser) {
      await admin.from("asc606_guidance_messages").insert({
        account_id: latest.account_id,
        contract_id: contractId,
        assessment_id: latest.id,
        prompt: lastUser.content,
        guidance: reply,
        guidance_jsonb: { source: "chat", messages: chatMsgs.slice(-6) },
        model_version: MODEL,
        created_by: user.id,
      });
    }

    return json({ reply, stored: true });
  } catch (e: any) {
    console.error("[asc606-contract-chat]", e);
    return json({ error: e?.message ?? "Unexpected error" }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callAi(messages: Array<{ role: string; content: string }>) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("AI service is not configured");
  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({ model: MODEL, messages }),
  });
  if (!aiRes.ok) {
    const txt = await aiRes.text();
    throw new Error(aiRes.status === 429
      ? "Rate limit reached. Please retry in a moment."
      : aiRes.status === 402
      ? "AI credits exhausted. Add credits in Settings → Workspace → Usage."
      : `AI service error (${aiRes.status}): ${txt.slice(0, 400)}`);
  }
  const json = await aiRes.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

async function loadContractContext(admin: any, contractId: string) {
  const { data: formal } = await admin
    .from("contracts")
    .select("id, title, contract_type, counterparty_name, currency, contract_value, effective_date, expiry_date, renewal_date, ai_extracted_terms, ai_summary, contract_invoice_schedules(*), contract_critical_dates(*)")
    .eq("id", contractId)
    .maybeSingle();
  if (formal) return formal;

  const { data: imp } = await admin
    .from("live_contract_imports")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();
  const { data: fields } = await admin
    .from("live_contract_extracted_fields")
    .select("*")
    .eq("import_id", contractId);
  const { data: schedules } = await admin
    .from("contract_invoice_schedules")
    .select("*")
    .eq("import_id", contractId);
  const { data: dates } = await admin
    .from("contract_critical_dates")
    .select("*")
    .eq("import_id", contractId);
  return {
    id: imp?.id,
    title: imp?.contract_name || imp?.file_name,
    account_id: imp?.account_id,
    contract_type: imp?.contract_type,
    contract_value: imp?.contract_value,
    effective_date: imp?.effective_date,
    expiry_date: imp?.term_end_date,
    financial_metrics: imp?.metrics_jsonb,
    extracted_fields: fields,
    contract_invoice_schedules: schedules,
    contract_critical_dates: dates,
  };
}