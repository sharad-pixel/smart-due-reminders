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
      payment_score: 50, // Medium risk when no data
      payment_risk_tier: "Medium",
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
      breakdown: ["No invoice history available - defaulting to medium risk"],
    };
  }

  // CONSISTENT MODEL: Higher score = Higher risk (riskier)
  // Start with base risk score of 20 (low risk baseline)
  let score = 20;

  // Calculate Average Days to Pay for paid invoices
  // Formula: Total Days Taken to Pay All Invoices / Number of Paid Invoices
  // Days Taken to Pay = Invoice Payment Date - Invoice Issue Date
  const paidInvoices = invoices.filter((inv: any) => 
    inv.status === "Paid" && inv.paid_date && inv.issue_date
  );
  
  let avgDaysToPay: number | null = null;
  if (paidInvoices.length > 0) {
    const totalDaysToPay = paidInvoices.reduce((sum: number, inv: any) => {
      // Days to Pay = Payment Date - Issue Date (not due date)
      const days = Math.max(0, Math.floor(
        (new Date(inv.paid_date).getTime() - new Date(inv.issue_date).getTime()) / 
        (1000 * 60 * 60 * 24)
      ));
      return sum + days;
    }, 0);
    
    avgDaysToPay = totalDaysToPay / paidInvoices.length;
    
    // Score adjustment based on avg days to pay (higher = riskier)
    if (avgDaysToPay <= 5) {
      // Excellent payer - keep risk low
      breakdown.push(`Average days to pay: ${avgDaysToPay.toFixed(1)} (excellent - low risk)`);
    } else if (avgDaysToPay <= 15) {
      score += 5;
      breakdown.push(`Average days to pay: ${avgDaysToPay.toFixed(1)} (good - +5 risk)`);
    } else if (avgDaysToPay <= 30) {
      score += 15;
      breakdown.push(`Average days to pay: ${avgDaysToPay.toFixed(1)} (fair - +15 risk)`);
    } else if (avgDaysToPay <= 60) {
      score += 25;
      breakdown.push(`Average days to pay: ${avgDaysToPay.toFixed(1)} (poor - +25 risk)`);
    } else {
      score += 35;
      breakdown.push(`Average days to pay: ${avgDaysToPay.toFixed(1)} (very poor - +35 risk)`);
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
  let totalDaysPastDue = 0;

  openInvoices.forEach((inv: any) => {
    const daysPastDue = Math.max(0, Math.floor(
      (new Date().getTime() - new Date(inv.due_date).getTime()) / 
      (1000 * 60 * 60 * 24)
    ));
    
    totalDaysPastDue += daysPastDue;
    
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

  // Aging mix scoring (higher = riskier)
  // 121+ days is CRITICAL - heavily weight this
  if (agingMix.dpd_121_plus_pct > 0) {
    // Any amount in 121+ is a major red flag
    if (agingMix.dpd_121_plus_pct >= 50) {
      score += 40;
      breakdown.push(`${agingMix.dpd_121_plus_pct.toFixed(0)}% of balance is 121+ days past due (+40 risk - critical)`);
    } else if (agingMix.dpd_121_plus_pct >= 25) {
      score += 30;
      breakdown.push(`${agingMix.dpd_121_plus_pct.toFixed(0)}% of balance is 121+ days past due (+30 risk - severe)`);
    } else {
      score += 20;
      breakdown.push(`${agingMix.dpd_121_plus_pct.toFixed(0)}% of balance is 121+ days past due (+20 risk)`);
    }
  }

  // 91-120 days is also high risk
  if (agingMix.dpd_91_120_pct > 0) {
    if (agingMix.dpd_91_120_pct >= 30) {
      score += 20;
      breakdown.push(`${agingMix.dpd_91_120_pct.toFixed(0)}% of balance is 91-120 days past due (+20 risk)`);
    } else {
      score += 10;
      breakdown.push(`${agingMix.dpd_91_120_pct.toFixed(0)}% of balance is 91-120 days past due (+10 risk)`);
    }
  }
  
  // 61-90 days moderate risk
  if (agingMix.dpd_61_90_pct > 20) {
    score += 10;
    breakdown.push(`${agingMix.dpd_61_90_pct.toFixed(0)}% of balance is 61-90 days past due (+10 risk)`);
  }

  // 31-60 days early warning
  if (agingMix.dpd_31_60_pct > 30) {
    score += 5;
    breakdown.push(`${agingMix.dpd_31_60_pct.toFixed(0)}% of balance is 31-60 days past due (+5 risk)`);
  }
  
  // Low current percentage is a warning sign
  if (agingMix.current_pct > 70) {
    breakdown.push(`${agingMix.current_pct.toFixed(0)}% of balance is current (low risk)`);
  } else if (agingMix.current_pct < 10 && openInvoicesCount > 0) {
    score += 10;
    breakdown.push(`Only ${agingMix.current_pct.toFixed(0)}% of balance is current (+10 risk)`);
  }

  // Status-based scoring (higher = riskier)
  const disputedCount = invoices.filter((inv: any) => inv.status === "Disputed").length;
  const inPaymentPlanCount = invoices.filter((inv: any) => inv.status === "InPaymentPlan").length;
  const writtenOffCount = invoices.filter((inv: any) => inv.status === "Canceled").length;

  if (disputedCount >= 2) {
    score += 15;
    breakdown.push(`${disputedCount} disputed invoices (+15 risk)`);
  } else if (disputedCount === 1) {
    score += 5;
    breakdown.push(`1 disputed invoice (+5 risk)`);
  }

  if (inPaymentPlanCount > 0) {
    // Payment plan is neutral/slightly positive - shows willingness to pay
    breakdown.push(`${inPaymentPlanCount} invoice(s) in payment plan (monitored)`);
  }

  if (writtenOffCount > 0) {
    score += 20;
    breakdown.push(`${writtenOffCount} written-off invoice(s) (+20 risk)`);
  }

  // Clamp score between 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine risk tier - CONSISTENT with risk-engine
  // Higher score = higher risk
  let riskTier: string;
  if (score <= 30) {
    riskTier = "Low";
  } else if (score <= 55) {
    riskTier = "Medium";
  } else if (score <= 75) {
    riskTier = "High";
  } else {
    riskTier = "Critical";
  }

  // Calculate average DPD for open invoices
  const avgDpd = openInvoicesCount > 0 ? totalDaysPastDue / openInvoicesCount : null;

  return {
    debtor_id: debtorId,
    payment_score: Math.round(score),
    payment_risk_tier: riskTier,
    avg_days_to_pay: avgDpd, // Average DPD across open invoices
    max_days_past_due: maxDaysPastDue,
    open_invoices_count: openInvoicesCount,
    disputed_invoices_count: disputedCount,
    in_payment_plan_invoices_count: inPaymentPlanCount,
    written_off_invoices_count: writtenOffCount,
    aging_mix: agingMix,
    breakdown,
  };
}
