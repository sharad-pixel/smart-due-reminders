import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COST_PER_INVOICE = 1.99;

const AGE_BAND_TO_DELAY: Record<string, number> = {
  "0-30": 1,
  "31-60": 2,
  "61-90": 3,
  "91-120": 4,
  "121+": 6,
};

const LOSS_PCT_MIDPOINTS: Record<string, number> = {
  "0-5%": 0.03,
  "6-10%": 0.08,
  "11-20%": 0.15,
  "21%+": 0.25,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { inputs } = await req.json();
    const { overdue_count, overdue_total, age_band, loss_pct_band, annual_rate } = inputs;

    // Deterministic calculations
    const recouply_cost = overdue_count * COST_PER_INVOICE;
    const monthly_rate = annual_rate / 100 / 12;
    const delay_months = AGE_BAND_TO_DELAY[age_band] || 2;
    const delay_cost = overdue_total * monthly_rate * delay_months;
    const loss_risk_cost = overdue_total * (LOSS_PCT_MIDPOINTS[loss_pct_band] || 0.08);
    const breakeven_pct = overdue_total > 0 ? recouply_cost / overdue_total : 0;
    const total_impact = delay_cost + loss_risk_cost;
    const roi_multiple = recouply_cost > 0 ? total_impact / recouply_cost : 0;

    const computed = {
      cost_per_invoice: COST_PER_INVOICE,
      recouply_cost: Math.round(recouply_cost * 100) / 100,
      delay_months,
      delay_cost: Math.round(delay_cost * 100) / 100,
      loss_risk_cost: Math.round(loss_risk_cost * 100) / 100,
      breakeven_pct: Math.round(breakeven_pct * 10000) / 10000,
      roi_multiple: Math.round(roi_multiple * 10) / 10,
    };

    // Call Lovable AI (GPT-5) for risk assessment
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are Recouply.ai's Collections Assessment Assistant.
Provide practical, non-legal guidance.
Do not threaten or imply legal action.
Use "estimate" language and avoid certainty.
Do not recalculate numbers; use provided computed fields.
Output must be valid JSON only.

Risk tier guidance:
- Higher risk if age_band is older and loss_pct_band is higher.
- Use "Critical" mainly for 121+ days with high loss band (21%+).
- Use "High" for 91-120 or 121+ with moderate loss, or 61-90 with high loss.
- Use "Medium" for moderate combinations.
- Use "Low" for 0-30 days with low loss.

Required JSON output schema:
{
  "risk_tier": "Low|Medium|High|Critical",
  "risk_summary": "string (1-2 sentences)",
  "value_summary": "string (1-2 sentences about ROI value)",
  "recommended_actions": [
    { "title": "string", "why": "string", "time_to_do": "string" }
  ],
  "minimal_followup_plan": {
    "goal": "string",
    "touches": [
      { "day": 0, "channel": "email", "tone": "friendly|firm|very_firm", "why": "string" },
      { "day": 3, "channel": "email", "tone": "friendly|firm|very_firm", "why": "string" }
    ],
    "notes": "string"
  },
  "cta": {
    "headline": "string",
    "button_text": "string"
  }
}

Return ONLY valid JSON. No markdown, no code fences.`;

    const userPayload = JSON.stringify({
      overdue_count,
      overdue_total,
      age_band,
      loss_pct_band,
      annual_rate,
      computed,
    });

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
          { role: "user", content: userPayload },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      
      // Return fallback result
      return new Response(JSON.stringify(buildFallback(computed, age_band, loss_pct_band)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    
    // Strip markdown fences if present
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    
    let gptResult;
    try {
      gptResult = JSON.parse(content);
    } catch {
      console.error("Failed to parse GPT JSON:", content);
      gptResult = buildFallback(computed, age_band, loss_pct_band);
    }

    return new Response(JSON.stringify(gptResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("collections-assessment error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildFallback(computed: any, age_band: string, loss_pct_band: string) {
  const isOld = ["91-120", "121+"].includes(age_band);
  const isHighLoss = ["11-20%", "21%+"].includes(loss_pct_band);
  const tier = isOld && isHighLoss ? "Critical" : isOld || isHighLoss ? "High" : "Medium";

  return {
    risk_tier: tier,
    risk_summary: `Based on your inputs, your overdue receivables carry estimated ${tier.toLowerCase()} risk. Older balances and higher write-off rates may compound exposure over time.`,
    value_summary: `At $${computed.cost_per_invoice}/invoice, Recouply may help you recover significantly more than the cost of the service. Your estimated ROI is ${computed.roi_multiple > 10 ? "10x+" : computed.roi_multiple + "x"}.`,
    recommended_actions: [
      { title: "Prioritize oldest invoices", why: "Older balances have the highest cost of delay", time_to_do: "15 minutes" },
      { title: "Set up automated reminders", why: "Consistent follow-up is the #1 driver of recovery", time_to_do: "10 minutes" },
      { title: "Segment by risk tier", why: "Focus energy where it matters most", time_to_do: "5 minutes" },
    ],
    minimal_followup_plan: {
      goal: "Recover the most expensive overdue balances first",
      touches: [
        { day: 0, channel: "email", tone: "friendly", why: "Polite reminder to re-engage the conversation" },
        { day: 3, channel: "email", tone: "firm", why: "Escalate with clear payment expectations" },
      ],
      notes: "Start with the invoices where delay costs you the most.",
    },
    cta: {
      headline: "Ready to recover what you're owed?",
      button_text: "Get my prioritized follow-up plan",
    },
  };
}
