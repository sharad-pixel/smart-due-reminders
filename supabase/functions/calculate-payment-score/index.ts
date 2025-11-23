import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentScoreCalculation {
  debtor_id: string;
  payment_score: number;
  payment_risk_tier: string;
  avg_days_to_pay: number | null;
  max_days_past_due: number;
  open_invoices_count: number;
  disputed_invoices_count: number;
  in_payment_plan_invoices_count: number;
  written_off_invoices_count: number;
  aging_mix: {
    current_pct: number;
    dpd_1_30_pct: number;
    dpd_31_60_pct: number;
    dpd_61_90_pct: number;
    dpd_91_120_pct: number;
    dpd_121_plus_pct: number;
  };
  breakdown: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { debtor_id, recalculate_all } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated");

    let debtorIds: string[] = [];
    
    if (recalculate_all) {
      const { data: debtors } = await supabaseClient
        .from("debtors")
        .select("id")
        .eq("user_id", user.id);
      
      debtorIds = debtors?.map(d => d.id) || [];
    } else if (debtor_id) {
      debtorIds = [debtor_id];
    } else {
      throw new Error("Either debtor_id or recalculate_all must be provided");
    }

    const results: PaymentScoreCalculation[] = [];

    for (const dId of debtorIds) {
      const score = await calculatePaymentScore(supabaseClient, user.id, dId);
      results.push(score);
      
      // Update debtor record with calculated scores
      await supabaseClient
        .from("debtors")
        .update({
          payment_score: score.payment_score,
          payment_risk_tier: score.payment_risk_tier,
          avg_days_to_pay: score.avg_days_to_pay,
          max_days_past_due: score.max_days_past_due,
          open_invoices_count: score.open_invoices_count,
          disputed_invoices_count: score.disputed_invoices_count,
          in_payment_plan_invoices_count: score.in_payment_plan_invoices_count,
          written_off_invoices_count: score.written_off_invoices_count,
          aging_mix_current_pct: score.aging_mix.current_pct,
          aging_mix_1_30_pct: score.aging_mix.dpd_1_30_pct,
          aging_mix_31_60_pct: score.aging_mix.dpd_31_60_pct,
          aging_mix_61_90_pct: score.aging_mix.dpd_61_90_pct,
          aging_mix_91_120_pct: score.aging_mix.dpd_91_120_pct,
          aging_mix_121_plus_pct: score.aging_mix.dpd_121_plus_pct,
          payment_score_last_calculated: new Date().toISOString(),
        })
        .eq("id", dId);
    }

    return new Response(
      JSON.stringify({ results }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in calculate-payment-score:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function calculatePaymentScore(
  supabase: any,
  userId: string,
  debtorId: string
): Promise<PaymentScoreCalculation> {
  const breakdown: string[] = [];
  
  // Fetch all invoices for this debtor
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("debtor_id", debtorId)
    .eq("user_id", userId);

  if (!invoices || invoices.length === 0) {
    return {
      debtor_id: debtorId,
      payment_score: 50,
      payment_risk_tier: "medium",
      avg_days_to_pay: null,
      max_days_past_due: 0,
      open_invoices_count: 0,
      disputed_invoices_count: 0,
      in_payment_plan_invoices_count: 0,
      written_off_invoices_count: 0,
      aging_mix: {
        current_pct: 0,
        dpd_1_30_pct: 0,
        dpd_31_60_pct: 0,
        dpd_61_90_pct: 0,
        dpd_91_120_pct: 0,
        dpd_121_plus_pct: 0,
      },
      breakdown: ["No invoice history available"],
    };
  }

  // Start with base score
  let score = 80;

  // Calculate days to pay for paid invoices
  const paidInvoices = invoices.filter((inv: any) => 
    inv.status === "Paid" && inv.paid_date && inv.due_date
  );
  
  let avgDaysToPay: number | null = null;
  if (paidInvoices.length > 0) {
    const totalDaysToPay = paidInvoices.reduce((sum: number, inv: any) => {
      const days = Math.floor(
        (new Date(inv.paid_date).getTime() - new Date(inv.due_date).getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      return sum + days;
    }, 0);
    
    avgDaysToPay = totalDaysToPay / paidInvoices.length;
    
    // Score adjustment based on avg days to pay
    if (avgDaysToPay <= 5) {
      score += 10;
      breakdown.push(`Average days to pay: ${avgDaysToPay.toFixed(1)} (excellent - +10 points)`);
    } else if (avgDaysToPay <= 15) {
      breakdown.push(`Average days to pay: ${avgDaysToPay.toFixed(1)} (good - no impact)`);
    } else if (avgDaysToPay <= 30) {
      score -= 10;
      breakdown.push(`Average days to pay: ${avgDaysToPay.toFixed(1)} (fair - -10 points)`);
    } else if (avgDaysToPay <= 60) {
      score -= 20;
      breakdown.push(`Average days to pay: ${avgDaysToPay.toFixed(1)} (poor - -20 points)`);
    } else {
      score -= 30;
      breakdown.push(`Average days to pay: ${avgDaysToPay.toFixed(1)} (very poor - -30 points)`);
    }
  }

  // Calculate aging mix for outstanding invoices
  const openInvoices = invoices.filter((inv: any) => 
    inv.status === "Open" || inv.status === "InPaymentPlan"
  );
  
  const openInvoicesCount = openInvoices.length;
  const totalOutstanding = openInvoices.reduce((sum: number, inv: any) => sum + parseFloat(inv.amount), 0);
  
  const agingBuckets = {
    current: 0,
    dpd_1_30: 0,
    dpd_31_60: 0,
    dpd_61_90: 0,
    dpd_91_120: 0,
    dpd_121_plus: 0,
  };

  let maxDaysPastDue = 0;

  openInvoices.forEach((inv: any) => {
    const daysPastDue = Math.floor(
      (new Date().getTime() - new Date(inv.due_date).getTime()) / 
      (1000 * 60 * 60 * 24)
    );
    
    if (daysPastDue > maxDaysPastDue) {
      maxDaysPastDue = daysPastDue;
    }

    const amount = parseFloat(inv.amount);
    
    if (daysPastDue < 0) {
      agingBuckets.current += amount;
    } else if (daysPastDue <= 30) {
      agingBuckets.dpd_1_30 += amount;
    } else if (daysPastDue <= 60) {
      agingBuckets.dpd_31_60 += amount;
    } else if (daysPastDue <= 90) {
      agingBuckets.dpd_61_90 += amount;
    } else if (daysPastDue <= 120) {
      agingBuckets.dpd_91_120 += amount;
    } else {
      agingBuckets.dpd_121_plus += amount;
    }
  });

  const agingMix = {
    current_pct: totalOutstanding > 0 ? (agingBuckets.current / totalOutstanding) * 100 : 0,
    dpd_1_30_pct: totalOutstanding > 0 ? (agingBuckets.dpd_1_30 / totalOutstanding) * 100 : 0,
    dpd_31_60_pct: totalOutstanding > 0 ? (agingBuckets.dpd_31_60 / totalOutstanding) * 100 : 0,
    dpd_61_90_pct: totalOutstanding > 0 ? (agingBuckets.dpd_61_90 / totalOutstanding) * 100 : 0,
    dpd_91_120_pct: totalOutstanding > 0 ? (agingBuckets.dpd_91_120 / totalOutstanding) * 100 : 0,
    dpd_121_plus_pct: totalOutstanding > 0 ? (agingBuckets.dpd_121_plus / totalOutstanding) * 100 : 0,
  };

  // Aging mix scoring
  if (agingMix.current_pct > 70) {
    score += 10;
    breakdown.push(`${agingMix.current_pct.toFixed(0)}% of balance is current (+10 points)`);
  }
  
  if (agingMix.dpd_31_60_pct + agingMix.dpd_61_90_pct > 30) {
    score -= 10;
    breakdown.push(`${(agingMix.dpd_31_60_pct + agingMix.dpd_61_90_pct).toFixed(0)}% of balance is 31+ days past due (-10 points)`);
  }
  
  if (agingMix.dpd_61_90_pct + agingMix.dpd_91_120_pct + agingMix.dpd_121_plus_pct > 50) {
    score -= 20;
    breakdown.push(`Over 50% of balance is 61+ days past due (-20 points)`);
  }

  // Status-based scoring
  const disputedCount = invoices.filter((inv: any) => inv.status === "Disputed").length;
  const inPaymentPlanCount = invoices.filter((inv: any) => inv.status === "InPaymentPlan").length;
  const writtenOffCount = invoices.filter((inv: any) => inv.status === "Canceled").length;

  if (disputedCount >= 2) {
    score -= 10;
    breakdown.push(`${disputedCount} disputed invoices (-10 points)`);
  } else if (disputedCount === 1) {
    breakdown.push(`1 disputed invoice (monitored)`);
  }

  if (inPaymentPlanCount > 0) {
    // Simplified: assume on track if in payment plan
    score += 5;
    breakdown.push(`${inPaymentPlanCount} invoice(s) in payment plan (+5 points)`);
  }

  if (writtenOffCount > 0) {
    score -= 15;
    breakdown.push(`${writtenOffCount} written-off invoice(s) (-15 points)`);
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine risk tier
  let riskTier: string;
  if (score >= 80) {
    riskTier = "low";
  } else if (score >= 50) {
    riskTier = "medium";
  } else {
    riskTier = "high";
  }

  return {
    debtor_id: debtorId,
    payment_score: Math.round(score),
    payment_risk_tier: riskTier,
    avg_days_to_pay: avgDaysToPay,
    max_days_past_due: maxDaysPastDue,
    open_invoices_count: openInvoicesCount,
    disputed_invoices_count: disputedCount,
    in_payment_plan_invoices_count: inPaymentPlanCount,
    written_off_invoices_count: writtenOffCount,
    aging_mix: agingMix,
    breakdown,
  };
}
