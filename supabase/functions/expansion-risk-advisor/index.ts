import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !user) {
      console.error("expansion-risk-advisor auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { debtor_id, expansion_amount, expansion_type, expansion_notes } = await req.json();
    if (!debtor_id || !expansion_amount) throw new Error("debtor_id and expansion_amount are required");

    // Fetch debtor data
    const { data: debtor, error: dErr } = await supabase
      .from("debtors")
      .select("*")
      .eq("id", debtor_id)
      .single();
    if (dErr) throw dErr;

    // Fetch AI context
    const { data: aiContext } = await supabase
      .from("debtor_ai_context")
      .select("*")
      .eq("debtor_id", debtor_id)
      .maybeSingle();

    // Fetch invoice history stats
    const { data: invoices } = await supabase
      .from("invoices")
      .select("amount, amount_outstanding, status, due_date, payment_date, days_past_due")
      .eq("debtor_id", debtor_id)
      .order("created_at", { ascending: false })
      .limit(50);

    const totalInvoices = invoices?.length || 0;
    const paidInvoices = invoices?.filter(i => i.status === "Paid") || [];
    const avgPaymentDays = paidInvoices.length > 0
      ? paidInvoices.reduce((sum, i) => {
          if (i.payment_date && i.due_date) {
            const diff = (new Date(i.payment_date).getTime() - new Date(i.due_date).getTime()) / 86400000;
            return sum + diff;
          }
          return sum;
        }, 0) / paidInvoices.length
      : null;
    const totalPaidVolume = paidInvoices.reduce((s, i) => s + (i.amount || 0), 0);
    const openBalance = debtor.current_balance || 0;

    // ---- CLM Contract context (if entitled & contracts linked) -----------
    let contracts: any[] = [];
    let contractFinancials = { mrr: 0, arr: 0, acv: 0, tcv: 0, currency: "USD" };
    let contractRiskFlags: any[] = [];
    let upcomingDates: any[] = [];

    try {
      const { data: imports } = await supabase
        .from("live_contract_imports")
        .select("id, contract_name, contract_type, effective_date, term_end_date, status")
        .eq("debtor_id", debtor_id);

      contracts = imports || [];
      const ids = contracts.map((c: any) => c.id);
      if (ids.length > 0) {
        const [{ data: fields }, { data: flags }, { data: dates }] = await Promise.all([
          supabase.from("live_contract_extracted_fields")
            .select("import_id, field_key, field_value, field_group")
            .in("import_id", ids),
          supabase.from("contract_risk_flags")
            .select("import_id, flag_type, severity, description")
            .in("import_id", ids),
          supabase.from("contract_critical_dates")
            .select("import_id, date_type, due_date, risk_level")
            .in("import_id", ids)
            .gte("due_date", new Date().toISOString().slice(0, 10))
            .order("due_date", { ascending: true })
            .limit(10),
        ]);

        const num = (v: any) => {
          if (v == null) return 0;
          const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
          return isFinite(n) ? n : 0;
        };
        for (const f of fields || []) {
          if (f.field_key === "mrr") contractFinancials.mrr += num(f.field_value);
          else if (f.field_key === "arr") contractFinancials.arr += num(f.field_value);
          else if (f.field_key === "acv") contractFinancials.acv += num(f.field_value);
          else if (f.field_key === "tcv" || f.field_key === "contract_value")
            contractFinancials.tcv += num(f.field_value);
          else if (f.field_key === "currency" && f.field_value)
            contractFinancials.currency = f.field_value;
        }
        if (contractFinancials.arr === 0 && contractFinancials.mrr > 0)
          contractFinancials.arr = contractFinancials.mrr * 12;
        if (contractFinancials.acv === 0 && contractFinancials.arr > 0)
          contractFinancials.acv = contractFinancials.arr;

        contractRiskFlags = flags || [];
        upcomingDates = dates || [];
      }
    } catch (clmErr) {
      console.warn("CLM context fetch failed (non-fatal):", clmErr);
    }

    const activeContracts = contracts.filter(
      (c: any) => !c.term_end_date || new Date(c.term_end_date) >= new Date(),
    );
    const totalContractedValue =
      contractFinancials.tcv > 0
        ? contractFinancials.tcv
        : contractFinancials.acv;

    const contextPayload = {
      debtor: {
        company_name: debtor.company_name,
        payment_score: debtor.payment_score,
        payment_risk_tier: debtor.payment_risk_tier,
        avg_days_to_pay: debtor.avg_days_to_pay,
        max_days_past_due: debtor.max_days_past_due,
        current_balance: openBalance,
        open_invoices_count: debtor.open_invoices_count,
        disputed_invoices_count: debtor.disputed_invoices_count,
      },
      ai_context: aiContext ? {
        industry: aiContext.industry,
        annual_revenue: aiContext.annual_revenue,
        employee_count: aiContext.employee_count,
        payment_preferences: aiContext.payment_preferences,
        financial_health: aiContext.financial_health,
        business_relationship: aiContext.business_relationship,
      } : null,
      history: {
        total_invoices: totalInvoices,
        paid_invoices: paidInvoices.length,
        avg_payment_days_vs_due: avgPaymentDays !== null ? Math.round(avgPaymentDays) : null,
        total_paid_volume: totalPaidVolume,
      },
      contracts: {
        total_contracts: contracts.length,
        active_contracts: activeContracts.length,
        currency: contractFinancials.currency,
        mrr: contractFinancials.mrr,
        arr: contractFinancials.arr,
        acv: contractFinancials.acv,
        tcv: contractFinancials.tcv,
        total_contracted_value: totalContractedValue,
        risk_flags: contractRiskFlags.map((f: any) => ({
          type: f.flag_type, severity: f.severity, description: f.description,
        })),
        upcoming_key_dates: upcomingDates.map((d: any) => ({
          type: d.date_type, due_date: d.due_date, risk_level: d.risk_level,
        })),
        active_list: activeContracts.slice(0, 10).map((c: any) => ({
          name: c.contract_name, type: c.contract_type,
          start: c.effective_date, end: c.term_end_date, status: c.status,
        })),
      },
      expansion: {
        amount: expansion_amount,
        type: expansion_type || "Not specified",
        notes: expansion_notes || "",
      },
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are Recouply.ai's Expansion Risk Advisor — a Collections & Risk CRM intelligence engine.

Given a customer's payment history, risk profile, and a proposed expansion (new purchase/service), provide:
1. A risk assessment for extending additional credit
2. Recommended payment and billing terms optimized for cash flow
3. Strategic guidance on structuring the deal

Use "estimate" language. Do not provide legal advice. Be finance-forward and outcome-driven.

Risk assessment should factor in:
- Current open balance vs expansion size
- Payment history (avg days to pay, disputes, defaults)
- Payment risk tier and score
- Customer AI context (industry, revenue, relationship)
- **Existing contracts (CLM)**: total contracted value (TCV/ACV/ARR/MRR), active contract count, upcoming renewal/termination dates, and any contract risk flags. Treat existing contracted obligations as additional exposure on top of open AR. Flag concentration risk when expansion meaningfully increases total committed value, and call out contract-driven risks (auto-renewals, near-term renewals, termination clauses) that affect the safety of expanding.

Output ONLY valid JSON matching this schema:
{
  "risk_level": "Low|Medium|High|Critical",
  "risk_score": number (0-100, higher = riskier),
  "risk_summary": "string (2-3 sentences)",
  "recommended_terms": {
    "payment_terms": "string (e.g., 'Net 30', 'Due on Receipt', '50% upfront, Net 30 on balance')",
    "billing_structure": "string (e.g., 'milestone-based', 'monthly', 'upfront + balance')",
    "credit_limit_guidance": "string",
    "deposit_recommendation": "string (e.g., '25% deposit recommended' or 'No deposit needed')"
  },
  "strategic_guidance": [
    { "action": "string", "rationale": "string" }
  ],
  "conditions": [
    "string - any conditions to attach to the expansion"
  ],
  "expansion_impact": {
    "total_exposure": number,
    "exposure_increase_pct": number,
    "projected_cash_at_risk": number
  }
}

Return ONLY valid JSON. No markdown, no code fences.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(contextPayload) },
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI gateway error:", aiResponse.status, await aiResponse.text());
      return new Response(JSON.stringify(buildFallback(contextPayload, openBalance, expansion_amount)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI JSON:", content);
      result = buildFallback(contextPayload, openBalance, expansion_amount);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("expansion-risk-advisor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildFallback(ctx: any, openBalance: number, expansionAmount: number) {
  const score = ctx.debtor.payment_score || 50;
  const contractedValue = ctx.contracts?.total_contracted_value || 0;
  const totalExposure = openBalance + expansionAmount + contractedValue;
  const riskLevel = score >= 80 ? "Low" : score >= 60 ? "Medium" : score >= 40 ? "High" : "Critical";
  const contractNote = contractedValue > 0
    ? ` Existing contracted value of $${contractedValue.toLocaleString()} adds to total committed exposure.`
    : "";

  return {
    risk_level: riskLevel,
    risk_score: 100 - score,
    risk_summary: `Based on the customer's payment score of ${score} and current balance of $${openBalance.toLocaleString()}, expanding by $${expansionAmount.toLocaleString()} carries ${riskLevel.toLowerCase()} risk. Total exposure would be $${totalExposure.toLocaleString()}.${contractNote}`,
    recommended_terms: {
      payment_terms: score >= 70 ? "Net 30" : score >= 50 ? "Net 15" : "Due on Receipt or 50% upfront",
      billing_structure: score >= 70 ? "Standard invoicing" : "Milestone-based or deposit + balance",
      credit_limit_guidance: `Recommended max exposure: $${Math.round(totalExposure * (score / 100)).toLocaleString()}`,
      deposit_recommendation: score >= 70 ? "No deposit needed" : score >= 50 ? "25% deposit recommended" : "50% deposit strongly recommended",
    },
    strategic_guidance: [
      { action: "Review open balance before extending terms", rationale: "Ensure current AR is manageable before increasing exposure" },
      { action: "Consider shorter payment cycles", rationale: "Reduces cash-at-risk window for new commitments" },
    ],
    conditions: score < 60
      ? ["Require deposit before fulfillment", "Set up automated payment reminders", "Monthly credit review"]
      : ["Standard credit terms apply"],
    expansion_impact: {
      total_exposure: totalExposure,
      exposure_increase_pct: openBalance > 0 ? Math.round((expansionAmount / openBalance) * 100) : 100,
      projected_cash_at_risk: Math.round(totalExposure * ((100 - score) / 100)),
    },
  };
}
