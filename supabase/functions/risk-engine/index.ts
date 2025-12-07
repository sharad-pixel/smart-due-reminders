import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// ENTERPRISE-GRADE COLLECTIONS SCORING SYSTEM
// ============================================
// 
// Two computed scores per account:
// 1. Collections Health Score (0-100) - Higher is better
// 2. Collections Risk Score (0-100) - Higher is riskier
//
// Health Score Formula:
//   = (0.35 × Payment History Score)
//   + (0.30 × Days Past Due Score)
//   + (0.20 × Outstanding Balance Score)
//   + (0.15 × AI Sentiment Score)
//
// Risk Score Formula:
//   = (0.40 × DPD Risk)
//   + (0.25 × Negative Payment Trend)
//   + (0.20 × AI Sentiment Risk)
//   + (0.15 × Balance Concentration Risk)

interface EnterpriseScoreResult {
  // Health scoring (higher = healthier)
  collections_health_score: number | null;
  health_tier: string;
  
  // Risk scoring (higher = riskier)
  collections_risk_score: number | null;
  risk_tier_detailed: string;
  
  // AI Sentiment
  ai_sentiment_score: number | null;
  ai_sentiment_category: string | null;
  
  // Legacy fields for backward compatibility
  risk_payment_score: number | null;
  risk_tier: string;
  risk_status_note: string;
  
  // Metadata
  basis_invoices_count: number;
  basis_payments_count: number;
  basis_days_observed: number;
  score_components: ScoreComponents;
  last_score_change_reason: string;
}

interface ScoreComponents {
  // Health Score Components (0-100 each, before weighting)
  payment_history_score: number;
  dpd_score: number;
  outstanding_balance_score: number;
  ai_sentiment_health_score: number;
  
  // Risk Score Components (0-100 each, before weighting)
  dpd_risk: number;
  negative_payment_trend: number;
  ai_sentiment_risk: number;
  balance_concentration_risk: number;
  
  // Raw data
  data_sufficient: boolean;
  on_time_payment_pct: number;
  avg_days_late: number;
  broken_promises_count: number;
  max_dpd: number;
  total_outstanding: number;
  high_aging_concentration_pct: number;
  engagement_rate: number;
  
  // Detailed breakdown for explainability
  penalties: { reason: string; amount: number; category: string }[];
}

interface Invoice {
  id: string;
  amount: number;
  outstanding_amount: number;
  status: string;
  invoice_date: string;
  due_date: string;
  payment_date: string | null;
  aging_bucket: string;
}

interface InboundEmail {
  id: string;
  ai_sentiment_category: string | null;
  ai_sentiment_score: number | null;
  created_at: string;
}

interface CollectionActivity {
  id: string;
  activity_type: string;
  channel: string;
  opened_at: string | null;
  responded_at: string | null;
  created_at: string;
}

interface CollectionOutcome {
  id: string;
  outcome_type: string;
  promise_to_pay_date: string | null;
  payment_date: string | null;
  created_at: string;
}

interface SentimentConfig {
  category: string;
  health_score_value: number;
  risk_score_value: number;
}

// Data sufficiency thresholds
const MIN_INVOICES = 3;
const MIN_PAYMENTS = 2;
const MIN_DAYS_OBSERVED = 60;

// Tier thresholds
const HEALTH_TIERS = {
  HEALTHY: { min: 75, label: 'Healthy', color: 'green' },
  WATCH: { min: 50, label: 'Watch', color: 'yellow' },
  AT_RISK: { min: 25, label: 'At Risk', color: 'orange' },
  CRITICAL: { min: 0, label: 'Critical', color: 'red' }
};

