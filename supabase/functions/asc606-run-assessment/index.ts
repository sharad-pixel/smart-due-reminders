import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";
const COST_CREDITS = 10;
const COST_CENTS = 999;

const SYSTEM_PROMPT = `You are a CPA and ASC 606 (Revenue from Contracts with Customers) GAAP expert.
Given a contract, evaluate ALL revenue recognition compliance considerations under the 5-step framework.
Return STRICT JSON ONLY with this shape:
{
  "risk_score": <0-100>,
  "risk_band": "<Low|Moderate|Elevated|High|Critical>",
  "summary": "<2-3 sentence executive summary>",
  "step1_identify_contract": { "findings": [...], "issues": [...] },
  "step2_performance_obligations": { "obligations": [...], "issues": [...] },
  "step3_transaction_price": { "fixed": <number>, "variable_components": [...], "issues": [...] },
  "step4_allocate_price": { "method": "...", "allocations": [...], "issues": [...] },
  "step5_recognize_revenue": { "timing": "point_in_time|over_time|mixed", "method": "...", "issues": [...] },
  "revenue_compliance_guidance": [
    { "area": "...", "guidance": "...", "asc606_step": "Step 1|Step 2|Step 3|Step 4|Step 5", "evidence_needed": "..." }
  ],
  "key_risks": [ { "severity":"high|medium|low", "title":"...", "detail":"...", "remediation":"..." } ],
  "recommendations": [ "..." ]
}
Be concise but rigorous. Flag variable consideration, financing components, principal vs agent, distinct goods/services, contract modifications, rebates/credits, usage fees, renewal/termination rights, collectability, allocation evidence, and disclosure gaps.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let assessmentId: string | null = null;
  let contract: any = null;
  let userId: string | null = null;
  let method: "credits" | "overage" | "stripe_one_time" | null = null;

  try {
    const { contractId, paymentMethod, stripeSessionId } = await req.json();
    if (!contractId) throw new Error("contractId required");
    method = paymentMethod as "credits" | "overage" | "stripe_one_time";
    if (!["credits", "overage", "stripe_one_time"].includes(method)) throw new Error("Invalid paymentMethod");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const existing = stripeSessionId
      ? await findAssessmentBySession(admin, stripeSessionId)
      : null;

    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const serviceRoleToken = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const trustedStripeRun = method === "stripe_one_time" && !!stripeSessionId && !!existing && token === serviceRoleToken;
    let user: { id: string } | null = null;
    if (trustedStripeRun) {
      user = { id: existing.requested_by };
    } else {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user: authUser } } = await supabase.auth.getUser(token);
      if (!authUser) throw new Error("Not authenticated");
      user = authUser;
    }
    userId = user.id;

    contract = await loadContract(admin, contractId);
    if (!contract) throw new Error("Contract not found");

    const { data: isAdmin } = trustedStripeRun
      ? { data: true }
      : await admin.rpc("is_asc606_admin", { _user_id: user.id, _account_id: contract.account_id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Owner or Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (existing?.status === "complete") {
      return new Response(JSON.stringify({ assessmentId: existing.id, status: existing.status, report: existing.report_jsonb }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (existing) {
      assessmentId = existing.id;
      await admin.from("asc606_assessments").update({
        status: "running",
        error: null,
        account_id: contract.account_id,
        requested_by: existing.requested_by ?? user.id,
        payment_method: "stripe_one_time",
        cost_credits: 0,
        cost_cents: COST_CENTS,
      }).eq("id", assessmentId);
    } else {
      const { data: assessment, error: aErr } = await admin.from("asc606_assessments").insert({
        contract_id: contractId,
        account_id: contract.account_id,
        status: "running",
        payment_method: method,
        cost_credits: method === "stripe_one_time" ? 0 : COST_CREDITS,
        cost_cents: COST_CENTS,
        stripe_checkout_session_id: stripeSessionId ?? null,
        requested_by: user.id,
      }).select().single();
      if (aErr || !assessment) throw aErr ?? new Error("Failed to create assessment");
      assessmentId = assessment.id;
    }

    if (!existing && (method === "credits" || method === "overage")) {
      const { data: cons, error: consErr } = await admin.rpc("consume_asc606_credits", {
        _account_id: contract.account_id,
        _amount: COST_CREDITS,
        _contract_id: contractId,
        _assessment_id: assessmentId,
        _user_id: user.id,
      });
      if (consErr) {
        await admin.from("asc606_assessments").update({ status: "failed", error: consErr.message }).eq("id", assessmentId);
        return new Response(JSON.stringify({ error: consErr.message }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const actual = (cons as any)?.method ?? method;
      if (actual !== method) {
        method = actual;
        await admin.from("asc606_assessments").update({ payment_method: actual }).eq("id", assessmentId);
      }
    }

    // Load indexed compliance documents for this account (ASC 606 + ALL standards)
    const { data: complianceDocs } = await admin
      .from("compliance_documents")
      .select("title, asc_standard, doc_category, summary, key_policies, extracted_text")
      .eq("account_id", contract.account_id)
      .eq("status", "indexed")
      .in("asc_standard", ["ASC 606", "ALL"])
      .order("indexed_at", { ascending: false })
      .limit(20);

    const policyContext = (complianceDocs ?? []).map((d: any) => ({
      title: d.title,
      category: d.doc_category,
      summary: d.summary,
      key_policies: d.key_policies,
      excerpt: (d.extracted_text ?? "").slice(0, 3000),
    }));

    const userPayload = {
      title: contract.title,
      contract_type: contract.contract_type,
      counterparty: contract.counterparty_name,
      contract_value: contract.contract_value,
      currency: contract.currency,
      effective_date: contract.effective_date,
      expiry_date: contract.expiry_date,
      renewal_date: contract.renewal_date,
      ai_extracted_terms: contract.ai_extracted_terms,
      ai_summary: contract.ai_summary,
      invoice_schedule: contract.contract_invoice_schedules,
      critical_dates: contract.contract_critical_dates,
      financial_metrics: contract.metadata,
      compliance_policy_library: policyContext,
    };

    const report = await callAiJson([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Analyze this contract under ASC 606 and produce complete revenue compliance guidance. Apply the customer's own indexed compliance policy library where relevant:\n\n${JSON.stringify(userPayload, null, 2)}` },
    ]);

    const markdown = buildMarkdown(report, contract);

    await admin.from("asc606_assessments").update({
      status: "complete",
      report_jsonb: report,
      report_markdown: markdown,
      risk_score: Number.isFinite(Number(report?.risk_score)) ? Math.round(Number(report.risk_score)) : null,
      risk_band: report?.risk_band ?? null,
      model_version: MODEL,
      error: null,
      completed_at: new Date().toISOString(),
    }).eq("id", assessmentId);

    await admin.from("asc606_guidance_messages").insert({
      account_id: contract.account_id,
      contract_id: contractId,
      assessment_id: assessmentId,
      prompt: "Initial ASC 606 revenue compliance assessment",
      guidance: markdown,
      guidance_jsonb: report,
      model_version: MODEL,
      created_by: user.id,
    });

    return new Response(JSON.stringify({ assessmentId, status: "complete", report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("[asc606-run-assessment]", e);
    if (assessmentId) {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const message = e instanceof Error ? e.message : "Unknown error";
      await admin.from("asc606_assessments").update({ status: "failed", error: message }).eq("id", assessmentId);
      if (contract && userId && (method === "credits" || method === "overage")) await refundCredits(admin, contract, assessmentId, userId, method, message);
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function loadContract(admin: any, contractId: string) {
  const { data: formal } = await admin
    .from("contracts")
    .select("*, contract_invoice_schedules(*), contract_critical_dates(*)")
    .eq("id", contractId)
    .maybeSingle();
  if (formal) return formal;

  const { data: imp } = await admin
    .from("live_contract_imports")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();
  if (!imp) return null;

  const [{ data: schedules }, { data: dates }, { data: fields }] = await Promise.all([
    admin.from("contract_invoice_schedules").select("*").eq("import_id", contractId),
    admin.from("contract_critical_dates").select("*").eq("import_id", contractId),
    admin.from("live_contract_extracted_fields").select("field_group, field_key, field_value, field_value_json").eq("import_id", contractId),
  ]);
  const extracted: Record<string, any> = {};
  (fields || []).forEach((f: any) => {
    extracted[f.field_group] = extracted[f.field_group] || {};
    extracted[f.field_group][f.field_key] = f.field_value_json ?? f.field_value;
  });
  return {
    id: imp.id,
    account_id: imp.account_id,
    title: imp.contract_name || imp.file_name,
    contract_type: imp.contract_type,
    counterparty_name: extracted.customer?.legal_name || extracted.customer?.dba_name || null,
    contract_value: imp.contract_value,
    currency: extracted.commercial?.currency || imp.currency || null,
    effective_date: imp.effective_date,
    expiry_date: imp.term_end_date,
    renewal_date: extracted.dates?.renewal_date || imp.term_end_date,
    ai_extracted_terms: extracted,
    ai_summary: imp.product_description,
    metadata: imp.metrics_jsonb,
    contract_invoice_schedules: schedules || [],
    contract_critical_dates: dates || [],
  };
}

async function findAssessmentBySession(admin: any, stripeSessionId: string) {
  const { data } = await admin
    .from("asc606_assessments")
    .select("id, status, report_jsonb, requested_by")
    .eq("stripe_checkout_session_id", stripeSessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function callAiJson(messages: Array<{ role: string; content: string }>) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("AI service is not configured");
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({ model: MODEL, response_format: { type: "json_object" }, messages }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(resp.status === 429
      ? "Rate limit reached. Please retry in a moment."
      : resp.status === 402
      ? "AI credits exhausted. Add credits in Settings → Workspace → Usage."
      : `AI service error (${resp.status}): ${txt.slice(0, 400)}`);
  }
  const aiJson = await resp.json();
  const content = aiJson.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    return { raw: content };
  }
}

async function refundCredits(admin: any, contract: any, assessmentId: string, userId: string, paymentMethod: "credits" | "overage", reason: string) {
  await admin.from("asc606_credit_ledger").insert({
    account_id: contract.account_id,
    delta: COST_CREDITS,
    kind: "refund",
    contract_id: contract.id,
    assessment_id: assessmentId,
    created_by: userId,
    note: `Refund — ${reason.slice(0, 120)}`,
  });
  const { data: w } = await admin.from("asc606_credit_wallets").select("*").eq("account_id", contract.account_id).single();
  if (!w) return;
  if (paymentMethod === "credits") {
    await admin.from("asc606_credit_wallets").update({
      balance_credits: Number(w.balance_credits) + COST_CREDITS,
      lifetime_consumed: Math.max(0, Number(w.lifetime_consumed) - COST_CREDITS),
    }).eq("account_id", contract.account_id);
  } else {
    await admin.from("asc606_credit_wallets").update({
      pending_overage_credits: Math.max(0, Number(w.pending_overage_credits) - COST_CREDITS),
      lifetime_consumed: Math.max(0, Number(w.lifetime_consumed) - COST_CREDITS),
    }).eq("account_id", contract.account_id);
  }
}

function buildMarkdown(r: any, c: any): string {
  if (!r || r.raw) return r?.raw ?? "";
  const fmtIssues = (arr: any) =>
    (Array.isArray(arr) ? arr : [])
      .map((it: any) => `- ${typeof it === "string" ? it : it?.title ?? it?.detail ?? JSON.stringify(it)}`)
      .join("\n") || "_No issues flagged._";
  const fmtList = (arr: any) =>
    (Array.isArray(arr) ? arr : [])
      .map((it: any) => `- ${typeof it === "string" ? it : it?.name ?? it?.title ?? JSON.stringify(it)}`)
      .join("\n") || "_None identified._";

  const s1 = r.step1_identify_contract ?? {};
  const s2 = r.step2_performance_obligations ?? {};
  const s3 = r.step3_transaction_price ?? {};
  const s4 = r.step4_allocate_price ?? {};
  const s5 = r.step5_recognize_revenue ?? {};

  const risks = (r.key_risks ?? []).map((k: any) =>
    `### [${(k.severity ?? "").toUpperCase()}] ${k.title}\n${k.detail ?? ""}\n\n**Fix:** ${k.remediation ?? "—"}`
  ).join("\n\n") || "_No material risks identified._";

  const guidance = (r.revenue_compliance_guidance ?? []).map((g: any) =>
    `### ${g.area ?? "Revenue compliance"} _(${g.asc606_step ?? "ASC 606"})_\n${g.guidance ?? ""}${g.evidence_needed ? `\n\n**Evidence needed:** ${g.evidence_needed}` : ""}`
  ).join("\n\n") || "_No additional guidance returned._";

  const recs = (r.recommendations ?? []).map((x: string) => `- ${x}`).join("\n") || "_None._";

  return `# ASC 606 Revenue Risk Assessment

**Contract:** ${c.title}  
**Risk Score:** ${r.risk_score ?? "—"} / 100 — **${r.risk_band ?? "—"}**

## Executive Summary
${r.summary ?? ""}

## Revenue Compliance Guidance
${guidance}

---

## Step 1 — Identify the Contract
**Findings**
${fmtList(s1.findings)}

**Open issues / missing data**
${fmtIssues(s1.issues)}

## Step 2 — Performance Obligations
**Identified obligations**
${fmtList(s2.obligations)}

**Open issues / missing data**
${fmtIssues(s2.issues)}

## Step 3 — Transaction Price
${s3.fixed != null ? `**Fixed consideration:** ${s3.fixed}\n` : ""}**Variable components**
${fmtList(s3.variable_components)}

**Open issues / missing data**
${fmtIssues(s3.issues)}

## Step 4 — Allocate the Transaction Price
${s4.method ? `**Method:** ${s4.method}\n` : ""}**Allocations**
${fmtList(s4.allocations)}

**Open issues / missing data**
${fmtIssues(s4.issues)}

## Step 5 — Recognize Revenue
${s5.timing ? `**Timing:** ${s5.timing}  \n` : ""}${s5.method ? `**Method:** ${s5.method}\n` : ""}
**Open issues / missing data**
${fmtIssues(s5.issues)}

---

## Key Risks
${risks}

## Recommendations
${recs}
`;
}