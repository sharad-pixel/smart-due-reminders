import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface IntelligenceMetrics {
  invoiceActivity: {
    openCount: number;
    overdueCount: number;
    paidLast30Days: number;
    totalAmount: number;
    overdueAmount: number;
  };
  pastDueBalance: number;
  paymentPractices: {
    avgDaysToPay: number;
    onTimePaymentRate: number;
    paymentTrend: "improving" | "stable" | "declining";
  };
  touchpoints: {
    totalCount: number;
    last30Days: number;
    responseRate: number;
  };
  inboundEmails: {
    count: number;
    avgSentiment: string;
    recentSentiments: string[];
  };
  engagementScore: number;
}

interface IntelligenceResult {
  score: number;
  healthTier: "Healthy" | "Watch" | "At Risk" | "Critical";
  metrics: IntelligenceMetrics;
  breakdown: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { debtor_id, recalculate_all } = await req.json();
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[COLLECTION-INTELLIGENCE] Starting calculation for user: ${user.id}, debtor_id: ${debtor_id || "all"}`);

    // Get debtors to process
    let debtorIds: string[] = [];
    if (debtor_id) {
      debtorIds = [debtor_id];
    } else if (recalculate_all) {
      const { data: debtors } = await supabase
        .from("debtors")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_archived", false);
      debtorIds = debtors?.map(d => d.id) || [];
    }

    const results: { debtor_id: string; score: number; healthTier: string }[] = [];

    for (const dId of debtorIds) {
      try {
        const result = await calculateIntelligence(supabase, user.id, dId);
        
        // Update debtor with intelligence score
        await supabase
          .from("debtors")
          .update({
            collection_intelligence_score: result.score,
            collection_health_tier: result.healthTier,
            touchpoint_count: result.metrics.touchpoints.totalCount,
            inbound_email_count: result.metrics.inboundEmails.count,
            response_rate: result.metrics.touchpoints.responseRate,
            avg_response_sentiment: result.metrics.inboundEmails.avgSentiment,
            avg_days_to_pay: result.metrics.paymentPractices.avgDaysToPay,
            collection_score_updated_at: new Date().toISOString(),
          })
          .eq("id", dId);

        results.push({
          debtor_id: dId,
          score: result.score,
          healthTier: result.healthTier,
        });

        console.log(`[COLLECTION-INTELLIGENCE] Calculated score for ${dId}: ${result.score} (${result.healthTier})`);
      } catch (err) {
        console.error(`[COLLECTION-INTELLIGENCE] Error processing ${dId}:`, err);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("[COLLECTION-INTELLIGENCE] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function calculateIntelligence(
  supabase: any,
  userId: string,
  debtorId: string
): Promise<IntelligenceResult> {
  const breakdown: string[] = [];
  let score = 100; // Start at 100, deduct for risk factors

  // Fetch all necessary data in parallel
  const [
    invoicesResult,
    outreachResult,
    inboundResult,
    activitiesResult,
    tasksResult,
  ] = await Promise.all([
    supabase.from("invoices").select("*").eq("debtor_id", debtorId).eq("is_archived", false),
    supabase.from("outreach_logs").select("*").eq("debtor_id", debtorId),
    supabase.from("inbound_emails").select("*").eq("debtor_id", debtorId).order("received_at", { ascending: false }),
    supabase.from("collection_activities").select("*").eq("debtor_id", debtorId),
    supabase.from("collection_tasks").select("*").eq("debtor_id", debtorId),
  ]);

  const invoices = invoicesResult.data || [];
  const outreachLogs = outreachResult.data || [];
  const inboundEmails = inboundResult.data || [];
  const activities = activitiesResult.data || [];
  const tasks = tasksResult.data || [];

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // ==================== INVOICE ACTIVITY SCORE (30 points) ====================
  const openInvoices = invoices.filter((i: any) => ["Open", "PartiallyPaid", "InPaymentPlan", "Overdue"].includes(i.status));
  const overdueInvoices = invoices.filter((i: any) => {
    if (!i.due_date) return false;
    return new Date(i.due_date) < now && !["Paid", "Canceled", "Settled"].includes(i.status);
  });
  const paidLast30Days = invoices.filter((i: any) => 
    i.status === "Paid" && i.paid_at && new Date(i.paid_at) >= thirtyDaysAgo
  ).length;

  const overdueAmount = overdueInvoices.reduce((sum: number, inv: any) => sum + (inv.amount_outstanding || inv.amount || 0), 0);
  const totalOpenAmount = openInvoices.reduce((sum: number, inv: any) => sum + (inv.amount_outstanding || inv.amount || 0), 0);

  // Calculate max days past due for any invoice
  let maxDaysPastDue = 0;
  overdueInvoices.forEach((inv: any) => {
    if (inv.due_date) {
      const dpd = Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
      if (dpd > maxDaysPastDue) maxDaysPastDue = dpd;
    }
  });

  // Deduct for overdue invoices (increased deduction)
  if (overdueInvoices.length > 0) {
    const overdueDeduction = Math.min(overdueInvoices.length * 8, 30);
    score -= overdueDeduction;
    breakdown.push(`-${overdueDeduction} pts: ${overdueInvoices.length} overdue invoice(s)`);
  }

  // Deduct based on days past due (critical factor)
  if (maxDaysPastDue >= 90) {
    score -= 25;
    breakdown.push(`-25 pts: Severely overdue (${maxDaysPastDue} days past due)`);
  } else if (maxDaysPastDue >= 60) {
    score -= 15;
    breakdown.push(`-15 pts: Significantly overdue (${maxDaysPastDue} days past due)`);
  } else if (maxDaysPastDue >= 30) {
    score -= 10;
    breakdown.push(`-10 pts: Overdue (${maxDaysPastDue} days past due)`);
  } else if (maxDaysPastDue > 0) {
    score -= 5;
    breakdown.push(`-5 pts: Recently overdue (${maxDaysPastDue} days past due)`);
  }

  // Deduct for high overdue amounts (increased deduction)
  if (overdueAmount > 10000) {
    score -= 20;
    breakdown.push(`-20 pts: High overdue balance ($${overdueAmount.toLocaleString()})`);
  } else if (overdueAmount > 5000) {
    score -= 12;
    breakdown.push(`-12 pts: Moderate overdue balance ($${overdueAmount.toLocaleString()})`);
  } else if (overdueAmount > 1000) {
    score -= 5;
    breakdown.push(`-5 pts: Overdue balance ($${overdueAmount.toLocaleString()})`);
  }

  // Note: "No payment history" penalty moved below after paidInvoices is defined

  // Bonus for recent payments
  if (paidLast30Days > 0) {
    const paymentBonus = Math.min(paidLast30Days * 3, 10);
    score += paymentBonus;
    breakdown.push(`+${paymentBonus} pts: ${paidLast30Days} payment(s) in last 30 days`);
  }

  // ==================== PAYMENT PRACTICES SCORE (25 points) ====================
  // Average Days to Pay = Total Days Taken to Pay All Invoices / Number of Paid Invoices
  // Days Taken to Pay = Invoice Payment Date - Invoice Issue Date
  const paidInvoices = invoices.filter((i: any) => i.status === "Paid" && i.paid_at && i.issue_date);
  let avgDaysToPay = 0;
  let onTimePayments = 0;

  if (paidInvoices.length > 0) {
    const daysToPay = paidInvoices.map((inv: any) => {
      const issueDate = new Date(inv.issue_date);
      const paidDate = new Date(inv.paid_at);
      // Days to Pay = Payment Date - Issue Date
      const days = Math.max(0, Math.floor((paidDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)));
      // On-time if paid before or on due date
      if (inv.due_date && paidDate <= new Date(inv.due_date)) onTimePayments++;
      return days;
    });
    avgDaysToPay = Math.round(daysToPay.reduce((a: number, b: number) => a + b, 0) / daysToPay.length);
  }

  const onTimeRate = paidInvoices.length > 0 ? (onTimePayments / paidInvoices.length) * 100 : 50;

  // Penalty for no payment history when there are overdue invoices
  if (paidInvoices.length === 0 && overdueInvoices.length > 0) {
    score -= 15;
    breakdown.push(`-15 pts: No payment history with overdue invoices`);
  }

  // Score based on payment practices
  if (avgDaysToPay > 60) {
    score -= 15;
    breakdown.push(`-15 pts: Very slow payment (${avgDaysToPay} days average)`);
  } else if (avgDaysToPay > 30) {
    score -= 8;
    breakdown.push(`-8 pts: Slow payment (${avgDaysToPay} days average)`);
  } else if (avgDaysToPay <= 0) {
    score += 10;
    breakdown.push(`+10 pts: Excellent payment timing (pays on/before due date)`);
  }

  // Determine payment trend
  let paymentTrend: "improving" | "stable" | "declining" = "stable";
  if (paidInvoices.length >= 3) {
    const recentPayments = paidInvoices.slice(0, 3);
    const olderPayments = paidInvoices.slice(3, 6);
    if (olderPayments.length > 0) {
      const recentAvg = recentPayments.reduce((sum: number, inv: any) => {
        const dueDate = new Date(inv.due_date);
        const paidDate = new Date(inv.paid_at);
        return sum + (paidDate.getTime() - dueDate.getTime());
      }, 0) / recentPayments.length;
      const olderAvg = olderPayments.reduce((sum: number, inv: any) => {
        const dueDate = new Date(inv.due_date);
        const paidDate = new Date(inv.paid_at);
        return sum + (paidDate.getTime() - dueDate.getTime());
      }, 0) / olderPayments.length;
      
      if (recentAvg < olderAvg * 0.8) {
        paymentTrend = "improving";
        score += 5;
        breakdown.push(`+5 pts: Payment trend improving`);
      } else if (recentAvg > olderAvg * 1.2) {
        paymentTrend = "declining";
        score -= 5;
        breakdown.push(`-5 pts: Payment trend declining`);
      }
    }
  }

  // ==================== TOUCHPOINT & RESPONSE SCORE (25 points) ====================
  const totalTouchpoints = outreachLogs.length + activities.filter((a: any) => a.direction === "outbound").length;
  const touchpointsLast30Days = outreachLogs.filter((l: any) => 
    l.sent_at && new Date(l.sent_at) >= thirtyDaysAgo
  ).length;

  // Calculate response rate
  const outboundMessages = outreachLogs.length;
  const inboundResponses = inboundEmails.length;
  const responseRate = outboundMessages > 0 ? Math.min((inboundResponses / outboundMessages) * 100, 100) : 0;

  // Score based on engagement
  if (responseRate >= 50) {
    score += 10;
    breakdown.push(`+10 pts: High response rate (${responseRate.toFixed(0)}%)`);
  } else if (responseRate >= 20) {
    score += 5;
    breakdown.push(`+5 pts: Moderate response rate (${responseRate.toFixed(0)}%)`);
  } else if (outboundMessages > 5 && responseRate < 10) {
    score -= 10;
    breakdown.push(`-10 pts: Low response rate (${responseRate.toFixed(0)}%)`);
  }

  // ==================== SENTIMENT ANALYSIS (20 points) ====================
  const sentiments = inboundEmails
    .filter((e: any) => e.sentiment)
    .map((e: any) => e.sentiment?.toLowerCase() || "neutral");
  
  const sentimentCounts = {
    positive: sentiments.filter((s: string) => s === "positive").length,
    neutral: sentiments.filter((s: string) => s === "neutral" || s === "unknown").length,
    negative: sentiments.filter((s: string) => s === "negative" || s === "hostile" || s === "delaying").length,
  };

  let avgSentiment = "neutral";
  if (sentiments.length > 0) {
    if (sentimentCounts.positive > sentimentCounts.negative * 2) {
      avgSentiment = "positive";
      score += 10;
      breakdown.push(`+10 pts: Positive communication sentiment`);
    } else if (sentimentCounts.negative > sentimentCounts.positive * 2) {
      avgSentiment = "negative";
      score -= 10;
      breakdown.push(`-10 pts: Negative communication sentiment`);
    }
  }

  // ==================== TASK STATUS (bonus/penalty) ====================
  const openTasks = tasks.filter((t: any) => t.status === "open" || t.status === "in_progress");
  const overdueTasks = openTasks.filter((t: any) => t.due_date && new Date(t.due_date) < now);

  if (overdueTasks.length > 0) {
    score -= Math.min(overdueTasks.length * 3, 10);
    breakdown.push(`-${Math.min(overdueTasks.length * 3, 10)} pts: ${overdueTasks.length} overdue task(s)`);
  }

  // Disputed invoices penalty
  const disputedCount = invoices.filter((i: any) => i.status === "Disputed").length;
  if (disputedCount > 0) {
    score -= disputedCount * 5;
    breakdown.push(`-${disputedCount * 5} pts: ${disputedCount} disputed invoice(s)`);
  }

  // Clamp score between 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine health tier
  let healthTier: "Healthy" | "Watch" | "At Risk" | "Critical";
  if (score >= 75) {
    healthTier = "Healthy";
  } else if (score >= 50) {
    healthTier = "Watch";
  } else if (score >= 25) {
    healthTier = "At Risk";
  } else {
    healthTier = "Critical";
  }

  const metrics: IntelligenceMetrics = {
    invoiceActivity: {
      openCount: openInvoices.length,
      overdueCount: overdueInvoices.length,
      paidLast30Days,
      totalAmount: totalOpenAmount,
      overdueAmount,
    },
    pastDueBalance: overdueAmount,
    paymentPractices: {
      avgDaysToPay,
      onTimePaymentRate: onTimeRate,
      paymentTrend,
    },
    touchpoints: {
      totalCount: totalTouchpoints,
      last30Days: touchpointsLast30Days,
      responseRate,
    },
    inboundEmails: {
      count: inboundEmails.length,
      avgSentiment,
      recentSentiments: sentiments.slice(0, 5),
    },
    engagementScore: Math.round(responseRate),
  };

  return { score, healthTier, metrics, breakdown };
}
