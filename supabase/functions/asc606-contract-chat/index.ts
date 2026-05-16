import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `You are an ASC 606 (Revenue from Contracts with Customers) compliance advisor.
You answer questions about a SPECIFIC contract that the user has already paid to assess.
Use ONLY the contract context, the latest ASC 606 assessment report, and standard ASC 606 guidance.
Be concise, practical, and cite the relevant ASC 606 step (1-5) when applicable.
If asked something outside ASC 606 or unrelated to this contract, politely redirect.
Never invent contract terms — if information is missing, say so and recommend what to clarify.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const user = userData.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { contractId, messages } = await req.json();
    if (!contractId || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Missing contractId or messages" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Gate: require at least one completed assessment for this contract
    const { data: assessments } = await admin
      .from("asc606_assessments")
      .select("id, status, risk_score, risk_band, report_jsonb, report_markdown, completed_at, payment_method, account_id")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false })
      .limit(1);

    const latest = assessments?.[0];
    if (!latest || latest.status !== "complete") {
      return new Response(JSON.stringify({
        error: "ASC 606 assessment required",
        message: "Purchase and run an ASC 606 assessment for this contract to unlock AI prompts.",
      }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull contract context (try formal contracts first, fallback to live imports)
    let contractCtx: any = null;
    const { data: formal } = await admin
      .from("contracts")
      .select("id, title, contract_type, counterparty_name, currency, contract_value, effective_date, expiry_date, renewal_date, ai_extracted_terms, ai_summary, contract_invoice_schedules(*), contract_critical_dates(*)")
      .eq("id", contractId)
      .maybeSingle();
    if (formal) {
      contractCtx = formal;
    } else {
      const { data: imp } = await admin
        .from("live_contract_imports")
        .select("id, contract_name, file_name, account_id")
        .eq("id", contractId)
        .maybeSingle();
      const { data: fields } = await admin
        .from("live_contract_extracted_fields")
        .select("*")
        .eq("contract_import_id", contractId);
      const { data: schedules } = await admin
        .from("contract_invoice_schedules")
        .select("*")
        .eq("contract_id", contractId);
      const { data: dates } = await admin
        .from("contract_critical_dates")
        .select("*")
        .eq("contract_id", contractId);
      contractCtx = {
        id: imp?.id,
        title: imp?.contract_name || imp?.file_name,
        extracted_fields: fields,
        contract_invoice_schedules: schedules,
        contract_critical_dates: dates,
      };
    }

    const contextBlock = {
      contract: contractCtx,
      latest_assessment: {
        risk_score: latest.risk_score,
        risk_band: latest.risk_band,
        completed_at: latest.completed_at,
        summary: latest.report_jsonb?.summary,
        key_risks: latest.report_jsonb?.key_risks,
        recommendations: latest.report_jsonb?.recommendations,
        report_markdown: latest.report_markdown,
      },
    };

    // Sanitize messages and cap turns
    const chatMsgs = messages
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-20)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

    if (chatMsgs.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: `Contract & assessment context:\n${JSON.stringify(contextBlock, null, 2)}` },
          ...chatMsgs,
        ],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      const status = aiRes.status === 429 ? 429 : aiRes.status === 402 ? 402 : 500;
      return new Response(JSON.stringify({
        error: aiRes.status === 429
          ? "Rate limit reached. Please retry in a moment."
          : aiRes.status === 402
          ? "AI credits exhausted. Add credits in Settings → Workspace → Usage."
          : "AI service error",
        detail: txt.slice(0, 400),
      }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await aiRes.json();
    const reply = json?.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Unexpected error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
