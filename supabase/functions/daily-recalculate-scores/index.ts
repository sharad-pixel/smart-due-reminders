import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ============================================================================
 * DAILY PAYMENT SCORE RECALCULATION CRON
 * ============================================================================
 * 
 * This function runs daily (via cron or manual trigger) to recalculate
 * payment scores for ALL debtors across ALL user accounts.
 * 
 * RISK SCORING MODEL (Higher Score = Higher Risk):
 * ------------------------------------------------
 * Base Score: 20 (low risk baseline)
 * 
 * AGING BUCKET WEIGHTS:
 * - 121+ days past due: +20 to +40 points (CRITICAL)
 *   - 50%+ of balance: +40 points
 *   - 25-49% of balance: +30 points
 *   - <25% of balance: +20 points
 * - 91-120 days past due: +10 to +20 points
 *   - 30%+ of balance: +20 points
 *   - <30% of balance: +10 points
 * - 61-90 days past due: +10 points (if >20% of balance)
 * - 31-60 days past due: +5 points (if >30% of balance)
 * - Low current balance (<10%): +10 points
 * 
 * PAYMENT HISTORY WEIGHTS:
 * - Avg days to pay ≤5 days: +0 (excellent)
 * - Avg days to pay 6-15 days: +5 (good)
 * - Avg days to pay 16-30 days: +15 (fair)
 * - Avg days to pay 31-60 days: +25 (poor)
 * - Avg days to pay 61+ days: +35 (very poor)
 * 
 * STATUS WEIGHTS:
 * - 2+ disputed invoices: +15 points
 * - 1 disputed invoice: +5 points
 * - Written-off invoices: +20 points per occurrence
 * 
 * RISK TIERS:
 * - Low: Score ≤ 30
 * - Medium: Score 31-55
 * - High: Score 56-75
 * - Critical: Score > 75
 * 
 * ============================================================================
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecalculationResult {
  user_id: string;
  debtors_processed: number;
  errors: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[daily-recalculate-scores] Starting daily payment score recalculation");

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Get all unique user_ids that have debtors
    const { data: users, error: usersError } = await supabaseAdmin
      .from("debtors")
      .select("user_id")
      .not("user_id", "is", null);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    // Get unique user IDs
    const uniqueUserIds = [...new Set(users?.map(d => d.user_id) || [])];
    console.log(`[daily-recalculate-scores] Found ${uniqueUserIds.length} unique users with debtors`);

    const results: RecalculationResult[] = [];
    let totalDebtorsProcessed = 0;
    let totalErrors = 0;

    for (const userId of uniqueUserIds) {
      try {
        // Get all debtors for this user
        const { data: debtors, error: debtorsError } = await supabaseAdmin
          .from("debtors")
          .select("id")
          .eq("user_id", userId);

        if (debtorsError) {
          console.error(`[daily-recalculate-scores] Error fetching debtors for user ${userId}: ${debtorsError.message}`);
          results.push({ user_id: userId, debtors_processed: 0, errors: [debtorsError.message] });
          totalErrors++;
          continue;
        }

        const userErrors: string[] = [];
        let processedCount = 0;

        for (const debtor of debtors || []) {
          try {
            const score = await calculatePaymentScore(supabaseAdmin, userId, debtor.id);
            
            // Update debtor record with calculated scores AND recalculated balance
            const { error: updateError } = await supabaseAdmin
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
                // CRITICAL: Always sync balance fields from actual invoice data
                total_open_balance: score.total_open_balance,
                current_balance: score.total_open_balance,
              })
              .eq("id", debtor.id);

            if (updateError) {
              userErrors.push(`Debtor ${debtor.id}: ${updateError.message}`);
              totalErrors++;
            } else {
              processedCount++;
              totalDebtorsProcessed++;
            }
          } catch (err: any) {
            userErrors.push(`Debtor ${debtor.id}: ${err.message}`);
            totalErrors++;
          }
        }

        results.push({
          user_id: userId,
          debtors_processed: processedCount,
          errors: userErrors,
        });

      } catch (err: any) {
        console.error(`[daily-recalculate-scores] Error processing user ${userId}: ${err.message}`);
        results.push({ user_id: userId, debtors_processed: 0, errors: [err.message] });
        totalErrors++;
      }
    }

    console.log(`[daily-recalculate-scores] Completed. Processed ${totalDebtorsProcessed} debtors across ${uniqueUserIds.length} users. Errors: ${totalErrors}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          users_processed: uniqueUserIds.length,
          total_debtors_processed: totalDebtorsProcessed,
          total_errors: totalErrors,
        },
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[daily-recalculate-scores] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Calculate payment score for a single debtor
 * 
 * RISK MODEL: Higher Score = Higher Risk
 * See function header for complete scoring breakdown
 */
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
  total_open_balance: number;
  aging_mix: {
    current_pct: number;
    dpd_1_30_pct: number;
    dpd_31_60_pct: number;
    dpd_61_90_pct: number;
    dpd_121_plus_pct: number;
    dpd_91_120_pct: number;
  };
  breakdown: string[];
}

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
      total_open_balance: 0, // No invoices = zero balance
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

  // RISK MODEL: Higher score = Higher risk
  // Base score of 20 (low risk baseline)
  let score = 20;

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
  // Include PartiallyPaid invoices in open balance calculation
  const openInvoices = invoices.filter((inv: any) => 
    inv.status === "Open" || inv.status === "InPaymentPlan" || inv.status === "PartiallyPaid"
  );
  
  const openInvoicesCount = openInvoices.length;
  // Use amount_outstanding if available, otherwise fallback to amount
  const totalOutstanding = openInvoices.reduce((sum: number, inv: any) => {
    const outstandingAmount = parseFloat(inv.amount_outstanding ?? inv.amount ?? 0);
    return sum + outstandingAmount;
  }, 0);
  
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

  // AGING BUCKET SCORING (Higher = Riskier)
  // 121+ days is CRITICAL - heavily weight this
  if (agingMix.dpd_121_plus_pct > 0) {
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

  // Status-based scoring
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
    breakdown.push(`${inPaymentPlanCount} invoice(s) in payment plan (monitored)`);
  }

  if (writtenOffCount > 0) {
    score += 20;
    breakdown.push(`${writtenOffCount} written-off invoice(s) (+20 risk)`);
  }

  // Clamp score between 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine risk tier
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
    total_open_balance: totalOutstanding,
    aging_mix: agingMix,
    breakdown,
  };
}
