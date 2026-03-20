import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// REVENUE RISK & COLLECTABILITY INTELLIGENCE ENGINE
// ============================================
// Multi-signal AR Risk Engine combining:
// A. Aging Risk (time-based penalties)
// B. Behavioral Risk (historical payment patterns)
// C. Status Risk (invoice condition modifiers)
// D. Inbound AI Engagement Intelligence
// E. Expected Credit Loss (ECL) calculation (ASC 326 / IFRS 9 simplified)

interface EngagementResult {
  engagement_score: number;
  has_responded: boolean;
  last_response_date: string | null;
  response_recency_days: number | null;
  engagement_cadence: string;
  conversation_state: string;
  response_type: string | null;
  broken_promises_count: number;
  payment_intent_detected: boolean;
  score_breakdown: Record<string, number>;
}

interface InvoiceRiskResult {
  invoice_id: string;
  debtor_id: string;
  collectability_score: number;
  collectability_tier: string;
  aging_penalty: number;
  behavioral_penalty: number;
  status_penalty: number;
  engagement_boost: number;
  probability_of_default: number;
  expected_credit_loss: number;
  engagement_adjusted_pd: number;
  engagement_adjusted_ecl: number;
  risk_factors: string[];
  recommended_action: string;
  payment_likelihood: string;
  amount: number;
  days_past_due: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id, debtor_id, generate_ai_summary = false } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get effective account ID
    const { data: effectiveAccountId } = await supabase
      .rpc("get_effective_account_id", { p_user_id: user_id });
    const accountId = effectiveAccountId || user_id;

    console.log(`[REVENUE-RISK] Starting for user ${accountId}, debtor_id: ${debtor_id || "all"}`);

    // 1. Fetch all open invoices (paginated)
    let allInvoices: any[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    while (true) {
      let query = supabase
        .from("invoices")
        .select("id, invoice_number, amount, amount_outstanding, due_date, status, aging_bucket, debtor_id, is_archived")
        .eq("user_id", accountId)
        .eq("is_archived", false)
        .in("status", ["Open", "InPaymentPlan", "PartiallyPaid", "Disputed"])
        .range(from, from + PAGE_SIZE - 1);

      if (debtor_id) {
        query = query.eq("debtor_id", debtor_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;
      allInvoices.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    // 2. Get unique debtor IDs
    const debtorIds = [...new Set(allInvoices.map(i => i.debtor_id))];

    // 3. Fetch debtor data
    const { data: debtors } = await supabase
      .from("debtors")
      .select("id, name, company_name, payment_score, payment_risk_tier, avg_days_to_pay, open_invoices_count, disputed_invoices_count, written_off_invoices_count, total_open_balance, collections_health_score, health_tier, type")
      .in("id", debtorIds);
    const debtorMap = new Map((debtors || []).map(d => [d.id, d]));

    // 4. Fetch engagement data: inbound emails per debtor
    const { data: inboundEmails } = await supabase
      .from("inbound_emails")
      .select("id, debtor_id, received_at, sentiment, category, priority, ai_sentiment_category, ai_sentiment_score, created_at")
      .in("debtor_id", debtorIds)
      .order("received_at", { ascending: false });

    // 5. Fetch collection activities per debtor
    const { data: activities } = await supabase
      .from("collection_activities")
      .select("id, debtor_id, activity_type, direction, responded_at, created_at, sent_at")
      .in("debtor_id", debtorIds)
      .order("created_at", { ascending: false });

    // 6. Fetch collection outcomes (broken promises)
    const { data: outcomes } = await supabase
      .from("collection_outcomes")
      .select("id, debtor_id, outcome_type, promise_to_pay_date, payment_date, created_at")
      .in("debtor_id", debtorIds);

    // 7. Fetch collection tasks
    const { data: tasks } = await supabase
      .from("collection_tasks")
      .select("id, debtor_id, task_type, status, created_at")
      .in("debtor_id", debtorIds);

    // Group data by debtor
    const emailsByDebtor = groupBy(inboundEmails || [], "debtor_id");
    const activitiesByDebtor = groupBy(activities || [], "debtor_id");
    const outcomesByDebtor = groupBy(outcomes || [], "debtor_id");
    const tasksByDebtor = groupBy(tasks || [], "debtor_id");

    // 8. Calculate engagement scores per debtor
    const engagementByDebtor = new Map<string, EngagementResult>();
    for (const did of debtorIds) {
      const engagement = calculateEngagementScore(
        emailsByDebtor[did] || [],
        activitiesByDebtor[did] || [],
        outcomesByDebtor[did] || [],
        tasksByDebtor[did] || []
      );
      engagementByDebtor.set(did, engagement);
    }

    // 9. Score each invoice
    const now = new Date();
    const invoiceResults: InvoiceRiskResult[] = [];

    for (const inv of allInvoices) {
      const debtor = debtorMap.get(inv.debtor_id);
      const engagement = engagementByDebtor.get(inv.debtor_id);
      const dueDate = new Date(inv.due_date);
      const daysPastDue = Math.max(0, Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      const amount = Number(inv.amount_outstanding || inv.amount || 0);

      // A. Aging penalty (0-40)
      const agingPenalty = calculateAgingPenalty(daysPastDue);

      // B. Behavioral penalty (0-25)
      const behavioralPenalty = calculateBehavioralPenalty(debtor);

      // C. Status penalty (0-15)
      const statusPenalty = calculateStatusPenalty(inv.status, debtor);

      // D. Engagement boost (-20 to +15)
      const engagementBoost = calculateEngagementBoost(engagement);

      // Collectability score
      let collectabilityScore = Math.round(
        Math.max(0, Math.min(100, 100 - agingPenalty - behavioralPenalty - statusPenalty + engagementBoost))
      );

      // Collectability tier
      const collectabilityTier = getCollectabilityTier(collectabilityScore);

      // ECL calculation
      const pd = getProbabilityOfDefault(collectabilityScore);
      const ecl = Math.round(amount * pd * 100) / 100;

      // Engagement-adjusted PD
      const engagementAdjustedPd = getEngagementAdjustedPD(pd, engagement);
      const engagementAdjustedEcl = Math.round(amount * engagementAdjustedPd * 100) / 100;

      // Risk factors
      const riskFactors = identifyRiskFactors(daysPastDue, amount, debtor, engagement, inv.status);

      // Recommended action
      const recommendedAction = getRecommendedAction(collectabilityScore, daysPastDue, inv.status, engagement);

      // Payment likelihood
      const paymentLikelihood = getPaymentLikelihood(collectabilityScore);

      invoiceResults.push({
        invoice_id: inv.id,
        debtor_id: inv.debtor_id,
        collectability_score: collectabilityScore,
        collectability_tier: collectabilityTier,
        aging_penalty: agingPenalty,
        behavioral_penalty: behavioralPenalty,
        status_penalty: statusPenalty,
        engagement_boost: engagementBoost,
        probability_of_default: pd,
        expected_credit_loss: ecl,
        engagement_adjusted_pd: engagementAdjustedPd,
        engagement_adjusted_ecl: engagementAdjustedEcl,
        risk_factors: riskFactors,
        recommended_action: recommendedAction,
        payment_likelihood: paymentLikelihood,
        amount,
        days_past_due: daysPastDue,
      });
    }

    // 10. Persist results
    // Upsert engagement scores
    for (const [did, eng] of engagementByDebtor) {
      const debtor = debtorMap.get(did);
      await supabase.from("engagement_scores").upsert({
        debtor_id: did,
        user_id: accountId,
        engagement_score: eng.engagement_score,
        has_responded: eng.has_responded,
        last_response_date: eng.last_response_date,
        response_recency_days: eng.response_recency_days,
        engagement_cadence: eng.engagement_cadence,
        conversation_state: eng.conversation_state,
        response_type: eng.response_type,
        broken_promises_count: eng.broken_promises_count,
        payment_intent_detected: eng.payment_intent_detected,
        score_breakdown: eng.score_breakdown,
        calculated_at: now.toISOString(),
        updated_at: now.toISOString(),
      }, { onConflict: "debtor_id" });
    }

    // Upsert invoice risk scores in batches
    const BATCH_SIZE = 50;
    for (let i = 0; i < invoiceResults.length; i += BATCH_SIZE) {
      const batch = invoiceResults.slice(i, i + BATCH_SIZE).map(r => ({
        invoice_id: r.invoice_id,
        debtor_id: r.debtor_id,
        user_id: accountId,
        collectability_score: r.collectability_score,
        collectability_tier: r.collectability_tier,
        aging_penalty: r.aging_penalty,
        behavioral_penalty: r.behavioral_penalty,
        status_penalty: r.status_penalty,
        engagement_boost: r.engagement_boost,
        probability_of_default: r.probability_of_default,
        expected_credit_loss: r.expected_credit_loss,
        engagement_adjusted_pd: r.engagement_adjusted_pd,
        engagement_adjusted_ecl: r.engagement_adjusted_ecl,
        risk_factors: r.risk_factors,
        recommended_action: r.recommended_action,
        payment_likelihood: r.payment_likelihood,
        calculated_at: now.toISOString(),
        updated_at: now.toISOString(),
      }));
      await supabase.from("invoice_risk_scores").upsert(batch, { onConflict: "invoice_id" });
    }

    // Build debtor risk profiles
    for (const did of debtorIds) {
      const debtorInvoices = invoiceResults.filter(r => r.debtor_id === did);
      const engagement = engagementByDebtor.get(did);
      const debtor = debtorMap.get(did);

      const totalBalance = debtorInvoices.reduce((s, r) => s + r.amount, 0);
      const totalEcl = debtorInvoices.reduce((s, r) => s + r.expected_credit_loss, 0);
      const totalEngAdjEcl = debtorInvoices.reduce((s, r) => s + r.engagement_adjusted_ecl, 0);
      const avgPd = debtorInvoices.length > 0 ? debtorInvoices.reduce((s, r) => s + r.probability_of_default, 0) / debtorInvoices.length : 0;
      const avgScore = debtorInvoices.length > 0 ? Math.round(debtorInvoices.reduce((s, r) => s + r.collectability_score, 0) / debtorInvoices.length) : 50;
      const overdue = debtorInvoices.filter(r => r.days_past_due > 0).length;
      const avgDpd = debtorInvoices.length > 0 ? Math.round(debtorInvoices.reduce((s, r) => s + r.days_past_due, 0) / debtorInvoices.length) : 0;

      const engLevel = getEngagementLevel(engagement?.engagement_score || 0);
      const engRiskImpact = getEngagementRiskImpact(engLevel);
      const riskClass = getRiskClassification(avgScore);

      await supabase.from("debtor_risk_profiles").upsert({
        debtor_id: did,
        user_id: accountId,
        overall_collectability_score: avgScore,
        total_open_balance: totalBalance,
        total_ecl: Math.round(totalEcl * 100) / 100,
        total_engagement_adjusted_ecl: Math.round(totalEngAdjEcl * 100) / 100,
        avg_probability_of_default: Math.round(avgPd * 10000) / 10000,
        engagement_level: engLevel,
        engagement_risk_impact: engRiskImpact,
        risk_classification: riskClass,
        open_invoice_count: debtorInvoices.length,
        overdue_invoice_count: overdue,
        avg_days_past_due: avgDpd,
        calculated_at: now.toISOString(),
        updated_at: now.toISOString(),
      }, { onConflict: "debtor_id" });
    }

    // 11. Build aggregate stats
    const totalAR = invoiceResults.reduce((s, r) => s + r.amount, 0);
    const overdueAR = invoiceResults.filter(r => r.days_past_due > 0).reduce((s, r) => s + r.amount, 0);
    const totalECL = invoiceResults.reduce((s, r) => s + r.expected_credit_loss, 0);
    const totalEngAdjECL = invoiceResults.reduce((s, r) => s + r.engagement_adjusted_ecl, 0);
    const avgCollectability = invoiceResults.length > 0
      ? Math.round(invoiceResults.reduce((s, r) => s + r.collectability_score, 0) / invoiceResults.length)
      : 0;

    const highCount = invoiceResults.filter(r => r.collectability_score >= 80).length;
    const moderateCount = invoiceResults.filter(r => r.collectability_score >= 60 && r.collectability_score < 80).length;
    const atRiskCount = invoiceResults.filter(r => r.collectability_score >= 40 && r.collectability_score < 60).length;
    const highRiskCount = invoiceResults.filter(r => r.collectability_score < 40).length;

    // Engagement breakdown
    const activeEngagement = Array.from(engagementByDebtor.values()).filter(e => e.engagement_score >= 60);
    const noEngagement = Array.from(engagementByDebtor.values()).filter(e => e.engagement_score < 30);

    const activeEngAR = debtorIds
      .filter(d => (engagementByDebtor.get(d)?.engagement_score || 0) >= 60)
      .reduce((s, d) => s + invoiceResults.filter(r => r.debtor_id === d).reduce((ss, r) => ss + r.amount, 0), 0);
    const noEngAR = debtorIds
      .filter(d => (engagementByDebtor.get(d)?.engagement_score || 0) < 30)
      .reduce((s, d) => s + invoiceResults.filter(r => r.debtor_id === d).reduce((ss, r) => ss + r.amount, 0), 0);

    // Top risk accounts
    const debtorProfiles = debtorIds.map(did => {
      const debtorInvs = invoiceResults.filter(r => r.debtor_id === did);
      const debtor = debtorMap.get(did);
      const eng = engagementByDebtor.get(did);
      return {
        debtor_id: did,
        debtor_name: debtor?.company_name || debtor?.name || "Unknown",
        balance: debtorInvs.reduce((s, r) => s + r.amount, 0),
        collectability_score: debtorInvs.length > 0
          ? Math.round(debtorInvs.reduce((s, r) => s + r.collectability_score, 0) / debtorInvs.length) : 0,
        engagement_score: eng?.engagement_score || 0,
        engagement_level: getEngagementLevel(eng?.engagement_score || 0),
        ecl: debtorInvs.reduce((s, r) => s + r.expected_credit_loss, 0),
        engagement_adjusted_ecl: debtorInvs.reduce((s, r) => s + r.engagement_adjusted_ecl, 0),
        recommended_action: debtorInvs[0]?.recommended_action || "Review account",
        conversation_state: eng?.conversation_state || "no_response",
        invoice_count: debtorInvs.length,
      };
    }).sort((a, b) => a.collectability_score - b.collectability_score);

    // 12. Generate AI summary if requested
    let aiInsights = null;
    if (generate_ai_summary) {
      aiInsights = await generateAIInsights(
        totalAR, overdueAR, totalECL, totalEngAdjECL,
        avgCollectability, highCount, moderateCount, atRiskCount, highRiskCount,
        activeEngagement.length, noEngagement.length,
        debtorProfiles.slice(0, 10)
      );
    }

    const response = {
      success: true,
      generated_at: now.toISOString(),
      aggregate: {
        total_ar: Math.round(totalAR * 100) / 100,
        overdue_ar: Math.round(overdueAR * 100) / 100,
        pct_overdue: totalAR > 0 ? Math.round((overdueAR / totalAR) * 10000) / 100 : 0,
        total_ecl: Math.round(totalECL * 100) / 100,
        engagement_adjusted_ecl: Math.round(totalEngAdjECL * 100) / 100,
        pct_at_risk: totalAR > 0 ? Math.round((totalECL / totalAR) * 10000) / 100 : 0,
        avg_collectability: avgCollectability,
        invoice_count: invoiceResults.length,
        debtor_count: debtorIds.length,
        collectability_distribution: {
          high: highCount,
          moderate: moderateCount,
          at_risk: atRiskCount,
          high_risk: highRiskCount,
        },
        engagement_breakdown: {
          active: { count: activeEngagement.length, ar_value: Math.round(activeEngAR * 100) / 100 },
          no_response: { count: noEngagement.length, ar_value: Math.round(noEngAR * 100) / 100 },
          moderate: {
            count: debtorIds.length - activeEngagement.length - noEngagement.length,
            ar_value: Math.round((totalAR - activeEngAR - noEngAR) * 100) / 100,
          },
        },
      },
      top_risk_accounts: debtorProfiles.slice(0, 15),
      invoice_scores: invoiceResults,
      ai_insights: aiInsights,
      disclaimer: "Estimated Collectability & Expected Credit Loss (Operational Model). Not GAAP-certified. For internal decision-making only.",
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[REVENUE-RISK] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ===== ENGAGEMENT SCORING =====

function calculateEngagementScore(
  emails: any[], activities: any[], outcomes: any[], tasks: any[]
): EngagementResult {
  const now = Date.now();
  let score = 50; // baseline
  const breakdown: Record<string, number> = {};

  // Has the debtor responded?
  const hasResponded = emails.length > 0 || activities.some(a => a.responded_at);
  
  // Last response date
  let lastResponseDate: string | null = null;
  let responseRecencyDays: number | null = null;
  if (emails.length > 0) {
    lastResponseDate = emails[0].received_at || emails[0].created_at;
    responseRecencyDays = Math.floor((now - new Date(lastResponseDate).getTime()) / (1000 * 60 * 60 * 24));
  }

  // Response recency scoring
  if (responseRecencyDays !== null) {
    if (responseRecencyDays <= 7) {
      score += 30;
      breakdown.response_recency = 30;
    } else if (responseRecencyDays <= 14) {
      score += 15;
      breakdown.response_recency = 15;
    } else if (responseRecencyDays <= 30) {
      score += 5;
      breakdown.response_recency = 5;
    }
  }

  if (responseRecencyDays !== null && responseRecencyDays > 14) {
    score -= 20;
    breakdown.no_recent_response = -20;
  }
  if (responseRecencyDays !== null && responseRecencyDays > 30) {
    score -= 20; // additional -20 for >30 days (total -40)
    breakdown.no_response_30d = -20;
  }
  if (!hasResponded) {
    score -= 40;
    breakdown.never_responded = -40;
  }

  // Engagement cadence
  let engagementCadence = "none";
  if (emails.length >= 5) {
    engagementCadence = "frequent";
    score += 20;
    breakdown.frequent_engagement = 20;
  } else if (emails.length >= 2) {
    engagementCadence = "moderate";
    score += 10;
    breakdown.moderate_engagement = 10;
  } else if (emails.length >= 1) {
    engagementCadence = "low";
  }

  // Conversation state
  let conversationState = "no_response";
  if (emails.length > 0 && responseRecencyDays !== null && responseRecencyDays <= 7) {
    conversationState = "active_discussion";
  } else if (emails.length > 0 && responseRecencyDays !== null && responseRecencyDays <= 30) {
    conversationState = "awaiting_customer";
  } else if (emails.length > 0) {
    conversationState = "stale";
  }

  // Response type detection
  let responseType: string | null = null;
  let paymentIntentDetected = false;
  const paymentTasks = (tasks || []).filter(t =>
    t.task_type === "PAYMENT_CONFIRMATION" || t.task_type === "PAYMENT_PLAN_REQUEST"
  );
  const disputeTasks = (tasks || []).filter(t => t.task_type === "DISPUTE");
  const docTasks = (tasks || []).filter(t =>
    t.task_type === "W9_REQUEST" || t.task_type === "INVOICE_COPY_REQUEST"
  );

  if (paymentTasks.length > 0) {
    responseType = "payment_related";
    paymentIntentDetected = true;
    score += 10;
    breakdown.payment_intent = 10;
  } else if (disputeTasks.length > 0) {
    responseType = "dispute";
  } else if (docTasks.length > 0) {
    responseType = "document_request";
  } else if (emails.length > 0) {
    responseType = "general_response";
  }

  // Broken promises penalty
  const brokenPromises = (outcomes || []).filter(o =>
    o.outcome_type === "promise_to_pay" &&
    o.promise_to_pay_date &&
    !o.payment_date &&
    new Date(o.promise_to_pay_date) < new Date()
  ).length;

  if (brokenPromises > 0) {
    const penalty = Math.min(50, brokenPromises * 25);
    score -= penalty;
    breakdown.broken_promises = -penalty;
  }

  return {
    engagement_score: Math.max(0, Math.min(100, score)),
    has_responded: hasResponded,
    last_response_date: lastResponseDate,
    response_recency_days: responseRecencyDays,
    engagement_cadence: engagementCadence,
    conversation_state: conversationState,
    response_type: responseType,
    broken_promises_count: brokenPromises,
    payment_intent_detected: paymentIntentDetected,
    score_breakdown: breakdown,
  };
}

// ===== SCORING FUNCTIONS =====

function calculateAgingPenalty(daysPastDue: number): number {
  if (daysPastDue <= 0) return 0;
  if (daysPastDue <= 30) return daysPastDue * 0.5;          // 0-15
  if (daysPastDue <= 60) return 15 + (daysPastDue - 30) * 0.5; // 15-30
  if (daysPastDue <= 90) return 30 + (daysPastDue - 60) * 0.33; // 30-40
  if (daysPastDue <= 120) return 40 + (daysPastDue - 90) * 0.2; // 40-46
  return Math.min(55, 46 + (daysPastDue - 120) * 0.1);
}

function calculateBehavioralPenalty(debtor: any): number {
  if (!debtor) return 10;
  let penalty = 0;

  const score = debtor.payment_score;
  if (score !== null && score !== undefined) {
    penalty += Math.max(0, (100 - score) * 0.2); // 0-20
  }

  if (debtor.avg_days_to_pay && debtor.avg_days_to_pay > 30) {
    penalty += Math.min(5, (debtor.avg_days_to_pay - 30) * 0.15);
  }

  return Math.min(25, penalty);
}

function calculateStatusPenalty(status: string, debtor: any): number {
  let penalty = 0;
  if (status === "Disputed") penalty += 10;
  if (status === "PartiallyPaid") penalty -= 3; // bonus for partial payment
  if (status === "InPaymentPlan") penalty -= 5; // bonus for engagement

  if (debtor?.disputed_invoices_count > 0) penalty += Math.min(5, debtor.disputed_invoices_count * 2);
  if (debtor?.written_off_invoices_count > 0) penalty += Math.min(10, debtor.written_off_invoices_count * 3);

  return Math.max(0, Math.min(15, penalty));
}

function calculateEngagementBoost(engagement: EngagementResult | undefined): number {
  if (!engagement) return 0;
  const score = engagement.engagement_score;
  
  // High engagement reduces risk
  if (score >= 80) return 15;
  if (score >= 60) return 10;
  if (score >= 40) return 0;
  // Low engagement increases risk
  if (score >= 20) return -10;
  return -20;
}

function getCollectabilityTier(score: number): string {
  if (score >= 80) return "High";
  if (score >= 60) return "Moderate";
  if (score >= 40) return "At Risk";
  return "High Risk";
}

function getProbabilityOfDefault(score: number): number {
  if (score >= 80) return 0.02;
  if (score >= 60) return 0.05;
  if (score >= 40) return 0.15;
  return 0.30;
}

function getEngagementAdjustedPD(basePD: number, engagement: EngagementResult | undefined): number {
  if (!engagement) return basePD;
  const score = engagement.engagement_score;

  if (score >= 70 && engagement.payment_intent_detected) {
    return basePD * 0.5; // 50% reduction
  }
  if (score >= 60) {
    return basePD * 0.7; // 30% reduction
  }
  if (score < 30) {
    return Math.min(0.5, basePD * 1.4); // 40% increase
  }
  if (score < 20) {
    return Math.min(0.6, basePD * 1.5); // 50% increase
  }
  return basePD;
}

function getPaymentLikelihood(score: number): string {
  if (score >= 85) return "Very Likely";
  if (score >= 70) return "Likely";
  if (score >= 50) return "Moderate";
  if (score >= 30) return "Unlikely";
  return "Very Unlikely";
}

function getEngagementLevel(score: number): string {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "none";
}

function getEngagementRiskImpact(level: string): string {
  if (level === "high") return "reduces_risk";
  if (level === "medium") return "neutral";
  return "increases_risk";
}

function getRiskClassification(score: number): string {
  if (score >= 80) return "low";
  if (score >= 60) return "moderate";
  if (score >= 40) return "elevated";
  return "high";
}

function identifyRiskFactors(
  daysPastDue: number, amount: number, debtor: any, engagement: EngagementResult | undefined, status: string
): string[] {
  const factors: string[] = [];
  if (daysPastDue > 90) factors.push("Severely overdue (90+ days)");
  else if (daysPastDue > 60) factors.push("Significantly overdue (60+ days)");
  else if (daysPastDue > 30) factors.push("Moderately overdue (30+ days)");

  if (amount > 10000) factors.push("High value invoice");
  if (debtor?.payment_score !== null && debtor?.payment_score < 50) factors.push("Poor account payment history");
  if (status === "Disputed") factors.push("Invoice is disputed");

  if (!engagement?.has_responded) factors.push("No debtor response on record");
  else if (engagement.response_recency_days && engagement.response_recency_days > 30) factors.push("No response in 30+ days");

  if (engagement?.broken_promises_count && engagement.broken_promises_count > 0) {
    factors.push(`${engagement.broken_promises_count} broken promise(s) to pay`);
  }

  if (factors.length === 0) factors.push("No significant risk factors");
  return factors;
}

function getRecommendedAction(
  score: number, daysPastDue: number, status: string, engagement: EngagementResult | undefined
): string {
  if (status === "InPaymentPlan") return "Monitor payment plan progress";

  if (score >= 80) return daysPastDue <= 7 ? "Send friendly reminder" : "Continue standard workflow";

  if (score >= 60) {
    if (!engagement?.has_responded) return "Escalate outreach — no response detected";
    return "Increase collection frequency";
  }

  if (score >= 40) {
    if (engagement?.conversation_state === "active_discussion") return "Continue negotiation — engagement active";
    if (status === "Disputed") return "Resolve dispute before escalating";
    return "Consider settlement offer or payment plan";
  }

  if (!engagement?.has_responded) return "Priority escalation — high risk, no engagement";
  if (daysPastDue > 120) return "Evaluate for write-off or third-party collection";
  return "Implement aggressive collection strategy";
}

// ===== AI INSIGHTS =====

async function generateAIInsights(
  totalAR: number, overdueAR: number, totalECL: number, engAdjECL: number,
  avgCollectability: number, high: number, moderate: number, atRisk: number, highRisk: number,
  activeEngCount: number, noEngCount: number,
  topRiskAccounts: any[]
): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  const prompt = `Analyze this AR portfolio risk data and provide actionable intelligence:

Portfolio:
- Total AR: $${totalAR.toLocaleString()}
- Overdue AR: $${overdueAR.toLocaleString()} (${totalAR > 0 ? ((overdueAR/totalAR)*100).toFixed(1) : 0}%)
- Expected Credit Loss: $${totalECL.toLocaleString()}
- Engagement-Adjusted ECL: $${engAdjECL.toLocaleString()}
- Avg Collectability: ${avgCollectability}%

Distribution: High=${high}, Moderate=${moderate}, At Risk=${atRisk}, High Risk=${highRisk}
Active engagement: ${activeEngCount} accounts, No response: ${noEngCount} accounts

Top risk accounts:
${topRiskAccounts.slice(0, 5).map(a => `- ${a.debtor_name}: $${a.balance.toLocaleString()}, Score: ${a.collectability_score}, Engagement: ${a.engagement_level}`).join("\n")}`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an AR Risk Intelligence analyst. Provide concise, actionable analysis." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_insights",
            description: "Return structured risk insights",
            parameters: {
              type: "object",
              properties: {
                risk_summary: { type: "string", description: "2-3 sentence risk overview" },
                engagement_insight: { type: "string", description: "Key insight about engagement vs risk" },
                recommendations: { type: "array", items: { type: "string" }, description: "3-5 prioritized recommendations" },
                key_drivers: { type: "array", items: { type: "string" }, description: "Top 3 risk drivers" },
              },
              required: ["risk_summary", "engagement_insight", "recommendations", "key_drivers"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_insights" } },
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      return JSON.parse(toolCall.function.arguments);
    }
    return null;
  } catch {
    return null;
  }
}

// ===== HELPERS =====

function groupBy(arr: any[], key: string): Record<string, any[]> {
  return arr.reduce((acc, item) => {
    const k = item[key];
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, any[]>);
}