const RISK_TIERS = {
  LOW: { max: 25, label: 'Low Risk', color: 'green' },
  MEDIUM: { max: 50, label: 'Medium Risk', color: 'yellow' },
  HIGH: { max: 75, label: 'High Risk', color: 'orange' },
  CRITICAL: { max: 100, label: 'Critical Risk', color: 'red' }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { debtor_id, recalculate_all, user_id, analyze_sentiment } = await req.json();

    // Load sentiment configuration
    const { data: sentimentConfigs } = await supabase
      .from('sentiment_score_config')
      .select('*');
    
    const sentimentConfigMap = new Map<string, SentimentConfig>();
    (sentimentConfigs || []).forEach((cfg: SentimentConfig) => {
      sentimentConfigMap.set(cfg.category, cfg);
    });

    let targetDebtorIds: string[] = [];
    let targetUserId: string | null = user_id || null;

    if (recalculate_all && user_id) {
      const { data: debtors, error } = await supabase
        .from('debtors')
        .select('id')
        .eq('user_id', user_id)
        .eq('is_archived', false);

      if (error) throw error;
      targetDebtorIds = debtors?.map(d => d.id) || [];
    } else if (debtor_id) {
      targetDebtorIds = [debtor_id];
      
      if (!targetUserId) {
        const { data: debtor } = await supabase
          .from('debtors')
          .select('user_id')
          .eq('id', debtor_id)
          .single();
        targetUserId = debtor?.user_id;
      }
    } else if (recalculate_all && !user_id) {
      const { data: debtors, error } = await supabase
        .from('debtors')
        .select('id, user_id')
        .eq('is_archived', false);

      if (error) throw error;
      targetDebtorIds = debtors?.map(d => d.id) || [];
    }

    console.log(`[RISK-ENGINE] Processing ${targetDebtorIds.length} debtors with enterprise scoring`);

    const results: EnterpriseScoreResult[] = [];

    for (const debtorId of targetDebtorIds) {
      try {
        const result = await calculateEnterpriseScore(supabase, debtorId, sentimentConfigMap, analyze_sentiment);
        results.push(result);
      } catch (err) {
        console.error(`[RISK-ENGINE] Error processing debtor ${debtorId}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[RISK-ENGINE] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Main enterprise scoring calculation for a single debtor
 */
async function calculateEnterpriseScore(
  supabase: any,
  debtorId: string,
  sentimentConfigMap: Map<string, SentimentConfig>,
  analyzeSentiment: boolean = false
): Promise<EnterpriseScoreResult> {
  // Get debtor info with previous scores for change tracking
  const { data: debtor, error: debtorError } = await supabase
    .from('debtors')
    .select('*')
    .eq('id', debtorId)
    .single();

  if (debtorError || !debtor) {
    throw new Error(`Debtor not found: ${debtorId}`);
  }

  const previousHealthScore = debtor.collections_health_score;
  const previousRiskScore = debtor.collections_risk_score;
  const previousHealthTier = debtor.health_tier;

  // Get all invoices
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('debtor_id', debtorId)
    .order('invoice_date', { ascending: true });

  // Get collection activities
  const { data: activities } = await supabase
    .from('collection_activities')
    .select('*')
    .eq('debtor_id', debtorId);

  // Get collection outcomes (for broken promises tracking)
  const { data: outcomes } = await supabase
    .from('collection_outcomes')
    .select('*')
    .eq('debtor_id', debtorId);

  // Get inbound emails for sentiment analysis
  const { data: inboundEmails } = await supabase
    .from('inbound_emails')
    .select('id, ai_sentiment_category, ai_sentiment_score, created_at')
    .eq('debtor_id', debtorId)
    .order('created_at', { ascending: false })
    .limit(20);

  // Calculate data sufficiency
  const invoiceCount = invoices?.length || 0;
  const paidInvoices = (invoices || []).filter((inv: Invoice) => 
    inv.status === 'Paid' || inv.status === 'Settled' || inv.payment_date
  );
  const paymentCount = paidInvoices.length;

  let daysObserved = 0;
  if (invoices && invoices.length > 0) {
    const firstInvoiceDate = new Date(invoices[0].invoice_date);
    daysObserved = Math.floor((Date.now() - firstInvoiceDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  const isDataSufficient = 
    invoiceCount >= MIN_INVOICES && 
    paymentCount >= MIN_PAYMENTS && 
    daysObserved >= MIN_DAYS_OBSERVED;

  let result: EnterpriseScoreResult;

  if (!isDataSufficient) {
    result = createInsufficientDataResult(invoiceCount, paymentCount, daysObserved);
  } else {
    result = calculateFullEnterpriseScore(
      invoices || [],
      activities || [],
      outcomes || [],
      inboundEmails || [],
      sentimentConfigMap,
      invoiceCount,
      paymentCount,
      daysObserved
    );
  }

  // Determine change reason
  let changeReason = 'Initial calculation';
  if (previousHealthScore !== null) {
    const healthDiff = (result.collections_health_score || 0) - previousHealthScore;
    const riskDiff = (result.collections_risk_score || 0) - (previousRiskScore || 0);
    
    if (Math.abs(healthDiff) >= 5 || Math.abs(riskDiff) >= 5) {
      const reasons: string[] = [];
      
      if (result.score_components.penalties.length > 0) {
        const topPenalties = result.score_components.penalties
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 3)
          .map(p => p.reason);
        reasons.push(...topPenalties);
      }
      
      if (healthDiff > 0) reasons.unshift('Improved payment behavior');
      if (healthDiff < 0) reasons.unshift('Declining payment behavior');
      
      changeReason = reasons.join('; ');
    } else {
      changeReason = 'Routine recalculation - minimal change';
    }
  }

  result.last_score_change_reason = changeReason;

  // Update debtor record
  await supabase
    .from('debtors')
    .update({
      // New enterprise fields
      collections_health_score: result.collections_health_score,
      collections_risk_score: result.collections_risk_score,
      health_tier: result.health_tier,
      risk_tier_detailed: result.risk_tier_detailed,
      ai_sentiment_score: result.ai_sentiment_score,
      ai_sentiment_category: result.ai_sentiment_category,
      score_components: result.score_components,
      last_score_change_reason: changeReason,
      
      // Legacy fields for backward compatibility
      payment_score: result.risk_payment_score,
      payment_risk_tier: result.risk_tier,
      risk_status_note: result.risk_status_note,
      risk_last_calculated_at: new Date().toISOString()
    })
    .eq('id', debtorId);

  // Insert history snapshot
  await supabase
    .from('debtor_risk_history')
    .insert({
      debtor_id: debtorId,
      user_id: debtor.user_id,
      // Enterprise fields
      collections_health_score: result.collections_health_score,
      collections_risk_score: result.collections_risk_score,
      health_tier: result.health_tier,
      ai_sentiment_score: result.ai_sentiment_score,
      score_components: result.score_components,
      // Legacy fields
      risk_payment_score: result.risk_payment_score,
      risk_tier: result.risk_tier,
      risk_status_note: result.risk_status_note,
      basis_invoices_count: result.basis_invoices_count,
      basis_payments_count: result.basis_payments_count,
      basis_days_observed: result.basis_days_observed,
      calculation_details: result.score_components
    });

  // Log significant score changes for auditability
  if (previousHealthScore !== null && 
      (Math.abs((result.collections_health_score || 0) - previousHealthScore) >= 5 ||
       Math.abs((result.collections_risk_score || 0) - (previousRiskScore || 0)) >= 5)) {
    await supabase
      .from('score_change_logs')
      .insert({
        debtor_id: debtorId,
        user_id: debtor.user_id,
        change_type: 'recalculation',
        old_health_score: previousHealthScore,
        new_health_score: result.collections_health_score,
        old_risk_score: previousRiskScore,
        new_risk_score: result.collections_risk_score,
        old_health_tier: previousHealthTier,
        new_health_tier: result.health_tier,
        change_reason: changeReason,
        score_components: result.score_components
      });
  }

  console.log(`[RISK-ENGINE] Debtor ${debtorId}: Health=${result.collections_health_score}, Risk=${result.collections_risk_score}, Tiers=${result.health_tier}/${result.risk_tier_detailed}`);

  return result;
}

/**
 * Create result for accounts with insufficient history
 */
function createInsufficientDataResult(
  invoiceCount: number,
  paymentCount: number,
  daysObserved: number
): EnterpriseScoreResult {
  return {
    collections_health_score: null,
    health_tier: 'Still Learning',
    collections_risk_score: null,
    risk_tier_detailed: 'Insufficient Data',
    ai_sentiment_score: null,
    ai_sentiment_category: null,
    risk_payment_score: null,
    risk_tier: 'Still learning',
    risk_status_note: `Insufficient history – still learning this account's behavior. (${invoiceCount} invoices, ${paymentCount} payments, ${daysObserved} days observed)`,
    basis_invoices_count: invoiceCount,
    basis_payments_count: paymentCount,
    basis_days_observed: daysObserved,
    score_components: {
      payment_history_score: 0,
      dpd_score: 0,
      outstanding_balance_score: 0,
      ai_sentiment_health_score: 50,
      dpd_risk: 0,
      negative_payment_trend: 0,
      ai_sentiment_risk: 50,
      balance_concentration_risk: 0,
      data_sufficient: false,
      on_time_payment_pct: 0,
      avg_days_late: 0,
      broken_promises_count: 0,
      max_dpd: 0,
      total_outstanding: 0,
      high_aging_concentration_pct: 0,
      engagement_rate: 0,
      penalties: []
    },
    last_score_change_reason: 'Insufficient data for scoring'
  };
}

/**
 * Calculate full enterprise scores with all components
 */
function calculateFullEnterpriseScore(
  invoices: Invoice[],
  activities: CollectionActivity[],
  outcomes: CollectionOutcome[],
  inboundEmails: InboundEmail[],
  sentimentConfigMap: Map<string, SentimentConfig>,
  invoiceCount: number,
  paymentCount: number,
  daysObserved: number
): EnterpriseScoreResult {
  const penalties: { reason: string; amount: number; category: string }[] = [];

  // Categorize invoices
  const paidInvoices = invoices.filter(inv => 
    inv.status === 'Paid' || inv.status === 'Settled' || inv.payment_date
  );
  const openInvoices = invoices.filter(inv => 
    inv.status === 'Open' || inv.status === 'InPaymentPlan' || inv.status === 'PartiallyPaid'
  );

  // =============================================
  // COMPONENT 1: Payment History Score (0-100)
  // Based on: on-time %, avg days late, broken promises
  // =============================================
  let onTimeCount = 0;
  let totalDaysLate = 0;
  let latePaymentCount = 0;

  for (const inv of paidInvoices) {
    if (inv.payment_date && inv.due_date) {
      const paymentDate = new Date(inv.payment_date);
      const dueDate = new Date(inv.due_date);
      const daysLate = Math.floor((paymentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysLate <= 0) {
        onTimeCount++;
      } else {
        latePaymentCount++;
        totalDaysLate += daysLate;
      }
    }
  }

  const onTimePct = paidInvoices.length > 0 ? (onTimeCount / paidInvoices.length) * 100 : 50;
  const avgDaysLate = latePaymentCount > 0 ? totalDaysLate / latePaymentCount : 0;

  // Count broken promises (promise to pay that wasn't fulfilled)
  const brokenPromises = (outcomes || []).filter(o => 
    o.outcome_type === 'promise_to_pay' && 
    o.promise_to_pay_date && 
    !o.payment_date &&
    new Date(o.promise_to_pay_date) < new Date()
  ).length;

  // Calculate Payment History Score (0-100)
  let paymentHistoryScore = 100;
  
  // Deduct for late payment percentage
  const latePct = 100 - onTimePct;
  paymentHistoryScore -= latePct * 0.5; // 50% weight on late payment rate
  
  // Deduct for average days late (max 30 point deduction)
  const avgLatePenalty = Math.min(avgDaysLate / 3, 30);
  paymentHistoryScore -= avgLatePenalty;
  
  // Deduct for broken promises (10 pts each, max 20)
  paymentHistoryScore -= Math.min(brokenPromises * 10, 20);
  
  paymentHistoryScore = clamp(paymentHistoryScore, 0, 100);

  if (onTimePct < 50) {
    penalties.push({ reason: `Low on-time payment rate (${Math.round(onTimePct)}%)`, amount: 25, category: 'payment_history' });
  }
  if (avgDaysLate > 30) {
    penalties.push({ reason: `High average days late (${Math.round(avgDaysLate)} days)`, amount: 20, category: 'payment_history' });
  }
  if (brokenPromises > 0) {
    penalties.push({ reason: `Broken payment promises (${brokenPromises})`, amount: brokenPromises * 10, category: 'payment_history' });
  }

  // =============================================
  // COMPONENT 2: Days Past Due Score (0-100)
  // Based on: max DPD across open invoices
  // =============================================
  let maxDPD = 0;
  for (const inv of openInvoices) {
    const dueDate = new Date(inv.due_date);
    const dpd = Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
    maxDPD = Math.max(maxDPD, dpd);
  }

  // DPD Score: 100 at 0 DPD, decreases as DPD increases
  // At 120+ DPD, score is 0
  const dpdScore = Math.max(0, 100 - (maxDPD / 1.2));

  // DPD Risk: 0 at 0 DPD, increases as DPD increases
  // At 120+ DPD, risk is 100
  const dpdRisk = Math.min(100, maxDPD / 1.2);

  if (maxDPD > 90) {
    penalties.push({ reason: `Critical DPD (${maxDPD} days)`, amount: 30, category: 'dpd' });
  } else if (maxDPD > 60) {
    penalties.push({ reason: `High DPD (${maxDPD} days)`, amount: 20, category: 'dpd' });
  } else if (maxDPD > 30) {
    penalties.push({ reason: `Elevated DPD (${maxDPD} days)`, amount: 10, category: 'dpd' });
  }

  // =============================================
  // COMPONENT 3: Outstanding Balance Score (0-100)
  // Based on: total outstanding and aging concentration
  // =============================================
  const totalOutstanding = openInvoices.reduce((sum, inv) => 
    sum + (inv.outstanding_amount || inv.amount || 0), 0
  );

  let highAgingAmount = 0;
  for (const inv of openInvoices) {
    const bucket = inv.aging_bucket || '';
    if (['dpd_61_90', 'dpd_91_120', 'dpd_121_150', 'dpd_150_plus'].includes(bucket)) {
      highAgingAmount += inv.outstanding_amount || inv.amount || 0;
    }
  }

  const highAgingConcentration = totalOutstanding > 0 ? (highAgingAmount / totalOutstanding) * 100 : 0;

  // Outstanding Balance Score: Penalize high aging concentration
  let outstandingBalanceScore = 100 - highAgingConcentration;
  outstandingBalanceScore = clamp(outstandingBalanceScore, 0, 100);

  // Balance Concentration Risk
  const balanceConcentrationRisk = highAgingConcentration;

  if (highAgingConcentration > 50) {
    penalties.push({ reason: `High aging concentration (${Math.round(highAgingConcentration)}% in 60+ days)`, amount: 25, category: 'balance' });
  }

  // =============================================
  // COMPONENT 4: AI Sentiment Score (0-100)
  // Based on: recent inbound email sentiment analysis
  // =============================================
  let aiSentimentHealthScore = 50; // Default neutral
  let aiSentimentRisk = 50;
  let latestSentimentCategory: string | null = null;
  let latestSentimentScore: number | null = null;

  // Get most recent sentiment from inbound emails
  const emailsWithSentiment = (inboundEmails || []).filter(e => e.ai_sentiment_category);
  
  if (emailsWithSentiment.length > 0) {
    // Weight recent emails more heavily
    let totalWeight = 0;
    let weightedHealthSum = 0;
    let weightedRiskSum = 0;

    emailsWithSentiment.forEach((email, index) => {
      const weight = 1 / (index + 1); // More recent = higher weight
      const config = sentimentConfigMap.get(email.ai_sentiment_category || 'neutral');
      
      if (config) {
        weightedHealthSum += config.health_score_value * weight;
        weightedRiskSum += config.risk_score_value * weight;
        totalWeight += weight;
      }
    });

    if (totalWeight > 0) {
      aiSentimentHealthScore = weightedHealthSum / totalWeight;
      aiSentimentRisk = weightedRiskSum / totalWeight;
    }

    // Store most recent sentiment
    latestSentimentCategory = emailsWithSentiment[0]?.ai_sentiment_category || null;
    latestSentimentScore = emailsWithSentiment[0]?.ai_sentiment_score || null;

    if (aiSentimentHealthScore < 30) {
      penalties.push({ reason: `Negative sentiment detected (${latestSentimentCategory})`, amount: 20, category: 'sentiment' });
    }
  } else {
    // No response = no_response category
    const noResponseConfig = sentimentConfigMap.get('no_response');
    if (noResponseConfig) {
      aiSentimentHealthScore = noResponseConfig.health_score_value;
      aiSentimentRisk = noResponseConfig.risk_score_value;
      latestSentimentCategory = 'no_response';
    }
  }

  // =============================================
  // COMPONENT 5: Negative Payment Trend (0-100)
  // Based on: trend of payment behavior over time
  // =============================================
  let negativePaymentTrend = 0;
  
  // Split payments into recent (last 90 days) vs older
  const now = Date.now();
  const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);
  
  const recentPaidInvoices = paidInvoices.filter(inv => 
    inv.payment_date && new Date(inv.payment_date).getTime() > ninetyDaysAgo
  );
  const olderPaidInvoices = paidInvoices.filter(inv => 
    inv.payment_date && new Date(inv.payment_date).getTime() <= ninetyDaysAgo
  );

  if (recentPaidInvoices.length >= 2 && olderPaidInvoices.length >= 2) {
    // Calculate average days to pay for each period
    const recentAvgDays = calculateAvgDaysToPay(recentPaidInvoices);
    const olderAvgDays = calculateAvgDaysToPay(olderPaidInvoices);
    
    // Negative trend if recent payments are slower
    if (recentAvgDays > olderAvgDays) {
      const trendDiff = recentAvgDays - olderAvgDays;
      negativePaymentTrend = Math.min(100, trendDiff * 2);
      
      if (trendDiff > 15) {
        penalties.push({ reason: `Payment behavior worsening (${Math.round(trendDiff)} days slower)`, amount: 15, category: 'trend' });
      }
    }
  }

  // =============================================
  // CALCULATE FINAL SCORES
  // =============================================

  // Collections Health Score (weighted average)
  const collectionsHealthScore = Math.round(
    (0.35 * paymentHistoryScore) +
    (0.30 * dpdScore) +
    (0.20 * outstandingBalanceScore) +
    (0.15 * aiSentimentHealthScore)
  );

  // Collections Risk Score (weighted average)
  const collectionsRiskScore = Math.round(
    (0.40 * dpdRisk) +
    (0.25 * negativePaymentTrend) +
    (0.20 * aiSentimentRisk) +
    (0.15 * balanceConcentrationRisk)
  );

  // Determine tiers
  const healthTier = getHealthTier(collectionsHealthScore);
  const riskTierDetailed = getRiskTier(collectionsRiskScore);

  // Legacy risk tier (for backward compatibility)
  const legacyRiskTier = getLegacyRiskTier(collectionsHealthScore);

  // Calculate engagement rate
  const outboundActivities = (activities || []).filter(a => a.activity_type === 'outbound');
  const respondedActivities = outboundActivities.filter(a => a.responded_at);
  const engagementRate = outboundActivities.length > 0 
    ? (respondedActivities.length / outboundActivities.length) * 100 
    : 0;

  return {
    collections_health_score: collectionsHealthScore,
    health_tier: healthTier,
    collections_risk_score: collectionsRiskScore,
    risk_tier_detailed: riskTierDetailed,
    ai_sentiment_score: latestSentimentScore,
    ai_sentiment_category: latestSentimentCategory,
    
    // Legacy fields
    risk_payment_score: collectionsHealthScore, // Use health score for legacy
    risk_tier: legacyRiskTier,
    risk_status_note: generateStatusNote(healthTier, riskTierDetailed, penalties),
    
    basis_invoices_count: invoiceCount,
    basis_payments_count: paymentCount,
    basis_days_observed: daysObserved,
    score_components: {
      payment_history_score: Math.round(paymentHistoryScore),
      dpd_score: Math.round(dpdScore),
      outstanding_balance_score: Math.round(outstandingBalanceScore),
      ai_sentiment_health_score: Math.round(aiSentimentHealthScore),
      dpd_risk: Math.round(dpdRisk),
      negative_payment_trend: Math.round(negativePaymentTrend),
      ai_sentiment_risk: Math.round(aiSentimentRisk),
      balance_concentration_risk: Math.round(balanceConcentrationRisk),
      data_sufficient: true,
      on_time_payment_pct: Math.round(onTimePct),
      avg_days_late: Math.round(avgDaysLate),
      broken_promises_count: brokenPromises,
      max_dpd: maxDPD,
      total_outstanding: totalOutstanding,
      high_aging_concentration_pct: Math.round(highAgingConcentration),
      engagement_rate: Math.round(engagementRate),
      penalties
    },
    last_score_change_reason: ''
  };
}

function calculateAvgDaysToPay(invoices: Invoice[]): number {
  if (invoices.length === 0) return 0;
  
  let totalDays = 0;
  let count = 0;
  
  for (const inv of invoices) {
    if (inv.payment_date && inv.invoice_date) {
      const paymentDate = new Date(inv.payment_date);
      const invoiceDate = new Date(inv.invoice_date);
      const days = Math.floor((paymentDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
      totalDays += Math.max(0, days);
      count++;
    }
  }
  
  return count > 0 ? totalDays / count : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getHealthTier(score: number): string {
  if (score >= HEALTH_TIERS.HEALTHY.min) return HEALTH_TIERS.HEALTHY.label;
  if (score >= HEALTH_TIERS.WATCH.min) return HEALTH_TIERS.WATCH.label;
  if (score >= HEALTH_TIERS.AT_RISK.min) return HEALTH_TIERS.AT_RISK.label;
  return HEALTH_TIERS.CRITICAL.label;
}

function getRiskTier(score: number): string {
  if (score <= RISK_TIERS.LOW.max) return RISK_TIERS.LOW.label;
  if (score <= RISK_TIERS.MEDIUM.max) return RISK_TIERS.MEDIUM.label;
  if (score <= RISK_TIERS.HIGH.max) return RISK_TIERS.HIGH.label;
  return RISK_TIERS.CRITICAL.label;
}

function getLegacyRiskTier(healthScore: number): string {
  if (healthScore >= 85) return 'Low';
  if (healthScore >= 70) return 'Medium';
  if (healthScore >= 50) return 'High';
  return 'Critical';
}

function generateStatusNote(healthTier: string, riskTier: string, penalties: { reason: string }[]): string {
  const topPenalties = penalties.slice(0, 2).map(p => p.reason).join('. ');
  return `${healthTier} health, ${riskTier}. ${topPenalties}`.trim();
}