import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ============================================================================
 * GENERATE CAMPAIGN STRATEGY - AI-Driven Collection Campaign Recommendations
 * ============================================================================
 * 
 * This function analyzes accounts by risk tier and generates AI-powered
 * collection campaign strategies based on:
 * - Risk score distribution
 * - Account intelligence summaries
 * - Payment history patterns
 * - Aging bucket distribution
 * 
 * RISK TIERS:
 * - Low: Score ≤ 30 (gentle reminders, maintain relationship)
 * - Medium: Score 31-55 (proactive outreach, payment plans)
 * - High: Score 56-75 (urgent collection, escalation)
 * - Critical: Score > 75 (legal consideration, final notices)
 * 
 * ============================================================================
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CampaignRequest {
  targetRiskTier: "Low" | "Medium" | "High" | "Critical" | "All";
  minBalance?: number;
  maxBalance?: number;
  includeAccountIds?: string[];
}

interface AccountSummary {
  id: string;
  name: string;
  riskScore: number;
  riskTier: string;
  totalBalance: number;
  avgDaysToPay: number;
  openInvoicesCount: number;
  maxDaysPastDue: number;
  agingMix: {
    current: number;
    dpd_1_30: number;
    dpd_31_60: number;
    dpd_61_90: number;
    dpd_91_120: number;
    dpd_121_plus: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: CampaignRequest = await req.json();
    const { targetRiskTier, minBalance = 0, maxBalance, includeAccountIds } = body;

    console.log(`Generating campaign strategy for risk tier: ${targetRiskTier}`);

    // Build query for target accounts
    let query = supabase
      .from("debtors")
      .select(`
        id,
        name,
        payment_score,
        payment_risk_tier,
        total_open_balance,
        avg_days_to_pay,
        open_invoices_count,
        max_days_past_due,
        aging_mix_current_pct,
        aging_mix_1_30_pct,
        aging_mix_31_60_pct,
        aging_mix_61_90_pct,
        aging_mix_91_120_pct,
        aging_mix_121_plus_pct
      `)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .gt("total_open_balance", minBalance);

    if (maxBalance) {
      query = query.lte("total_open_balance", maxBalance);
    }

    if (targetRiskTier !== "All") {
      query = query.eq("payment_risk_tier", targetRiskTier);
    }

    if (includeAccountIds && includeAccountIds.length > 0) {
      query = query.in("id", includeAccountIds);
    }

    const { data: accounts, error: accountsError } = await query.order("payment_score", { ascending: false });

    if (accountsError) {
      console.error("Error fetching accounts:", accountsError);
      throw new Error("Failed to fetch accounts");
    }

    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({
        strategy: null,
        message: "No accounts found matching the criteria",
        accounts: [],
        summary: { totalAccounts: 0, totalBalance: 0 }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prepare account summaries
    const accountSummaries: AccountSummary[] = accounts.map(acc => ({
      id: acc.id,
      name: acc.name || "Unknown",
      riskScore: acc.payment_score || 50,
      riskTier: acc.payment_risk_tier || "Medium",
      totalBalance: acc.total_open_balance || 0,
      avgDaysToPay: acc.avg_days_to_pay || 0,
      openInvoicesCount: acc.open_invoices_count || 0,
      maxDaysPastDue: acc.max_days_past_due || 0,
      agingMix: {
        current: acc.aging_mix_current_pct || 0,
        dpd_1_30: acc.aging_mix_1_30_pct || 0,
        dpd_31_60: acc.aging_mix_31_60_pct || 0,
        dpd_61_90: acc.aging_mix_61_90_pct || 0,
        dpd_91_120: acc.aging_mix_91_120_pct || 0,
        dpd_121_plus: acc.aging_mix_121_plus_pct || 0,
      }
    }));

    // Calculate portfolio summary
    const totalBalance = accountSummaries.reduce((sum, acc) => sum + acc.totalBalance, 0);
    const avgRiskScore = accountSummaries.reduce((sum, acc) => sum + acc.riskScore, 0) / accountSummaries.length;
    const avgDaysPastDue = accountSummaries.reduce((sum, acc) => sum + acc.maxDaysPastDue, 0) / accountSummaries.length;
    
    // Risk distribution
    const riskDistribution = {
      low: accountSummaries.filter(a => a.riskScore <= 30).length,
      medium: accountSummaries.filter(a => a.riskScore > 30 && a.riskScore <= 55).length,
      high: accountSummaries.filter(a => a.riskScore > 55 && a.riskScore <= 75).length,
      critical: accountSummaries.filter(a => a.riskScore > 75).length,
    };

    // Aging distribution (by balance)
    const agingByBalance = accountSummaries.reduce((acc, a) => ({
      current: acc.current + (a.agingMix.current / 100 * a.totalBalance),
      dpd_1_30: acc.dpd_1_30 + (a.agingMix.dpd_1_30 / 100 * a.totalBalance),
      dpd_31_60: acc.dpd_31_60 + (a.agingMix.dpd_31_60 / 100 * a.totalBalance),
      dpd_61_90: acc.dpd_61_90 + (a.agingMix.dpd_61_90 / 100 * a.totalBalance),
      dpd_91_120: acc.dpd_91_120 + (a.agingMix.dpd_91_120 / 100 * a.totalBalance),
      dpd_121_plus: acc.dpd_121_plus + (a.agingMix.dpd_121_plus / 100 * a.totalBalance),
    }), { current: 0, dpd_1_30: 0, dpd_31_60: 0, dpd_61_90: 0, dpd_91_120: 0, dpd_121_plus: 0 });

    // Generate AI strategy using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = `You are an expert accounts receivable collection strategist. Your role is to analyze customer payment risk data and recommend optimal collection strategies.

RISK SCORING MODEL (Higher Score = Higher Risk):
- Low Risk (≤30): Customers with good payment history, mostly current balances
- Medium Risk (31-55): Some payment delays, may need gentle reminders
- High Risk (56-75): Significant payment issues, urgent outreach needed
- Critical Risk (>75): Severe delinquency, escalation or legal consideration

COLLECTION APPROACH GUIDELINES:
- Low Risk: Maintain relationship, soft reminders, thank for loyalty
- Medium Risk: Proactive outreach, offer payment plans, increase frequency
- High Risk: Urgent communication, escalation warnings, dedicated follow-up
- Critical Risk: Final notices, legal preparation, settlement offers

Always provide specific, actionable recommendations based on the data.`;

    const userPrompt = `Analyze this collection campaign portfolio and provide a strategic recommendation:

TARGET RISK TIER: ${targetRiskTier}
TOTAL ACCOUNTS: ${accountSummaries.length}
TOTAL BALANCE AT RISK: $${totalBalance.toLocaleString()}
AVERAGE RISK SCORE: ${avgRiskScore.toFixed(1)}
AVERAGE DAYS PAST DUE: ${avgDaysPastDue.toFixed(0)}

RISK DISTRIBUTION:
- Low Risk: ${riskDistribution.low} accounts
- Medium Risk: ${riskDistribution.medium} accounts
- High Risk: ${riskDistribution.high} accounts
- Critical Risk: ${riskDistribution.critical} accounts

AGING BY BALANCE:
- Current: $${agingByBalance.current.toLocaleString()}
- 1-30 Days: $${agingByBalance.dpd_1_30.toLocaleString()}
- 31-60 Days: $${agingByBalance.dpd_31_60.toLocaleString()}
- 61-90 Days: $${agingByBalance.dpd_61_90.toLocaleString()}
- 91-120 Days: $${agingByBalance.dpd_91_120.toLocaleString()}
- 121+ Days: $${agingByBalance.dpd_121_plus.toLocaleString()}

TOP 5 HIGHEST RISK ACCOUNTS:
${accountSummaries.slice(0, 5).map(a => 
  `- ${a.name}: Risk Score ${a.riskScore}, Balance $${a.totalBalance.toLocaleString()}, ${a.maxDaysPastDue} days past due`
).join('\n')}

Based on this analysis, provide:
1. Campaign name suggestion
2. Recommended collection tone (friendly/firm/urgent/legal)
3. Recommended primary channel (email/phone/multi-channel)
4. Key strategy points (3-5 bullet points)
5. Expected collection timeline
6. Risk mitigation recommendations
7. Confidence score (0-100) in this strategy`;

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
          { role: "user", content: userPrompt }
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_campaign_strategy",
            description: "Generate a collection campaign strategy based on the portfolio analysis",
            parameters: {
              type: "object",
              properties: {
                campaignName: { type: "string", description: "Suggested name for the campaign" },
                recommendedTone: { 
                  type: "string", 
                  enum: ["friendly", "firm", "urgent", "legal"],
                  description: "Recommended communication tone"
                },
                recommendedChannel: {
                  type: "string",
                  enum: ["email", "phone", "multi-channel"],
                  description: "Primary communication channel"
                },
                strategyPoints: {
                  type: "array",
                  items: { type: "string" },
                  description: "Key strategy points (3-5 items)"
                },
                expectedTimeline: { type: "string", description: "Expected collection timeline" },
                riskMitigation: {
                  type: "array",
                  items: { type: "string" },
                  description: "Risk mitigation recommendations"
                },
                confidenceScore: { 
                  type: "number", 
                  description: "Confidence in this strategy (0-100)" 
                },
                executiveSummary: { type: "string", description: "Brief executive summary of the strategy" }
              },
              required: ["campaignName", "recommendedTone", "recommendedChannel", "strategyPoints", "expectedTimeline", "confidenceScore", "executiveSummary"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_campaign_strategy" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let strategy;

    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        strategy = JSON.parse(toolCall.function.arguments);
      } else {
        throw new Error("No tool call in response");
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      // Fallback strategy based on risk tier
      strategy = {
        campaignName: `${targetRiskTier} Risk Collection Campaign`,
        recommendedTone: targetRiskTier === "Critical" ? "legal" : 
                        targetRiskTier === "High" ? "urgent" : 
                        targetRiskTier === "Medium" ? "firm" : "friendly",
        recommendedChannel: targetRiskTier === "Critical" ? "multi-channel" : "email",
        strategyPoints: [
          "Segment accounts by balance size for prioritized outreach",
          "Customize messaging based on payment history",
          "Set clear escalation timelines",
          "Track response rates and adjust approach"
        ],
        expectedTimeline: targetRiskTier === "Critical" ? "30-60 days" : "60-90 days",
        riskMitigation: ["Monitor for payment disputes", "Document all communications"],
        confidenceScore: 70,
        executiveSummary: `Standard collection approach for ${targetRiskTier.toLowerCase()} risk accounts.`
      };
    }

    console.log(`Generated strategy for ${accountSummaries.length} accounts`);

    return new Response(JSON.stringify({
      strategy,
      accounts: accountSummaries,
      summary: {
        totalAccounts: accountSummaries.length,
        totalBalance,
        avgRiskScore,
        avgDaysPastDue,
        riskDistribution,
        agingByBalance
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error generating campaign strategy:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
