import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// CREDIT RISK INTELLIGENCE ENGINE
// ============================================
// Modeled after: FICO SBSS, D&B PAYDEX, Experian Intelliscore, Moody's
// 
// Risk Score (1-100): Higher = Riskier
// Risk Tier: Low / Medium / High / Critical
//
// SCORING WEIGHTS:
// A. Invoice Behavior (50%)
//    - Average DPD last 6 months
//    - % of invoices >30, >60, >90 days
//    - Outstanding balance vs historical average
//    - Frequency of partial payments
//    - Broken promises-to-pay
//    - Month-to-month volatility
//
// B. Payment Patterns & Trends (20%)
//    - Early vs late payment ratio
//    - Payment disputes count
//    - Recency & consistency of payments
//    - Largest overdue invoice amount
//    - Payment method reliability
//
// C. Customer Health Indicators (15%)
//    - Industry risk (B2B vs B2C)
//    - Customer size/type
//    - Concentration risk (>15% of AR?)
//    - Seasonality/revenue fluctuations
//
// D. Operational Signals (15%)
//    - Email sentiment
//    - Response time to outreach
//    - Engagement pattern (opens, replies)
//    - Escalations, disputes, stalled conversations
//    - Missing docs (W9, PO requirements)

interface CreditRiskResult {
  // Risk scoring (1-100, higher = riskier)
  credit_risk_score: number | null;
  risk_tier: string;
  
  // Legacy health score for UI compatibility (0-100, higher = healthier)
  collections_health_score: number | null;
  health_tier: string;
  
  // AI Sentiment
  ai_sentiment_score: number | null;
  ai_sentiment_category: string | null;
  
  // Legacy fields for backward compatibility
  collections_risk_score: number | null;
  risk_tier_detailed: string;
  risk_payment_score: number | null;
  risk_status_note: string;
  
  // Metadata
  basis_invoices_count: number;
  basis_payments_count: number;
  basis_days_observed: number;
  score_components: ScoreComponents;
  last_score_change_reason: string;
}

interface ScoreComponents {
  // A. Invoice Behavior (50%)
  invoice_behavior_score: number;
  avg_dpd_last_6_months: number;
  pct_over_30_days: number;
  pct_over_60_days: number;
  pct_over_90_days: number;
  partial_payment_frequency: number;
  broken_promises_count: number;
  volatility_score: number;
  
  // B. Payment Patterns (20%)
  payment_patterns_score: number;
  early_vs_late_ratio: number;
  payment_disputes_count: number;
  payment_recency_days: number;
  largest_overdue_amount: number;
  
  // C. Customer Health (15%)
  customer_health_score: number;
  customer_type: string;
  concentration_risk_pct: number;
  
  // D. Operational Signals (15%)
  operational_signals_score: number;
  email_sentiment_score: number;
  response_time_avg_days: number;
  engagement_rate: number;
  escalation_count: number;
  missing_docs_count: number;
  
  // Raw data
  data_sufficient: boolean;
  max_dpd: number;
  total_outstanding: number;
  
