import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `You are Nicolas, a SaaS revenue & contracts analyst. You are reviewing a contract that has already been OCR-scanned and partially parsed into "schedule lines" (Order Form lines). Your job is QUALITY CONTROL: find Order Form / pricing items in the contract text that are MISSING from the current schedule lines, or that are MISCATEGORIZED.

Pay special attention to one-time and fixed-fee items commonly missed by automated extraction:
- Fixed Fee Professional Services (often phrased as "Professional Services - Fixed Fee", "PS Fixed Fee", "SOW Fixed Fee", "Implementation Services - Fixed", or a flat $ amount under a Services section)
- Implementation / Setup / Onboarding / Activation / Configuration / Enablement / Deployment fees
- Training, Migration, Hardware, Travel & Expense estimates
- License activation, kickoff, one-time platform fees

Also flag clearly miscategorized lines — e.g. a recurring SaaS subscription marked as one-time, or a one-time PS fee marked as recurring.

Standard SaaS revenue_type values you MUST use:
recurring_subscription | usage_based | one_time | professional_services

Standard product_category values you MUST use:
subscription | platform | license | support | maintenance | usage_minimum | prepaid_usage | professional_services | implementation | onboarding | training | hardware | other

Return STRICT JSON only, no prose, in this shape:
{
  "summary": "1-3 sentence plain English summary of what you found",
  "suggested_additions": [
    { "description": "...", "amount": 25000, "currency": "USD", "scheduled_date": "YYYY-MM-DD or null", "product_category": "professional_services", "revenue_type": "professional_services", "rationale": "where in the contract you saw this" }
  ],
  "suggested_recategorizations": [
    { "schedule_id": "uuid-of-existing-line", "current_category": "other", "suggested_category": "professional_services", "current_revenue_type": "one_time", "suggested_revenue_type": "professional_services", "rationale": "..." }
  ]
}

If nothing is missing or miscategorized, return empty arrays. Do NOT invent items not supported by the contract text. Only set amount when it is explicitly stated.`;

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
    if (!userData.user) return json({ error: "Unauthorized" }, 401);

    const { importId } = await req.json();
    if (!importId) return json({ error: "importId required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: imp, error: impErr } = await admin
      .from("live_contract_imports")
      .select("id, account_id, file_name, currency")
      .eq("id", importId)
      .maybeSingle();
    if (impErr || !imp) return json({ error: "Contract not found" }, 404);

    const { data: ext } = await admin
      .from("live_contract_extractions")
      .select("raw_text, ai_response")
      .eq("import_id", importId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!ext?.raw_text) {
      return json({ error: "No OCR text found for this contract. Run a scan first." }, 400);
    }

    const { data: schedules } = await admin
      .from("contract_invoice_schedules")
      .select("id, description, product_description, amount, scheduled_date, product_category, revenue_type, billing_type")
      .eq("import_id", importId)
      .order("scheduled_date", { ascending: true });

    const userPrompt = `CONTRACT FILE: ${imp.file_name || "(untitled)"}
DEFAULT CURRENCY: ${imp.currency || "USD"}

CURRENT SCHEDULE LINES (${(schedules || []).length}):
${JSON.stringify(schedules || [], null, 2)}

CONTRACT OCR TEXT (truncated to 40k chars):
"""
${(ext.raw_text || "").slice(0, 40_000)}
"""

Identify missing and miscategorized Order Form lines. Return STRICT JSON.`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI service not configured" }, 500);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      const msg = aiRes.status === 429
        ? "Rate limit reached. Please retry in a moment."
        : aiRes.status === 402
        ? "AI credits exhausted. Add credits in Settings → Workspace → Usage."
        : `AI service error (${aiRes.status}): ${txt.slice(0, 400)}`;
      return json({ error: msg }, aiRes.status);
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content;
    } catch {
      parsed = { summary: content, suggested_additions: [], suggested_recategorizations: [] };
    }

    return json({
      summary: parsed.summary || "",
      suggested_additions: Array.isArray(parsed.suggested_additions) ? parsed.suggested_additions : [],
      suggested_recategorizations: Array.isArray(parsed.suggested_recategorizations) ? parsed.suggested_recategorizations : [],
      account_id: imp.account_id,
      currency: imp.currency || "USD",
    });
  } catch (e: any) {
    console.error("nicolas-line-review error", e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
