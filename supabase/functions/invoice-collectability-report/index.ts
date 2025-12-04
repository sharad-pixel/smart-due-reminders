import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvoiceReport {
  invoice_id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  days_past_due: number;
  status: string;
  aging_bucket: string;
  debtor_name: string;
  debtor_id: string;
  collectability_score: number;
  collectability_tier: string;
  ai_summary: string;
  payment_likelihood: string;
  recommended_action: string;
  risk_factors: string[];
  account_payment_score: number | null;
  account_risk_tier: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { limit = 50, status_filter, generate_ai_summary = false } = await req.json().catch(() => ({}));

    // Fetch open/in-payment-plan invoices with debtor info
    let query = supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        amount,
        due_date,
        status,
        aging_bucket,
        debtor_id,
        debtors (
          id,
          name,
          company_name,
          payment_score,
          payment_risk_tier,
          avg_days_to_pay,
          open_invoices_count,
          disputed_invoices_count,
          written_off_invoices_count,
          total_open_balance
        )
      `)
      .eq("user_id", user.id)
      .order("due_date", { ascending: true })
      .limit(limit);

    if (status_filter && status_filter.length > 0) {
      query = query.in("status", status_filter);
    } else {
      query = query.in("status", ["Open", "InPaymentPlan"]);
    }

    const { data: invoices, error: invoiceError } = await query;

    if (invoiceError) {
      throw invoiceError;
    }

    // Calculate collectability for each invoice
    const reports: InvoiceReport[] = [];
    const today = new Date();

    for (const invoice of invoices || []) {
      const dueDate = new Date(invoice.due_date);
      const daysPastDue = Math.max(0, Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      const debtor = invoice.debtors as any;
      const accountPaymentScore = debtor?.payment_score ?? null;
      const accountRiskTier = debtor?.payment_risk_tier ?? null;
      
      // Calculate collectability score (hybrid approach)
      const collectabilityResult = calculateCollectability(
        daysPastDue,
        Number(invoice.amount),
        accountPaymentScore,
        debtor?.avg_days_to_pay,
        debtor?.disputed_invoices_count || 0,
        debtor?.written_off_invoices_count || 0,
        invoice.status
      );

      // Determine risk factors
      const riskFactors = identifyRiskFactors(
        daysPastDue,
        Number(invoice.amount),
        accountPaymentScore,
        accountRiskTier,
        debtor?.avg_days_to_pay,
        debtor?.disputed_invoices_count || 0,
        debtor?.written_off_invoices_count || 0
      );

      // Determine recommended action
      const recommendedAction = getRecommendedAction(
        collectabilityResult.score,
        daysPastDue,
        invoice.status,
        riskFactors
      );

      // Payment likelihood assessment
      const paymentLikelihood = getPaymentLikelihood(collectabilityResult.score);

      reports.push({
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        amount: Number(invoice.amount),
        due_date: invoice.due_date,
        days_past_due: daysPastDue,
        status: invoice.status,
        aging_bucket: invoice.aging_bucket || getAgingBucket(daysPastDue),
        debtor_name: debtor?.company_name || debtor?.name || "Unknown",
        debtor_id: invoice.debtor_id,
        collectability_score: collectabilityResult.score,
        collectability_tier: collectabilityResult.tier,
        ai_summary: "", // Will be filled by AI if requested
        payment_likelihood: paymentLikelihood,
        recommended_action: recommendedAction,
        risk_factors: riskFactors,
        account_payment_score: accountPaymentScore,
        account_risk_tier: accountRiskTier,
      });
    }

    // Generate AI summaries if requested
    if (generate_ai_summary && reports.length > 0) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        // Generate summaries in batches to avoid rate limits
        const batchSize = 10;
        for (let i = 0; i < reports.length; i += batchSize) {
          const batch = reports.slice(i, i + batchSize);
          await generateAISummaries(batch, LOVABLE_API_KEY);
        }
      }
    }

    // Calculate aggregate stats
    const aggregateStats = calculateAggregateStats(reports);

    return new Response(
      JSON.stringify({
        success: true,
        reports,
        aggregate: aggregateStats,
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error generating collectability report:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate report" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function calculateCollectability(
  daysPastDue: number,
  amount: number,
  accountScore: number | null,
  avgDaysToPay: number | null,
  disputedCount: number,
  writtenOffCount: number,
  status: string
): { score: number; tier: string } {
  let score = 100;
  
  // Factor 1: Days past due (up to -40 points)
  if (daysPastDue > 0) {
    if (daysPastDue <= 30) score -= daysPastDue * 0.5;
    else if (daysPastDue <= 60) score -= 15 + (daysPastDue - 30) * 0.6;
    else if (daysPastDue <= 90) score -= 33 + (daysPastDue - 60) * 0.7;
    else if (daysPastDue <= 120) score -= 54 + (daysPastDue - 90) * 0.8;
    else score -= Math.min(40, 78 + (daysPastDue - 120) * 0.2);
  }
  
  // Factor 2: Account payment history (up to -25 points)
  if (accountScore !== null) {
    // Inverse relationship: lower account score = harder to collect
    const accountPenalty = Math.max(0, (100 - accountScore) * 0.25);
    score -= accountPenalty;
  }
  
  // Factor 3: Average days to pay history (up to -10 points)
  if (avgDaysToPay !== null && avgDaysToPay > 30) {
    score -= Math.min(10, (avgDaysToPay - 30) * 0.2);
  }
  
  // Factor 4: Disputed invoices (up to -10 points)
  if (disputedCount > 0) {
    score -= Math.min(10, disputedCount * 3);
  }
  
  // Factor 5: Written off history (up to -15 points)
  if (writtenOffCount > 0) {
    score -= Math.min(15, writtenOffCount * 5);
  }
  
  // Factor 6: Status bonus/penalty
  if (status === "InPaymentPlan") {
    score += 10; // Payment plan indicates engagement
  }
  
  // Clamp score
  score = Math.max(0, Math.min(100, Math.round(score)));
  
  // Determine tier
  let tier: string;
  if (score >= 80) tier = "High";
  else if (score >= 60) tier = "Medium";
  else if (score >= 40) tier = "Low";
  else tier = "Very Low";
  
  return { score, tier };
}

function identifyRiskFactors(
  daysPastDue: number,
  amount: number,
  accountScore: number | null,
  accountRiskTier: string | null,
  avgDaysToPay: number | null,
  disputedCount: number,
  writtenOffCount: number
): string[] {
  const factors: string[] = [];
  
  if (daysPastDue > 90) {
    factors.push("Severely overdue (90+ days)");
  } else if (daysPastDue > 60) {
    factors.push("Significantly overdue (60+ days)");
  } else if (daysPastDue > 30) {
    factors.push("Moderately overdue (30+ days)");
  }
  
  if (amount > 10000) {
    factors.push("High value invoice");
  }
  
  if (accountScore !== null && accountScore < 50) {
    factors.push("Account has poor payment history");
  }
  
  if (accountRiskTier === "Critical" || accountRiskTier === "High") {
    factors.push(`Account risk tier: ${accountRiskTier}`);
  }
  
  if (avgDaysToPay !== null && avgDaysToPay > 45) {
    factors.push(`Account typically pays late (avg ${Math.round(avgDaysToPay)} days)`);
  }
  
  if (disputedCount > 0) {
    factors.push(`Account has ${disputedCount} disputed invoice(s)`);
  }
  
  if (writtenOffCount > 0) {
    factors.push(`Account has ${writtenOffCount} written-off invoice(s)`);
  }
  
  if (factors.length === 0) {
    factors.push("No significant risk factors identified");
  }
  
  return factors;
}

function getRecommendedAction(
  collectabilityScore: number,
  daysPastDue: number,
  status: string,
  riskFactors: string[]
): string {
  if (status === "InPaymentPlan") {
    return "Monitor payment plan progress";
  }
  
  if (collectabilityScore >= 80) {
    if (daysPastDue <= 7) return "Send friendly reminder";
    return "Continue standard collection workflow";
  }
  
  if (collectabilityScore >= 60) {
    if (daysPastDue > 60) return "Escalate to direct outreach";
    return "Increase collection frequency";
  }
  
  if (collectabilityScore >= 40) {
    if (riskFactors.some(f => f.includes("disputed"))) {
      return "Resolve dispute before escalating";
    }
    return "Consider settlement offer or payment plan";
  }
  
  // Very low collectability
  if (daysPastDue > 120) {
    return "Evaluate for write-off or third-party collection";
  }
  
  return "Implement aggressive collection strategy";
}

function getPaymentLikelihood(score: number): string {
  if (score >= 85) return "Very Likely";
  if (score >= 70) return "Likely";
  if (score >= 50) return "Moderate";
  if (score >= 30) return "Unlikely";
  return "Very Unlikely";
}

function getAgingBucket(daysPastDue: number): string {
  if (daysPastDue <= 0) return "current";
  if (daysPastDue <= 30) return "dpd_1_30";
  if (daysPastDue <= 60) return "dpd_31_60";
  if (daysPastDue <= 90) return "dpd_61_90";
  if (daysPastDue <= 120) return "dpd_91_120";
  if (daysPastDue <= 150) return "dpd_121_150";
  return "dpd_150_plus";
}

async function generateAISummaries(reports: InvoiceReport[], apiKey: string) {
  const prompt = `Analyze these invoices and provide a brief 1-2 sentence summary for each focusing on collectability outlook and key concern. Be concise and actionable.

Invoices:
${reports.map((r, i) => `${i + 1}. Invoice #${r.invoice_number}: $${r.amount.toLocaleString()}, ${r.days_past_due} days past due, Account: ${r.debtor_name}, Collectability: ${r.collectability_score}/100 (${r.collectability_tier}), Risk factors: ${r.risk_factors.join("; ")}`).join("\n")}

Respond with JSON array of summaries in order:`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a collections analyst providing brief, actionable invoice assessments. Return only a JSON array of strings." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_summaries",
              description: "Return AI summaries for invoices",
              parameters: {
                type: "object",
                properties: {
                  summaries: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of brief summaries, one per invoice in order",
                  },
                },
                required: ["summaries"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_summaries" } },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const { summaries } = JSON.parse(toolCall.function.arguments);
        summaries.forEach((summary: string, index: number) => {
          if (reports[index]) {
            reports[index].ai_summary = summary;
          }
        });
      }
    }
  } catch (error) {
    console.error("Error generating AI summaries:", error);
    // Continue without AI summaries
  }
}

function calculateAggregateStats(reports: InvoiceReport[]) {
  if (reports.length === 0) {
    return {
      total_invoices: 0,
      total_amount: 0,
      avg_collectability_score: 0,
      high_collectability_count: 0,
      medium_collectability_count: 0,
      low_collectability_count: 0,
      very_low_collectability_count: 0,
      total_at_risk: 0,
      avg_days_past_due: 0,
    };
  }

  const totalAmount = reports.reduce((sum, r) => sum + r.amount, 0);
  const avgScore = Math.round(reports.reduce((sum, r) => sum + r.collectability_score, 0) / reports.length);
  const avgDays = Math.round(reports.reduce((sum, r) => sum + r.days_past_due, 0) / reports.length);
  
  const highCount = reports.filter(r => r.collectability_tier === "High").length;
  const mediumCount = reports.filter(r => r.collectability_tier === "Medium").length;
  const lowCount = reports.filter(r => r.collectability_tier === "Low").length;
  const veryLowCount = reports.filter(r => r.collectability_tier === "Very Low").length;
  
  const atRiskAmount = reports
    .filter(r => r.collectability_score < 50)
    .reduce((sum, r) => sum + r.amount, 0);

  return {
    total_invoices: reports.length,
    total_amount: totalAmount,
    avg_collectability_score: avgScore,
    high_collectability_count: highCount,
    medium_collectability_count: mediumCount,
    low_collectability_count: lowCount,
    very_low_collectability_count: veryLowCount,
    total_at_risk: atRiskAmount,
    avg_days_past_due: avgDays,
  };
}