  // Detailed breakdown for explainability
  penalties: { reason: string; amount: number; category: string }[];
  factors: { factor: string; impact: string; value: string }[];
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

interface Debtor {
  id: string;
  user_id: string;
  type: string;
  total_open_balance: number;
  collections_health_score: number | null;
  collections_risk_score: number | null;
  health_tier: string | null;
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
  sent_at: string | null;
}

interface CollectionOutcome {
  id: string;
  outcome_type: string;
  promise_to_pay_date: string | null;
  payment_date: string | null;
  created_at: string;
}

interface CollectionTask {
  id: string;
  task_type: string;
  status: string;
  priority: string;
  level: string | null;
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

// Tier thresholds (Risk Score based - higher is worse)
const RISK_TIERS = {
  LOW: { max: 30, label: 'Low', color: 'green' },
  MEDIUM: { max: 55, label: 'Medium', color: 'yellow' },
  HIGH: { max: 75, label: 'High', color: 'orange' },
  CRITICAL: { max: 100, label: 'Critical', color: 'red' }
};

// Health tiers (inverted from risk - higher is better)
const HEALTH_TIERS = {
  HEALTHY: { min: 70, label: 'Healthy', color: 'green' },
  WATCH: { min: 45, label: 'Watch', color: 'yellow' },
  AT_RISK: { min: 25, label: 'At Risk', color: 'orange' },
  CRITICAL: { min: 0, label: 'Critical', color: 'red' }
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

    // Get total AR for concentration risk calculation
    let totalARByUser = new Map<string, number>();

    let targetDebtorIds: string[] = [];
    let targetUserId: string | null = user_id || null;

    if (recalculate_all && user_id) {
      const { data: debtors, error } = await supabase
        .from('debtors')
        .select('id, total_open_balance')
        .eq('user_id', user_id)
        .eq('is_archived', false);

      if (error) throw error;
      targetDebtorIds = debtors?.map(d => d.id) || [];
      
      // Calculate total AR for this user
      const totalAR = debtors?.reduce((sum, d) => sum + (d.total_open_balance || 0), 0) || 0;
      totalARByUser.set(user_id, totalAR);
    } else if (debtor_id) {
      targetDebtorIds = [debtor_id];
      
      const { data: debtor } = await supabase
        .from('debtors')
        .select('user_id, total_open_balance')
        .eq('id', debtor_id)
        .single();
      
      if (debtor) {
        targetUserId = debtor.user_id;
        
        // Get total AR for this user
        const { data: allDebtors } = await supabase
          .from('debtors')
          .select('total_open_balance')
          .eq('user_id', debtor.user_id)
          .eq('is_archived', false);
        
        const totalAR = allDebtors?.reduce((sum, d) => sum + (d.total_open_balance || 0), 0) || 0;
        totalARByUser.set(debtor.user_id, totalAR);
      }
    } else if (recalculate_all && !user_id) {
      const { data: debtors, error } = await supabase
        .from('debtors')
        .select('id, user_id, total_open_balance')
        .eq('is_archived', false);

      if (error) throw error;
      targetDebtorIds = debtors?.map(d => d.id) || [];
      
      // Calculate total AR per user
      for (const d of debtors || []) {
        const current = totalARByUser.get(d.user_id) || 0;
        totalARByUser.set(d.user_id, current + (d.total_open_balance || 0));
      }
    }

    console.log(`[CREDIT-RISK-ENGINE] Processing ${targetDebtorIds.length} accounts with credit bureau methodology`);

    const results: CreditRiskResult[] = [];

    for (const debtorId of targetDebtorIds) {
      try {
        const result = await calculateCreditRiskScore(supabase, debtorId, sentimentConfigMap, totalARByUser);
        results.push(result);
      } catch (err) {
        console.error(`[CREDIT-RISK-ENGINE] Error processing debtor ${debtorId}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CREDIT-RISK-ENGINE] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Main credit risk scoring calculation for a single account
 */
async function calculateCreditRiskScore(
  supabase: any,
  debtorId: string,
  sentimentConfigMap: Map<string, SentimentConfig>,
  totalARByUser: Map<string, number>
): Promise<CreditRiskResult> {
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

  // Get collection tasks (for escalations, missing docs)
  const { data: tasks } = await supabase
    .from('collection_tasks')
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

  const totalUserAR = totalARByUser.get(debtor.user_id) || 0;

  let result: CreditRiskResult;

  if (!isDataSufficient) {
    result = createInsufficientDataResult(invoiceCount, paymentCount, daysObserved);
  } else {
    result = calculateFullCreditRiskScore(
      invoices || [],
      activities || [],
      outcomes || [],
      tasks || [],
      inboundEmails || [],
      sentimentConfigMap,
      debtor,
      totalUserAR,
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
      // New credit risk fields
      collections_health_score: result.collections_health_score,
      collections_risk_score: result.collections_risk_score,
      health_tier: result.health_tier,
      risk_tier_detailed: result.risk_tier_detailed,
      ai_sentiment_score: result.ai_sentiment_score,
      ai_sentiment_category: result.ai_sentiment_category,
      score_components: result.score_components,
      last_score_change_reason: changeReason,
      
      // Legacy fields for backward compatibility
      // IMPORTANT: payment_score stores RISK (higher = riskier) for consistency with calculate-payment-score
      payment_score: result.credit_risk_score,
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
      collections_health_score: result.collections_health_score,
      collections_risk_score: result.collections_risk_score,
      health_tier: result.health_tier,
      ai_sentiment_score: result.ai_sentiment_score,
      score_components: result.score_components,
      risk_payment_score: result.risk_payment_score,
      risk_tier: result.risk_tier,
      risk_status_note: result.risk_status_note,
      basis_invoices_count: result.basis_invoices_count,
      basis_payments_count: result.basis_payments_count,
      basis_days_observed: result.basis_days_observed,
      calculation_details: result.score_components
    });

  // Log significant score changes
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

  console.log(`[CREDIT-RISK-ENGINE] Account ${debtorId}: Risk=${result.credit_risk_score}, Health=${result.collections_health_score}, Tier=${result.risk_tier}`);

  return result;
}

/**
 * Create result for accounts with insufficient history
 */
function createInsufficientDataResult(
  invoiceCount: number,
  paymentCount: number,
  daysObserved: number
): CreditRiskResult {
  return {
    credit_risk_score: null,
    risk_tier: 'Still learning',
    collections_health_score: null,
    health_tier: 'Still Learning',
    collections_risk_score: null,
    risk_tier_detailed: 'Insufficient Data',
    ai_sentiment_score: null,
    ai_sentiment_category: null,
    risk_payment_score: null,
    risk_status_note: `Insufficient history – still learning this account's behavior. (${invoiceCount} invoices, ${paymentCount} payments, ${daysObserved} days observed)`,
    basis_invoices_count: invoiceCount,
    basis_payments_count: paymentCount,
    basis_days_observed: daysObserved,
    score_components: {
      invoice_behavior_score: 0,
      avg_dpd_last_6_months: 0,
      pct_over_30_days: 0,
      pct_over_60_days: 0,
      pct_over_90_days: 0,
      partial_payment_frequency: 0,
      broken_promises_count: 0,
      volatility_score: 0,
      payment_patterns_score: 0,
      early_vs_late_ratio: 0,
      payment_disputes_count: 0,
      payment_recency_days: 0,
      largest_overdue_amount: 0,
      customer_health_score: 0,
      customer_type: 'unknown',
      concentration_risk_pct: 0,
      operational_signals_score: 0,
      email_sentiment_score: 50,
      response_time_avg_days: 0,
      engagement_rate: 0,
      escalation_count: 0,
      missing_docs_count: 0,
      data_sufficient: false,
      max_dpd: 0,
      total_outstanding: 0,
      penalties: [],
      factors: []
    },
    last_score_change_reason: 'Insufficient data for scoring'
  };
}

/**
 * Calculate full credit risk score with all components
 */
function calculateFullCreditRiskScore(
  invoices: Invoice[],
  activities: CollectionActivity[],
  outcomes: CollectionOutcome[],
  tasks: CollectionTask[],
  inboundEmails: InboundEmail[],
  sentimentConfigMap: Map<string, SentimentConfig>,
  debtor: Debtor,
  totalUserAR: number,
  invoiceCount: number,
  paymentCount: number,
  daysObserved: number
): CreditRiskResult {
  const penalties: { reason: string; amount: number; category: string }[] = [];
  const factors: { factor: string; impact: string; value: string }[] = [];
  const now = Date.now();
  const sixMonthsAgo = now - (180 * 24 * 60 * 60 * 1000);

  // Categorize invoices
  const paidInvoices = invoices.filter(inv => 
    inv.status === 'Paid' || inv.status === 'Settled' || inv.payment_date
  );
  const openInvoices = invoices.filter(inv => 
    inv.status === 'Open' || inv.status === 'InPaymentPlan' || inv.status === 'PartiallyPaid'
  );

  // =============================================
  // A. INVOICE BEHAVIOR (50% of total score)
  // =============================================
  
  // A1. Calculate average DPD for last 6 months
  let avgDpdLast6Months = 0;
  let totalDpdSum = 0;
  let dpdCount = 0;
  
  for (const inv of openInvoices) {
    const invoiceDate = new Date(inv.invoice_date);
    if (invoiceDate.getTime() >= sixMonthsAgo) {
      const dueDate = new Date(inv.due_date);
      const dpd = Math.max(0, Math.floor((now - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      totalDpdSum += dpd;
      dpdCount++;
    }
  }
  avgDpdLast6Months = dpdCount > 0 ? totalDpdSum / dpdCount : 0;
  
  // A2. Calculate % of invoices by aging
  const totalOpenCount = openInvoices.length;
  let over30Count = 0, over60Count = 0, over90Count = 0;
  let maxDPD = 0;
  
  for (const inv of openInvoices) {
    const dueDate = new Date(inv.due_date);
    const dpd = Math.max(0, Math.floor((now - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
    maxDPD = Math.max(maxDPD, dpd);
    
    if (dpd > 30) over30Count++;
    if (dpd > 60) over60Count++;
    if (dpd > 90) over90Count++;
  }
  
  const pctOver30 = totalOpenCount > 0 ? (over30Count / totalOpenCount) * 100 : 0;
  const pctOver60 = totalOpenCount > 0 ? (over60Count / totalOpenCount) * 100 : 0;
  const pctOver90 = totalOpenCount > 0 ? (over90Count / totalOpenCount) * 100 : 0;
  
  // A3. Outstanding balance relative to historical average
  const totalOutstanding = openInvoices.reduce((sum, inv) => 
    sum + (inv.outstanding_amount || inv.amount || 0), 0
  );
  
  // A4. Partial payments frequency
  const partialPaymentInvoices = invoices.filter(inv => inv.status === 'PartiallyPaid');
  const partialPaymentFrequency = invoiceCount > 0 ? (partialPaymentInvoices.length / invoiceCount) * 100 : 0;
  
  // A5. Broken promises-to-pay
  const brokenPromises = (outcomes || []).filter(o => 
    o.outcome_type === 'promise_to_pay' && 
    o.promise_to_pay_date && 
    !o.payment_date &&
    new Date(o.promise_to_pay_date) < new Date()
  ).length;
  
  // A6. Volatility score (month-to-month payment variation)
  let volatilityScore = 0;
  if (paidInvoices.length >= 3) {
    const monthlyPayments = new Map<string, number>();
    for (const inv of paidInvoices) {
      if (inv.payment_date) {
        const month = inv.payment_date.substring(0, 7);
        const current = monthlyPayments.get(month) || 0;
        monthlyPayments.set(month, current + 1);
      }
    }
    
    const counts = Array.from(monthlyPayments.values());
    if (counts.length >= 2) {
      const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
      const variance = counts.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / counts.length;
      volatilityScore = Math.min(100, Math.sqrt(variance) * 20);
    }
  }
  
  // Calculate Invoice Behavior Risk Score (0-100, higher = riskier)
  let invoiceBehaviorScore = 0;
  
  // Avg DPD contribution (0-35 points based on severity)
  if (avgDpdLast6Months >= 150) {
    invoiceBehaviorScore += 35;
    penalties.push({ reason: `Severely delinquent (avg ${Math.round(avgDpdLast6Months)} DPD)`, amount: 35, category: 'invoice_behavior' });
    factors.push({ factor: 'Average Days Past Due', impact: 'critical', value: `${Math.round(avgDpdLast6Months)} days` });
  } else if (avgDpdLast6Months >= 90) {
    invoiceBehaviorScore += 28;
    penalties.push({ reason: `Critical DPD (avg ${Math.round(avgDpdLast6Months)} days)`, amount: 28, category: 'invoice_behavior' });
    factors.push({ factor: 'Average Days Past Due', impact: 'high', value: `${Math.round(avgDpdLast6Months)} days` });
  } else if (avgDpdLast6Months >= 60) {
    invoiceBehaviorScore += 20;
    factors.push({ factor: 'Average Days Past Due', impact: 'medium', value: `${Math.round(avgDpdLast6Months)} days` });
  } else if (avgDpdLast6Months >= 30) {
    invoiceBehaviorScore += 12;
    factors.push({ factor: 'Average Days Past Due', impact: 'low', value: `${Math.round(avgDpdLast6Months)} days` });
  } else {
    factors.push({ factor: 'Average Days Past Due', impact: 'positive', value: `${Math.round(avgDpdLast6Months)} days` });
  }
  
  // % over 30/60/90 contribution (0-25 points)
  if (pctOver90 >= 50) {
    invoiceBehaviorScore += 25;
    penalties.push({ reason: `${Math.round(pctOver90)}% invoices >90 days past due`, amount: 25, category: 'invoice_behavior' });
  } else if (pctOver60 >= 50) {
    invoiceBehaviorScore += 18;
    penalties.push({ reason: `${Math.round(pctOver60)}% invoices >60 days past due`, amount: 18, category: 'invoice_behavior' });
  } else if (pctOver30 >= 50) {
    invoiceBehaviorScore += 10;
  }
  
  // Broken promises (0-20 points)
  if (brokenPromises >= 3) {
    invoiceBehaviorScore += 20;
    penalties.push({ reason: `${brokenPromises} broken payment promises`, amount: 20, category: 'invoice_behavior' });
  } else if (brokenPromises >= 1) {
    invoiceBehaviorScore += brokenPromises * 7;
    penalties.push({ reason: `${brokenPromises} broken payment promise(s)`, amount: brokenPromises * 7, category: 'invoice_behavior' });
  }
  
  // Volatility (0-10 points)
  if (volatilityScore > 50) {
    invoiceBehaviorScore += 10;
  } else if (volatilityScore > 25) {
    invoiceBehaviorScore += 5;
  }
  
  // Partial payments frequency (0-10 points) - not necessarily bad, but indicates cash flow issues
  if (partialPaymentFrequency > 30) {
    invoiceBehaviorScore += 10;
  } else if (partialPaymentFrequency > 15) {
    invoiceBehaviorScore += 5;
  }
  
  invoiceBehaviorScore = clamp(invoiceBehaviorScore, 0, 100);

  // =============================================
  // B. PAYMENT PATTERNS & TRENDS (20% of total score)
  // =============================================
  
  // B1. Early vs late payment ratio
  let earlyPayments = 0, latePayments = 0;
  for (const inv of paidInvoices) {
    if (inv.payment_date && inv.due_date) {
      const paymentDate = new Date(inv.payment_date);
      const dueDate = new Date(inv.due_date);
      if (paymentDate <= dueDate) {
        earlyPayments++;
      } else {
        latePayments++;
      }
    }
  }
  const earlyVsLateRatio = (earlyPayments + latePayments) > 0 
    ? earlyPayments / (earlyPayments + latePayments) 
    : 0.5;
  
  // B2. Payment disputes
  const disputedInvoices = invoices.filter(inv => inv.status === 'Disputed');
  const paymentDisputesCount = disputedInvoices.length;
  
  // B3. Payment recency (days since last payment)
  let paymentRecencyDays = 999;
  const sortedPaidInvoices = paidInvoices
    .filter(inv => inv.payment_date)
    .sort((a, b) => new Date(b.payment_date!).getTime() - new Date(a.payment_date!).getTime());
  
  if (sortedPaidInvoices.length > 0) {
    const lastPaymentDate = new Date(sortedPaidInvoices[0].payment_date!);
    paymentRecencyDays = Math.floor((now - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  // B4. Largest overdue invoice amount
  let largestOverdueAmount = 0;
  for (const inv of openInvoices) {
    const dueDate = new Date(inv.due_date);
    if (dueDate.getTime() < now) {
      const amount = inv.outstanding_amount || inv.amount || 0;
      largestOverdueAmount = Math.max(largestOverdueAmount, amount);
    }
  }
  
  // Calculate Payment Patterns Risk Score (0-100)
  let paymentPatternsScore = 0;
  
  // Early vs late ratio (0-35 points)
  if (earlyVsLateRatio < 0.2) {
    paymentPatternsScore += 35;
    penalties.push({ reason: `Only ${Math.round(earlyVsLateRatio * 100)}% payments on time`, amount: 35, category: 'payment_patterns' });
    factors.push({ factor: 'On-Time Payment Rate', impact: 'critical', value: `${Math.round(earlyVsLateRatio * 100)}%` });
  } else if (earlyVsLateRatio < 0.4) {
    paymentPatternsScore += 25;
    factors.push({ factor: 'On-Time Payment Rate', impact: 'high', value: `${Math.round(earlyVsLateRatio * 100)}%` });
  } else if (earlyVsLateRatio < 0.6) {
    paymentPatternsScore += 15;
    factors.push({ factor: 'On-Time Payment Rate', impact: 'medium', value: `${Math.round(earlyVsLateRatio * 100)}%` });
  } else if (earlyVsLateRatio < 0.8) {
    paymentPatternsScore += 5;
    factors.push({ factor: 'On-Time Payment Rate', impact: 'low', value: `${Math.round(earlyVsLateRatio * 100)}%` });
  } else {
    factors.push({ factor: 'On-Time Payment Rate', impact: 'positive', value: `${Math.round(earlyVsLateRatio * 100)}%` });
  }
  
  // Payment disputes (0-25 points)
  if (paymentDisputesCount >= 3) {
    paymentPatternsScore += 25;
    penalties.push({ reason: `${paymentDisputesCount} disputed invoices`, amount: 25, category: 'payment_patterns' });
  } else if (paymentDisputesCount >= 1) {
    paymentPatternsScore += paymentDisputesCount * 8;
  }
  
  // Payment recency (0-25 points)
  if (paymentRecencyDays >= 180) {
    paymentPatternsScore += 25;
    penalties.push({ reason: `No payment in ${paymentRecencyDays} days`, amount: 25, category: 'payment_patterns' });
  } else if (paymentRecencyDays >= 90) {
    paymentPatternsScore += 15;
  } else if (paymentRecencyDays >= 60) {
    paymentPatternsScore += 8;
  }
  
  // Largest overdue (0-15 points based on relative size)
  if (largestOverdueAmount > 50000) {
    paymentPatternsScore += 15;
  } else if (largestOverdueAmount > 20000) {
    paymentPatternsScore += 10;
  } else if (largestOverdueAmount > 5000) {
    paymentPatternsScore += 5;
  }
  
  paymentPatternsScore = clamp(paymentPatternsScore, 0, 100);

  // =============================================
  // C. CUSTOMER HEALTH INDICATORS (15% of total score)
  // =============================================
  
  // C1. Customer type (B2B vs B2C)
  const customerType = debtor.type || 'B2B';
  
  // C2. Concentration risk
  const accountBalance = debtor.total_open_balance || 0;
  const concentrationRiskPct = totalUserAR > 0 ? (accountBalance / totalUserAR) * 100 : 0;
  
  // Calculate Customer Health Risk Score (0-100)
  let customerHealthScore = 0;
  
  // Customer type risk (B2C slightly higher risk for collections)
  if (customerType === 'B2C') {
    customerHealthScore += 10;
    factors.push({ factor: 'Customer Type', impact: 'low', value: 'B2C' });
  } else {
    factors.push({ factor: 'Customer Type', impact: 'positive', value: 'B2B' });
  }
  
  // Concentration risk (0-50 points)
  if (concentrationRiskPct > 30) {
    customerHealthScore += 50;
    penalties.push({ reason: `High concentration risk (${Math.round(concentrationRiskPct)}% of AR)`, amount: 50, category: 'customer_health' });
    factors.push({ factor: 'AR Concentration', impact: 'critical', value: `${Math.round(concentrationRiskPct)}%` });
  } else if (concentrationRiskPct > 15) {
    customerHealthScore += 25;
    factors.push({ factor: 'AR Concentration', impact: 'medium', value: `${Math.round(concentrationRiskPct)}%` });
  } else {
    factors.push({ factor: 'AR Concentration', impact: 'positive', value: `${Math.round(concentrationRiskPct)}%` });
  }
  
  customerHealthScore = clamp(customerHealthScore, 0, 100);

  // =============================================
  // D. OPERATIONAL SIGNALS (15% of total score)
  // =============================================
  
  // D1. Email sentiment
  let emailSentimentScore = 50; // Default neutral (0-100, higher = riskier)
  let latestSentimentCategory: string | null = null;
  let latestSentimentValue: number | null = null;
  
  const emailsWithSentiment = (inboundEmails || []).filter(e => e.ai_sentiment_category);
  
  if (emailsWithSentiment.length > 0) {
    let totalWeight = 0;
    let weightedRiskSum = 0;

    emailsWithSentiment.forEach((email, index) => {
      const weight = 1 / (index + 1);
      const config = sentimentConfigMap.get(email.ai_sentiment_category || 'neutral');
      
      if (config) {
        weightedRiskSum += config.risk_score_value * weight;
        totalWeight += weight;
      }
    });

    if (totalWeight > 0) {
      emailSentimentScore = weightedRiskSum / totalWeight;
    }

    latestSentimentCategory = emailsWithSentiment[0]?.ai_sentiment_category || null;
    latestSentimentValue = emailsWithSentiment[0]?.ai_sentiment_score || null;
  } else {
    const noResponseConfig = sentimentConfigMap.get('no_response');
    if (noResponseConfig) {
      emailSentimentScore = noResponseConfig.risk_score_value;
      latestSentimentCategory = 'no_response';
    }
  }
  
  // D2. Response time (average days to respond to outreach)
  let responseTimeAvgDays = 0;
  const outboundActivities = (activities || []).filter(a => 
    a.activity_type === 'outbound' && a.sent_at
  );
  const respondedActivities = outboundActivities.filter(a => a.responded_at);
  
  if (respondedActivities.length > 0) {
    let totalResponseDays = 0;
    for (const act of respondedActivities) {
      const sentDate = new Date(act.sent_at!);
      const respondedDate = new Date(act.responded_at!);
      totalResponseDays += Math.floor((respondedDate.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));
    }
    responseTimeAvgDays = totalResponseDays / respondedActivities.length;
  }
  
  // D3. Engagement rate
  const engagementRate = outboundActivities.length > 0 
    ? (respondedActivities.length / outboundActivities.length) * 100 
    : 50; // Default 50% if no outreach
  
  // D4. Escalations count
  const escalationTasks = (tasks || []).filter(t => 
    t.level === 'escalation' || t.priority === 'urgent' || t.priority === 'high'
  );
  const escalationCount = escalationTasks.length;
  
  // D5. Missing docs
  const missingDocsTasks = (tasks || []).filter(t => 
    t.task_type === 'W9_REQUEST' || 
    t.task_type === 'DOCUMENT_REQUEST' ||
    t.task_type === 'PO_REQUEST'
  );
  const missingDocsCount = missingDocsTasks.length;
  
  // Calculate Operational Signals Risk Score (0-100)
  let operationalSignalsScore = 0;
  
  // Sentiment (0-35 points)
  if (emailSentimentScore >= 70) {
    operationalSignalsScore += 35;
    penalties.push({ reason: `Negative sentiment detected (${latestSentimentCategory})`, amount: 35, category: 'operational' });
    factors.push({ factor: 'Communication Sentiment', impact: 'critical', value: latestSentimentCategory || 'negative' });
  } else if (emailSentimentScore >= 50) {
    operationalSignalsScore += 15;
    factors.push({ factor: 'Communication Sentiment', impact: 'medium', value: latestSentimentCategory || 'neutral' });
  } else {
    factors.push({ factor: 'Communication Sentiment', impact: 'positive', value: latestSentimentCategory || 'positive' });
  }
  
  // Engagement rate (0-25 points)
  if (engagementRate < 20) {
    operationalSignalsScore += 25;
    penalties.push({ reason: `Very low engagement rate (${Math.round(engagementRate)}%)`, amount: 25, category: 'operational' });
  } else if (engagementRate < 40) {
    operationalSignalsScore += 15;
  } else if (engagementRate < 60) {
    operationalSignalsScore += 5;
  }
  
  // Escalations (0-20 points)
  if (escalationCount >= 3) {
    operationalSignalsScore += 20;
    penalties.push({ reason: `${escalationCount} escalations/high-priority issues`, amount: 20, category: 'operational' });
  } else if (escalationCount >= 1) {
    operationalSignalsScore += escalationCount * 7;
  }
  
  // Missing docs (0-10 points)
  if (missingDocsCount >= 2) {
    operationalSignalsScore += 10;
  } else if (missingDocsCount === 1) {
    operationalSignalsScore += 5;
  }
  
  // Response time (0-10 points)
  if (responseTimeAvgDays > 14) {
    operationalSignalsScore += 10;
  } else if (responseTimeAvgDays > 7) {
    operationalSignalsScore += 5;
  }
  
  operationalSignalsScore = clamp(operationalSignalsScore, 0, 100);

  // =============================================
  // CALCULATE FINAL CREDIT RISK SCORE
  // =============================================
  
  // Weighted calculation (higher = riskier)
  let creditRiskScore = Math.round(
    (0.50 * invoiceBehaviorScore) +    // A. Invoice Behavior (50%)
    (0.20 * paymentPatternsScore) +    // B. Payment Patterns (20%)
    (0.15 * customerHealthScore) +     // C. Customer Health (15%)
    (0.15 * operationalSignalsScore)   // D. Operational Signals (15%)
  );
  
  // Apply severe adjustments for extreme DPD cases
  // Accounts with 150+ DPD should ALWAYS be high risk
  if (maxDPD >= 150) {
    creditRiskScore = Math.max(creditRiskScore, 80); // Floor at 80 (Critical)
    factors.push({ factor: 'Extreme Delinquency Override', impact: 'critical', value: `${maxDPD} days past due` });
  } else if (maxDPD >= 120) {
    creditRiskScore = Math.max(creditRiskScore, 70); // Floor at 70 (High)
  } else if (maxDPD >= 90) {
    creditRiskScore = Math.max(creditRiskScore, 60); // Floor at 60 (High)
  }
  
  // Clamp final score
  creditRiskScore = clamp(creditRiskScore, 1, 100);
  
  // Calculate health score (inverse of risk)
  const collectionsHealthScore = 100 - creditRiskScore;
  
  // Determine tiers
  const riskTier = getRiskTier(creditRiskScore);
  const healthTier = getHealthTier(collectionsHealthScore);

  return {
    credit_risk_score: creditRiskScore,
    risk_tier: riskTier,
    collections_health_score: collectionsHealthScore,
    health_tier: healthTier,
    collections_risk_score: creditRiskScore,
    risk_tier_detailed: riskTier,
    ai_sentiment_score: latestSentimentValue,
    ai_sentiment_category: latestSentimentCategory,
    risk_payment_score: collectionsHealthScore,
    risk_status_note: generateStatusNote(healthTier, riskTier, penalties),
    basis_invoices_count: invoiceCount,
    basis_payments_count: paymentCount,
    basis_days_observed: daysObserved,
    score_components: {
      invoice_behavior_score: Math.round(invoiceBehaviorScore),
      avg_dpd_last_6_months: Math.round(avgDpdLast6Months),
      pct_over_30_days: Math.round(pctOver30),
      pct_over_60_days: Math.round(pctOver60),
      pct_over_90_days: Math.round(pctOver90),
      partial_payment_frequency: Math.round(partialPaymentFrequency),
      broken_promises_count: brokenPromises,
      volatility_score: Math.round(volatilityScore),
      payment_patterns_score: Math.round(paymentPatternsScore),
      early_vs_late_ratio: Math.round(earlyVsLateRatio * 100),
      payment_disputes_count: paymentDisputesCount,
      payment_recency_days: paymentRecencyDays,
      largest_overdue_amount: largestOverdueAmount,
      customer_health_score: Math.round(customerHealthScore),
      customer_type: customerType,
      concentration_risk_pct: Math.round(concentrationRiskPct),
      operational_signals_score: Math.round(operationalSignalsScore),
      email_sentiment_score: Math.round(emailSentimentScore),
      response_time_avg_days: Math.round(responseTimeAvgDays),
      engagement_rate: Math.round(engagementRate),
      escalation_count: escalationCount,
      missing_docs_count: missingDocsCount,
      data_sufficient: true,
      max_dpd: maxDPD,
      total_outstanding: totalOutstanding,
      penalties,
      factors
    },
    last_score_change_reason: ''
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getRiskTier(score: number): string {
  if (score <= RISK_TIERS.LOW.max) return RISK_TIERS.LOW.label;
  if (score <= RISK_TIERS.MEDIUM.max) return RISK_TIERS.MEDIUM.label;
  if (score <= RISK_TIERS.HIGH.max) return RISK_TIERS.HIGH.label;
  return RISK_TIERS.CRITICAL.label;
}

function getHealthTier(score: number): string {
  if (score >= HEALTH_TIERS.HEALTHY.min) return HEALTH_TIERS.HEALTHY.label;
  if (score >= HEALTH_TIERS.WATCH.min) return HEALTH_TIERS.WATCH.label;
  if (score >= HEALTH_TIERS.AT_RISK.min) return HEALTH_TIERS.AT_RISK.label;
  return HEALTH_TIERS.CRITICAL.label;
}

function generateStatusNote(healthTier: string, riskTier: string, penalties: { reason: string }[]): string {
  const topPenalties = penalties.slice(0, 2).map(p => p.reason).join('. ');
  return `${healthTier} health, ${riskTier} risk. ${topPenalties}`.trim();
}
