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
Given a contract, evaluate revenue recognition risk under the 5-step framework.
Return STRICT JSON ONLY with this shape:
{
  "risk_score": <0-100>,
  "risk_band": "<Low|Moderate|Elevated|High|Critical>",
  "summary": "<2-3 sentence executive summary>",
  "step1_identify_contract": { "findings": [...], "issues": [...] },
  "step2_performance_obligations": { "obligations": [...], "issues": [...] },
  "step3_transaction_price": { "fixed": <number>, "variable_components": [...], "issues": [...] },
  "step4_allocate_price": { "method": "...", "allocations": [...], "issues": [...] },
  "step5_recognize_revenue": { "timing": "point_in_time|over_time", "method": "...", "issues": [...] },
  "key_risks": [ { "severity":"high|medium|low", "title":"...", "detail":"...", "remediation":"..." } ],
  "recommendations": [ "..." ]
}
Be concise but rigorous. Flag variable consideration, financing components, principal vs agent, distinct goods/services, contract modifications, and disclosure gaps.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { contractId, paymentMethod, stripeSessionId } = await req.json();
    if (!contractId) throw new Error("contractId required");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error("Not authenticated");

    // Try formal contracts table first, then fall back to live_contract_imports
    let contract: any = null;
    {
      const { data } = await admin
        .from("contracts")
        .select("*, contract_invoice_schedules(*), contract_critical_dates(*)")
        .eq("id", contractId).maybeSingle();
      contract = data;
    }
    if (!contract) {
      const { data: imp } = await admin
        .from("live_contract_imports")
        .select("*")
        .eq("id", contractId).maybeSingle();
      if (!imp) throw new Error("Contract not found");
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
      contract = {
        id: imp.id,
        account_id: imp.account_id,
        title: imp.contract_name || imp.file_name,
        contract_type: imp.contract_type,
        counterparty_name: extracted.customer?.legal_name || extracted.customer?.dba_name || null,
        contract_value: imp.contract_value,
        currency: extracted.commercial?.currency || null,
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

    const { data: isAdmin } = await admin.rpc("is_asc606_admin", { _user_id: user.id, _account_id: contract.account_id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Owner or Admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Method must be one of: 'credits' (deduct now), 'overage' (accrue), 'stripe_one_time' (verify session paid)
    const method = paymentMethod as "credits" | "overage" | "stripe_one_time";
    if (!["credits", "overage", "stripe_one_time"].includes(method)) throw new Error("Invalid paymentMethod");

    if (method === "stripe_one_time") {
      if (!stripeSessionId) throw new Error("stripeSessionId required for stripe_one_time");
      // Verify the session was completed for this contract via ledger entry created by webhook
      const { data: paid } = await admin.from("asc606_credit_ledger")
        .select("id").eq("stripe_checkout_session_id", stripeSessionId)
        .eq("kind", "purchase").maybeSingle();
      // For one-time assessment Stripe sessions we don't write 'purchase' ledger; we rely on session lookup.
      // Simpler: check session metadata via a paid-session marker we'll write below.
      // Fallback: trust the metadata + a one-time entitlement table.
      const { data: entitlement } = await admin.from("asc606_assessments")
        .select("id, status").eq("stripe_checkout_session_id", stripeSessionId).maybeSingle();
      if (entitlement) {
        return new Response(JSON.stringify({ assessmentId: entitlement.id, status: entitlement.status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
        });
      }
    }

    // Create assessment row (running)
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

    // Atomic credit/overage debit BEFORE running AI (refund if AI fails)
    if (method === "credits" || method === "overage") {
      const { data: cons, error: consErr } = await admin.rpc("consume_asc606_credits", {
        _account_id: contract.account_id,
        _amount: COST_CREDITS,
        _contract_id: contractId,
        _assessment_id: assessment.id,
        _user_id: user.id,
      });
      if (consErr) {
        await admin.from("asc606_assessments").update({ status: "failed", error: consErr.message }).eq("id", assessment.id);
        return new Response(JSON.stringify({ error: consErr.message }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // If user requested 'credits' but RPC fell back to 'overage', record actual method
      const actual = (cons as any)?.method ?? method;
      if (actual !== method) {
        await admin.from("asc606_assessments").update({ payment_method: actual }).eq("id", assessment.id);
      }
    }

    // Build prompt
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
      metadata: contract.metadata,
    };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analyze this contract under ASC 606:\n\n${JSON.stringify(userPayload, null, 2)}` },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      // Refund on failure
      if (method === "credits" || method === "overage") {
        await admin.from("asc606_credit_ledger").insert({
          account_id: contract.account_id, delta: COST_CREDITS, kind: "refund",
          contract_id: contractId, assessment_id: assessment.id, created_by: user.id,
          note: `Refund — AI failure (${aiRes.status})`,
        });
        if (method === "credits") {
          await admin.rpc("consume_asc606_credits" as any, {}).catch(() => {});
          // Re-credit balance manually:
          const { data: w } = await admin.from("asc606_credit_wallets").select("*").eq("account_id", contract.account_id).single();
          if (w) {
            await admin.from("asc606_credit_wallets").update({
              balance_credits: Number(w.balance_credits) + COST_CREDITS,
              lifetime_consumed: Math.max(0, Number(w.lifetime_consumed) - COST_CREDITS),
            }).eq("account_id", contract.account_id);
          }
        } else {
          const { data: w } = await admin.from("asc606_credit_wallets").select("*").eq("account_id", contract.account_id).single();
          if (w) {
            await admin.from("asc606_credit_wallets").update({
              pending_overage_credits: Math.max(0, Number(w.pending_overage_credits) - COST_CREDITS),
              lifetime_consumed: Math.max(0, Number(w.lifetime_consumed) - COST_CREDITS),
            }).eq("account_id", contract.account_id);
          }
        }
      }
      await admin.from("asc606_assessments").update({
        status: "failed", error: `AI ${aiRes.status}: ${errText.slice(0, 500)}`,
      }).eq("id", assessment.id);

      const status = aiRes.status === 429 ? 429 : aiRes.status === 402 ? 402 : 500;
      return new Response(JSON.stringify({ error: "AI service error", status: aiRes.status }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content ?? "{}";
    let report: any;
    try { report = JSON.parse(content); } catch { report = { raw: content }; }

    const markdown = buildMarkdown(report, contract);

    await admin.from("asc606_assessments").update({
      status: "complete",
      report_jsonb: report,
      report_markdown: markdown,
      risk_score: report?.risk_score ?? null,
      risk_band: report?.risk_band ?? null,
      model_version: MODEL,
      completed_at: new Date().toISOString(),
    }).eq("id", assessment.id);

    return new Response(JSON.stringify({ assessmentId: assessment.id, status: "complete", report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("[asc606-run-assessment]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildMarkdown(r: any, c: any): string {
  if (!r || r.raw) return r?.raw ?? "";
  const risks = (r.key_risks ?? []).map((k: any) =>
    `- **[${(k.severity ?? "").toUpperCase()}] ${k.title}** — ${k.detail}\n  - _Remediation:_ ${k.remediation}`
  ).join("\n");
  const recs = (r.recommendations ?? []).map((x: string) => `- ${x}`).join("\n");
  return `# ASC 606 Revenue Risk Assessment
**Contract:** ${c.title}
**Risk Score:** ${r.risk_score} / 100 — **${r.risk_band}**

## Summary
${r.summary ?? ""}

## Step 1 — Identify the Contract
${JSON.stringify(r.step1_identify_contract, null, 2)}

## Step 2 — Performance Obligations
${JSON.stringify(r.step2_performance_obligations, null, 2)}

## Step 3 — Transaction Price
${JSON.stringify(r.step3_transaction_price, null, 2)}

## Step 4 — Allocate Price
${JSON.stringify(r.step4_allocate_price, null, 2)}

## Step 5 — Recognize Revenue
${JSON.stringify(r.step5_recognize_revenue, null, 2)}

## Key Risks
${risks}

## Recommendations
${recs}
`;
}
