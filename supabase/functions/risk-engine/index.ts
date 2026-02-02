import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// AI-POWERED CREDIT RISK INTELLIGENCE ENGINE
// ============================================
// Uses GPT-4o-mini to analyze all account data and provide
// intelligent risk assessments based on:
// 
// A. Invoice Behavior (50%)
//    - Average DPD last 6 months
//    - % of invoices >30, >60, >90 days
//    - Broken promises-to-pay
//    - Partial payments frequency
//
// B. Payment Patterns & Trends (20%)
//    - Early vs late payment ratio
//    - Payment disputes count
//    - Recency & consistency of payments
//
// C. Customer Health Indicators (15%)
//    - Customer type (B2B vs B2C)
//    - Concentration risk
//
// D. Operational Signals (15%)
//    - Email sentiment from inbound communications
//    - Response time to outreach
//    - Engagement patterns
//    - Escalations, disputes, stalled conversations
//    - Task history (W9 requests, payment plan requests, etc.)
//
// E. AI Analysis
//    - GPT-4o-mini analyzes all data holistically
//    - Provides risk reasoning and recommendations

interface CreditRiskResult {
  credit_risk_score: number | null;
  risk_tier: string;
  collections_health_score: number | null;
  health_tier: string;
  ai_sentiment_score: number | null;
  ai_sentiment_category: string | null;
  collections_risk_score: number | null;
  risk_tier_detailed: string;
  risk_payment_score: number | null;
  risk_status_note: string;
  basis_invoices_count: number;
  basis_payments_count: number;
  basis_days_observed: number;
  score_components: ScoreComponents;
  last_score_change_reason: string;
  ai_risk_analysis?: AIRiskAnalysis | null;
  // D&B PAYDEX-style metrics
  paydex_score: number | null;
  paydex_rating: string;
  payment_trend: string;
  credit_limit_recommendation: number | null;
  payment_experience_summary: PaymentExperienceSummary | null;
}

interface PaymentExperienceSummary {
  prompt_payments_pct: number;  // Paid by due date
  slow_payments_pct: number;    // 1-30 days late
  very_slow_payments_pct: number; // 31-60 days late
  delinquent_payments_pct: number; // 60+ days late
  weighted_avg_days_beyond_terms: number;
  total_payment_experiences: number;
  high_credit_amount: number;
  current_owing: number;
  past_due_amount: number;
  payment_manner_description: string;
}

interface AIRiskAnalysis {
  riskAssessment: string;
  keyRiskFactors: string[];
  recommendations: string[];
  predictedPaymentBehavior: string;
  confidenceLevel: string;
  analysisTimestamp: string;
}

interface ScoreComponents {
  invoice_behavior_score: number;
  avg_dpd_last_6_months: number;
  pct_over_30_days: number;
  pct_over_60_days: number;
  pct_over_90_days: number;
  partial_payment_frequency: number;
  broken_promises_count: number;
  volatility_score: number;
  payment_patterns_score: number;
  early_vs_late_ratio: number;
  payment_disputes_count: number;
  payment_recency_days: number;
  largest_overdue_amount: number;
  customer_health_score: number;
  customer_type: string;
  concentration_risk_pct: number;
  operational_signals_score: number;
  email_sentiment_score: number;
  response_time_avg_days: number;
  engagement_rate: number;
  escalation_count: number;
  missing_docs_count: number;
  data_sufficient: boolean;
  max_dpd: number;
  total_outstanding: number;
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
  company_name?: string;
  name?: string;
}

interface InboundEmail {
  id: string;
  ai_sentiment_category: string | null;
  ai_sentiment_score: number | null;
  created_at: string;
  subject?: string;
  ai_summary?: string;
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
  summary?: string;
  ai_reasoning?: string;
}

interface SentimentConfig {
  category: string;
  health_score_value: number;
  risk_score_value: number;
}

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method?: string;
}

const MIN_INVOICES = 3;
const MIN_PAYMENTS = 2;
const MIN_DAYS_OBSERVED = 60;

const RISK_TIERS = {
  LOW: { max: 30, label: 'Low', color: 'green' },
  MEDIUM: { max: 55, label: 'Medium', color: 'yellow' },
  HIGH: { max: 75, label: 'High', color: 'orange' },
  CRITICAL: { max: 100, label: 'Critical', color: 'red' }
};

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

    const { debtor_id, recalculate_all, user_id, use_ai = true } = await req.json();

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
      
      for (const d of debtors || []) {
        const current = totalARByUser.get(d.user_id) || 0;
        totalARByUser.set(d.user_id, current + (d.total_open_balance || 0));
      }
    }

    console.log(`[RISK-ENGINE] Processing ${targetDebtorIds.length} accounts with AI-powered risk analysis`);

    const results: CreditRiskResult[] = [];

    for (const debtorId of targetDebtorIds) {
      try {
        const result = await calculateCreditRiskScore(supabase, debtorId, sentimentConfigMap, totalARByUser, use_ai);
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

async function calculateCreditRiskScore(
  supabase: any,
  debtorId: string,
  sentimentConfigMap: Map<string, SentimentConfig>,
  totalARByUser: Map<string, number>,
  useAI: boolean = true
): Promise<CreditRiskResult> {
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

  // Fetch all related data
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('debtor_id', debtorId)
    .order('invoice_date', { ascending: true });

  const { data: activities } = await supabase
    .from('collection_activities')
    .select('*')
    .eq('debtor_id', debtorId)
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: outcomes } = await supabase
    .from('collection_outcomes')
    .select('*')
    .eq('debtor_id', debtorId);

  const { data: tasks } = await supabase
    .from('collection_tasks')
    .select('*')
    .eq('debtor_id', debtorId)
    .order('created_at', { ascending: false })
    .limit(30);

  const { data: inboundEmails } = await supabase
    .from('inbound_emails')
    .select('id, ai_sentiment_category, ai_sentiment_score, created_at, subject, ai_summary')
    .eq('debtor_id', debtorId)
    .order('created_at', { ascending: false })
    .limit(20);

  // Fetch payment history
  const invoiceIds = (invoices || []).map((i: any) => i.id);
  let payments: Payment[] = [];
  if (invoiceIds.length > 0) {
    const { data: paymentLinks } = await supabase
      .from('payment_invoice_links')
      .select('*, payments(*)')
      .in('invoice_id', invoiceIds);
    payments = (paymentLinks || []).map((pl: any) => pl.payments).filter(Boolean);
  }

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
      payments,
      sentimentConfigMap,
      debtor,
      totalUserAR,
      invoiceCount,
      paymentCount,
      daysObserved
    );

    // Run AI analysis if enabled
    if (useAI) {
      try {
        const aiAnalysis = await runAIRiskAnalysis(
          debtor,
          invoices || [],
          activities || [],
          tasks || [],
          inboundEmails || [],
          payments,
          result.score_components
        );
        result.ai_risk_analysis = aiAnalysis;
        
        // Use AI insights to potentially adjust the risk assessment
        if (aiAnalysis && aiAnalysis.confidenceLevel === 'high') {
          // AI can add up to 10 points for hidden risks or subtract for positive signals
          const aiAdjustment = calculateAIAdjustment(aiAnalysis, result.credit_risk_score || 50);
          if (result.credit_risk_score !== null) {
            result.credit_risk_score = clamp(result.credit_risk_score + aiAdjustment, 1, 100);
            result.collections_health_score = 100 - result.credit_risk_score;
            result.collections_risk_score = result.credit_risk_score;
            result.risk_tier = getRiskTier(result.credit_risk_score);
            result.health_tier = getHealthTier(result.collections_health_score);
            result.risk_tier_detailed = result.risk_tier;
          }
        }
      } catch (aiError) {
        console.error(`[RISK-ENGINE] AI analysis failed for ${debtorId}:`, aiError);
        // Continue without AI analysis
      }
    }
  }

  // Determine change reason
  let changeReason = 'Initial calculation';
  if (previousHealthScore !== null) {
    const healthDiff = (result.collections_health_score || 0) - previousHealthScore;
    const riskDiff = (result.collections_risk_score || 0) - (previousRiskScore || 0);
    
    if (Math.abs(healthDiff) >= 5 || Math.abs(riskDiff) >= 5) {
      const reasons: string[] = [];
      
      if (result.ai_risk_analysis?.keyRiskFactors?.length) {
        reasons.push(...result.ai_risk_analysis.keyRiskFactors.slice(0, 2));
      } else if (result.score_components.penalties.length > 0) {
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
      collections_health_score: result.collections_health_score,
      collections_risk_score: result.collections_risk_score,
      health_tier: result.health_tier,
      risk_tier_detailed: result.risk_tier_detailed,
      ai_sentiment_score: result.ai_sentiment_score,
      ai_sentiment_category: result.ai_sentiment_category,
      score_components: result.score_components,
      last_score_change_reason: changeReason,
      ai_risk_analysis: result.ai_risk_analysis,
      avg_days_to_pay: result.score_components.avg_dpd_last_6_months || null,
      max_days_past_due: result.score_components.max_dpd || null,
      open_invoices_count: result.basis_invoices_count,
      aging_mix_current_pct: 100 - (result.score_components.pct_over_30_days || 0),
      aging_mix_31_60_pct: (result.score_components.pct_over_30_days || 0) - (result.score_components.pct_over_60_days || 0),
      aging_mix_61_90_pct: (result.score_components.pct_over_60_days || 0) - (result.score_components.pct_over_90_days || 0),
      aging_mix_91_120_pct: result.score_components.pct_over_90_days || 0,
      payment_score: result.credit_risk_score,
      payment_risk_tier: result.risk_tier,
      risk_status_note: result.risk_status_note,
      risk_last_calculated_at: new Date().toISOString(),
      // D&B PAYDEX-style fields
      paydex_score: result.paydex_score,
      paydex_rating: result.paydex_rating,
      payment_trend: result.payment_trend,
      credit_limit_recommendation: result.credit_limit_recommendation,
      payment_experience_summary: result.payment_experience_summary
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
      calculation_details: {
        ...result.score_components,
        ai_risk_analysis: result.ai_risk_analysis
      }
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

  console.log(`[RISK-ENGINE] Account ${debtorId}: Risk=${result.credit_risk_score}, Health=${result.collections_health_score}, Tier=${result.risk_tier}${result.ai_risk_analysis ? ' (AI-enhanced)' : ''}`);

  return result;
}

/**
 * Run AI-powered risk analysis using GPT-4o-mini
 */
async function runAIRiskAnalysis(
  debtor: Debtor,
  invoices: Invoice[],
  activities: CollectionActivity[],
  tasks: CollectionTask[],
  inboundEmails: InboundEmail[],
  payments: Payment[],
  scoreComponents: ScoreComponents
): Promise<AIRiskAnalysis | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.log("[RISK-ENGINE] LOVABLE_API_KEY not configured, skipping AI analysis");
    return null;
  }

  // Prepare account data summary for AI
  const openInvoices = invoices.filter(inv => 
    inv.status === 'Open' || inv.status === 'InPaymentPlan' || inv.status === 'PartiallyPaid'
  );
  const disputedInvoices = invoices.filter(inv => inv.status === 'Disputed');
  
  const recentTasks = tasks.slice(0, 10).map(t => ({
    type: t.task_type,
    status: t.status,
    priority: t.priority,
    summary: t.summary?.substring(0, 100)
  }));

  const recentEmails = inboundEmails.slice(0, 5).map(e => ({
    sentiment: e.ai_sentiment_category,
    sentimentScore: e.ai_sentiment_score,
    subject: e.subject?.substring(0, 50),
    summary: e.ai_summary?.substring(0, 100)
  }));

  const recentPayments = payments.slice(0, 5).map(p => ({
    date: p.payment_date,
    amount: p.amount,
    method: p.payment_method
  }));

  const outboundCount = activities.filter(a => a.activity_type === 'outbound').length;
  const responseCount = activities.filter(a => a.responded_at).length;

  const accountData = {
    accountName: debtor.company_name || debtor.name,
    accountType: debtor.type || 'B2B',
    totalOpenBalance: debtor.total_open_balance || 0,
    openInvoicesCount: openInvoices.length,
    totalInvoicesCount: invoices.length,
    disputedInvoicesCount: disputedInvoices.length,
    avgDaysPastDue: scoreComponents.avg_dpd_last_6_months,
    maxDaysPastDue: scoreComponents.max_dpd,
    pctOver30Days: scoreComponents.pct_over_30_days,
    pctOver60Days: scoreComponents.pct_over_60_days,
    pctOver90Days: scoreComponents.pct_over_90_days,
    brokenPromisesCount: scoreComponents.broken_promises_count,
    earlyPaymentRatio: scoreComponents.early_vs_late_ratio,
    engagementRate: scoreComponents.engagement_rate,
    escalationCount: scoreComponents.escalation_count,
    emailSentimentScore: scoreComponents.email_sentiment_score,
    recentTasks,
    recentEmails,
    recentPayments,
    outboundOutreachCount: outboundCount,
    responseCount,
    concentrationRisk: scoreComponents.concentration_risk_pct
  };

  const systemPrompt = `You are a Collection Risk Analyst AI for an accounts receivable platform. Analyze account data to assess collection risk.

Your analysis should consider:
1. Invoice aging and payment history patterns
2. Communication sentiment and engagement levels
3. Task history (W9 requests, payment plans, disputes)
4. Broken promises and collection difficulties
5. Payment behavior trends

Provide your analysis as JSON with these exact fields:
- riskAssessment: 1-2 sentence summary of overall risk
- keyRiskFactors: array of 2-4 specific risk factors
- recommendations: array of 2-3 actionable next steps
- predictedPaymentBehavior: brief prediction of future payment behavior
- confidenceLevel: "low", "medium", or "high" based on data quality`;

  const userPrompt = `Analyze this account's collection risk:

${JSON.stringify(accountData, null, 2)}

Current calculated risk components:
- Invoice Behavior Score: ${scoreComponents.invoice_behavior_score}/100
- Payment Patterns Score: ${scoreComponents.payment_patterns_score}/100
- Operational Signals Score: ${scoreComponents.operational_signals_score}/100

Provide your risk analysis as JSON.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_completion_tokens: 500
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.log("[RISK-ENGINE] AI rate limited, skipping analysis");
        return null;
      }
      if (response.status === 402) {
        console.log("[RISK-ENGINE] AI credits exhausted, skipping analysis");
        return null;
      }
      const errorText = await response.text();
      console.error("[RISK-ENGINE] AI error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse AI response
    let analysis: Partial<AIRiskAnalysis>;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, content];
      analysis = JSON.parse(jsonMatch[1] || content);
    } catch (parseError) {
      console.error("[RISK-ENGINE] Failed to parse AI response:", parseError);
      analysis = {
        riskAssessment: content.slice(0, 200),
        keyRiskFactors: ["Analysis parsing failed"],
        recommendations: ["Manual review recommended"],
        predictedPaymentBehavior: "Unable to predict",
        confidenceLevel: "low"
      };
    }

    return {
      riskAssessment: analysis.riskAssessment || "Analysis unavailable",
      keyRiskFactors: analysis.keyRiskFactors || [],
      recommendations: analysis.recommendations || [],
      predictedPaymentBehavior: analysis.predictedPaymentBehavior || "Unknown",
      confidenceLevel: analysis.confidenceLevel || "low",
      analysisTimestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error("[RISK-ENGINE] AI analysis error:", error);
    return null;
  }
}

/**
 * Calculate score adjustment based on AI analysis
 */
function calculateAIAdjustment(aiAnalysis: AIRiskAnalysis, currentScore: number): number {
  let adjustment = 0;

  // Check for hidden risk factors
  const riskKeywords = ['critical', 'severe', 'high risk', 'unlikely to pay', 'avoid', 'escalate'];
  const positiveKeywords = ['reliable', 'consistent', 'improving', 'likely to pay', 'low risk'];

  const assessmentLower = (aiAnalysis.riskAssessment || '').toLowerCase();
  const predictedBehaviorLower = (aiAnalysis.predictedPaymentBehavior || '').toLowerCase();

  // Check for risk indicators
  for (const keyword of riskKeywords) {
    if (assessmentLower.includes(keyword) || predictedBehaviorLower.includes(keyword)) {
      adjustment += 5;
      break;
    }
  }

  // Check for positive indicators
  for (const keyword of positiveKeywords) {
    if (assessmentLower.includes(keyword) || predictedBehaviorLower.includes(keyword)) {
      adjustment -= 5;
      break;
    }
  }

  // Cap adjustment to prevent dramatic swings
  return clamp(adjustment, -10, 10);
}

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
    last_score_change_reason: 'Insufficient data for scoring',
    ai_risk_analysis: null,
    // D&B PAYDEX fields
    paydex_score: null,
    paydex_rating: 'Insufficient Data',
    payment_trend: 'Unknown',
    credit_limit_recommendation: null,
    payment_experience_summary: null
  };
}

function calculateFullCreditRiskScore(
  invoices: Invoice[],
  activities: CollectionActivity[],
  outcomes: CollectionOutcome[],
  tasks: CollectionTask[],
  inboundEmails: InboundEmail[],
  payments: Payment[],
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

  const paidInvoices = invoices.filter(inv => 
    inv.status === 'Paid' || inv.status === 'Settled' || inv.payment_date
  );
  const openInvoices = invoices.filter(inv => 
    inv.status === 'Open' || inv.status === 'InPaymentPlan' || inv.status === 'PartiallyPaid'
  );

  // A. INVOICE BEHAVIOR (50%)
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
  
  const totalOutstanding = openInvoices.reduce((sum, inv) => 
    sum + (inv.outstanding_amount || inv.amount || 0), 0
  );
  
  const partialPaymentInvoices = invoices.filter(inv => inv.status === 'PartiallyPaid');
  const partialPaymentFrequency = invoiceCount > 0 ? (partialPaymentInvoices.length / invoiceCount) * 100 : 0;
  
  const brokenPromises = (outcomes || []).filter(o => 
    o.outcome_type === 'promise_to_pay' && 
    o.promise_to_pay_date && 
    !o.payment_date &&
    new Date(o.promise_to_pay_date) < new Date()
  ).length;
  
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
  
  let invoiceBehaviorScore = 0;
  
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
  
  if (pctOver90 >= 50) {
    invoiceBehaviorScore += 25;
    penalties.push({ reason: `${Math.round(pctOver90)}% invoices >90 days past due`, amount: 25, category: 'invoice_behavior' });
  } else if (pctOver60 >= 50) {
    invoiceBehaviorScore += 18;
    penalties.push({ reason: `${Math.round(pctOver60)}% invoices >60 days past due`, amount: 18, category: 'invoice_behavior' });
  } else if (pctOver30 >= 50) {
    invoiceBehaviorScore += 10;
  }
  
  if (brokenPromises >= 3) {
    invoiceBehaviorScore += 20;
    penalties.push({ reason: `${brokenPromises} broken payment promises`, amount: 20, category: 'invoice_behavior' });
  } else if (brokenPromises >= 1) {
    invoiceBehaviorScore += brokenPromises * 7;
    penalties.push({ reason: `${brokenPromises} broken payment promise(s)`, amount: brokenPromises * 7, category: 'invoice_behavior' });
  }
  
  if (volatilityScore > 50) {
    invoiceBehaviorScore += 10;
  } else if (volatilityScore > 25) {
    invoiceBehaviorScore += 5;
  }
  
  if (partialPaymentFrequency > 30) {
    invoiceBehaviorScore += 10;
  } else if (partialPaymentFrequency > 15) {
    invoiceBehaviorScore += 5;
  }
  
  invoiceBehaviorScore = clamp(invoiceBehaviorScore, 0, 100);

  // B. PAYMENT PATTERNS (20%)
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
  
  const disputedInvoices = invoices.filter(inv => inv.status === 'Disputed');
  const paymentDisputesCount = disputedInvoices.length;
  
  let paymentRecencyDays = 999;
  const sortedPaidInvoices = paidInvoices
    .filter(inv => inv.payment_date)
    .sort((a, b) => new Date(b.payment_date!).getTime() - new Date(a.payment_date!).getTime());
  
  if (sortedPaidInvoices.length > 0) {
    const lastPaymentDate = new Date(sortedPaidInvoices[0].payment_date!);
    paymentRecencyDays = Math.floor((now - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  let largestOverdueAmount = 0;
  for (const inv of openInvoices) {
    const dueDate = new Date(inv.due_date);
    if (dueDate.getTime() < now) {
      const amount = inv.outstanding_amount || inv.amount || 0;
      largestOverdueAmount = Math.max(largestOverdueAmount, amount);
    }
  }
  
  let paymentPatternsScore = 0;
  
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
  
  if (paymentDisputesCount >= 3) {
    paymentPatternsScore += 25;
    penalties.push({ reason: `${paymentDisputesCount} disputed invoices`, amount: 25, category: 'payment_patterns' });
  } else if (paymentDisputesCount >= 1) {
    paymentPatternsScore += paymentDisputesCount * 8;
  }
  
  if (paymentRecencyDays >= 180) {
    paymentPatternsScore += 25;
    penalties.push({ reason: `No payment in ${paymentRecencyDays} days`, amount: 25, category: 'payment_patterns' });
  } else if (paymentRecencyDays >= 90) {
    paymentPatternsScore += 15;
  } else if (paymentRecencyDays >= 60) {
    paymentPatternsScore += 8;
  }
  
  if (largestOverdueAmount > 50000) {
    paymentPatternsScore += 15;
  } else if (largestOverdueAmount > 20000) {
    paymentPatternsScore += 10;
  } else if (largestOverdueAmount > 5000) {
    paymentPatternsScore += 5;
  }
  
  paymentPatternsScore = clamp(paymentPatternsScore, 0, 100);

  // C. CUSTOMER HEALTH (15%)
  const customerType = debtor.type || 'B2B';
  const accountBalance = debtor.total_open_balance || 0;
  const concentrationRiskPct = totalUserAR > 0 ? (accountBalance / totalUserAR) * 100 : 0;
  
  let customerHealthScore = 0;
  
  if (customerType === 'B2C') {
    customerHealthScore += 10;
    factors.push({ factor: 'Customer Type', impact: 'low', value: 'B2C' });
  } else {
    factors.push({ factor: 'Customer Type', impact: 'positive', value: 'B2B' });
  }
  
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

  // D. OPERATIONAL SIGNALS (15%)
  let emailSentimentScore = 50;
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
  
  const engagementRate = outboundActivities.length > 0 
    ? (respondedActivities.length / outboundActivities.length) * 100 
    : 50;
  
  const escalationTasks = (tasks || []).filter(t => 
    t.level === 'escalation' || t.priority === 'urgent' || t.priority === 'high'
  );
  const escalationCount = escalationTasks.length;
  
  const missingDocsTasks = (tasks || []).filter(t => 
    t.task_type === 'W9_REQUEST' || 
    t.task_type === 'DOCUMENT_REQUEST' ||
    t.task_type === 'PO_REQUEST'
  );
  const missingDocsCount = missingDocsTasks.length;
  
  let operationalSignalsScore = 0;
  
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
  
  if (engagementRate < 20) {
    operationalSignalsScore += 25;
    penalties.push({ reason: `Very low engagement rate (${Math.round(engagementRate)}%)`, amount: 25, category: 'operational' });
  } else if (engagementRate < 40) {
    operationalSignalsScore += 15;
  } else if (engagementRate < 60) {
    operationalSignalsScore += 5;
  }
  
  if (escalationCount >= 3) {
    operationalSignalsScore += 20;
    penalties.push({ reason: `${escalationCount} escalations/high-priority issues`, amount: 20, category: 'operational' });
  } else if (escalationCount >= 1) {
    operationalSignalsScore += escalationCount * 7;
  }
  
  if (missingDocsCount >= 2) {
    operationalSignalsScore += 10;
  } else if (missingDocsCount === 1) {
    operationalSignalsScore += 5;
  }
  
  if (responseTimeAvgDays > 14) {
    operationalSignalsScore += 10;
  } else if (responseTimeAvgDays > 7) {
    operationalSignalsScore += 5;
  }
  
  operationalSignalsScore = clamp(operationalSignalsScore, 0, 100);

  // FINAL SCORE
  let creditRiskScore = Math.round(
    (0.50 * invoiceBehaviorScore) +
    (0.20 * paymentPatternsScore) +
    (0.15 * customerHealthScore) +
    (0.15 * operationalSignalsScore)
  );
  
  if (maxDPD >= 150) {
    creditRiskScore = Math.max(creditRiskScore, 80);
    factors.push({ factor: 'Extreme Delinquency Override', impact: 'critical', value: `${maxDPD} days past due` });
  } else if (maxDPD >= 120) {
    creditRiskScore = Math.max(creditRiskScore, 70);
  } else if (maxDPD >= 90) {
    creditRiskScore = Math.max(creditRiskScore, 60);
  }
  
  creditRiskScore = clamp(creditRiskScore, 1, 100);
  const collectionsHealthScore = 100 - creditRiskScore;
  const riskTier = getRiskTier(creditRiskScore);
  const healthTier = getHealthTier(collectionsHealthScore);

  // Calculate PAYDEX-style metrics
  const paydexResult = calculatePaydexScore(paidInvoices, openInvoices, now);
  
  // Calculate average payment amount for credit limit
  const avgPaymentAmount = paidInvoices.length > 0
    ? paidInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0) / paidInvoices.length
    : 0;
  
  // Calculate credit limit recommendation
  const creditLimitRecommendation = calculateCreditLimitRecommendation(
    paydexResult.paydexScore,
    paydexResult.paymentExperience?.high_credit_amount || largestOverdueAmount,
    paydexResult.paymentExperience?.current_owing || totalOutstanding,
    avgPaymentAmount,
    paydexResult.paymentTrend
  );

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
    last_score_change_reason: '',
    ai_risk_analysis: null,
    // D&B PAYDEX fields
    paydex_score: paydexResult.paydexScore,
    paydex_rating: paydexResult.paydexRating,
    payment_trend: paydexResult.paymentTrend,
    credit_limit_recommendation: creditLimitRecommendation,
    payment_experience_summary: paydexResult.paymentExperience
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

/**
 * Calculate PAYDEX-style score (D&B methodology)
 * PAYDEX: 1-100 scale based on weighted payment experiences
 * 80-100 = Prompt (pays on/before terms)
 * 50-79 = Slow (1-30 days late)
 * 20-49 = Very Slow (31-90 days late)
 * 1-19 = Delinquent/Severely Late (90+ days)
 */
function calculatePaydexScore(
  paidInvoices: Invoice[],
  openInvoices: Invoice[],
  now: number
): { 
  paydexScore: number | null; 
  paydexRating: string; 
  paymentTrend: string;
  paymentExperience: PaymentExperienceSummary | null;
} {
  if (paidInvoices.length < 2) {
    return { 
      paydexScore: null, 
      paydexRating: 'Insufficient Data', 
      paymentTrend: 'Unknown',
      paymentExperience: null
    };
  }

  // Categorize all payment experiences
  let promptCount = 0;      // On time or early
  let slowCount = 0;        // 1-30 days late
  let verySlowCount = 0;    // 31-60 days late
  let delinquentCount = 0;  // 60+ days late

  let totalWeightedDaysBeyond = 0;
  let totalWeight = 0;
  let highCredit = 0;

  // Calculate payment timing for each paid invoice
  const paymentExperiences: { daysBeyond: number; amount: number; date: Date }[] = [];

  for (const inv of paidInvoices) {
    if (!inv.payment_date || !inv.due_date) continue;

    const paymentDate = new Date(inv.payment_date);
    const dueDate = new Date(inv.due_date);
    const daysBeyond = Math.floor((paymentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const amount = inv.outstanding_amount || inv.amount || 0;

    highCredit = Math.max(highCredit, amount);
    paymentExperiences.push({ daysBeyond, amount, date: paymentDate });

    // Weight by recency - more recent payments count more (D&B methodology)
    const recencyWeight = Math.max(0.5, 1 - (now - paymentDate.getTime()) / (365 * 24 * 60 * 60 * 1000));
    const amountWeight = Math.log10(Math.max(10, amount)) / 5; // Log scale for amount weight

    const weight = recencyWeight * amountWeight;
    totalWeightedDaysBeyond += Math.max(0, daysBeyond) * weight;
    totalWeight += weight;

    // Categorize
    if (daysBeyond <= 0) {
      promptCount++;
    } else if (daysBeyond <= 30) {
      slowCount++;
    } else if (daysBeyond <= 60) {
      verySlowCount++;
    } else {
      delinquentCount++;
    }
  }

  const totalExperiences = promptCount + slowCount + verySlowCount + delinquentCount;
  if (totalExperiences === 0) {
    return { 
      paydexScore: null, 
      paydexRating: 'Insufficient Data', 
      paymentTrend: 'Unknown',
      paymentExperience: null
    };
  }

  // Calculate weighted average days beyond terms
  const weightedAvgDaysBeyond = totalWeight > 0 ? totalWeightedDaysBeyond / totalWeight : 0;

  // PAYDEX Score Calculation (D&B formula approximation)
  // Perfect (0 days beyond) = 80 base
  // Each day beyond reduces score
  let paydexScore: number;
  
  if (weightedAvgDaysBeyond <= 0) {
    // Prompt payers: 80-100
    const promptPct = promptCount / totalExperiences;
    paydexScore = 80 + Math.round(promptPct * 20);
  } else if (weightedAvgDaysBeyond <= 14) {
    // Generally prompt with minor delays: 70-79
    paydexScore = 79 - Math.round(weightedAvgDaysBeyond * 0.6);
  } else if (weightedAvgDaysBeyond <= 30) {
    // Slow 1-30: 50-69
    paydexScore = 69 - Math.round((weightedAvgDaysBeyond - 14) * 1.2);
  } else if (weightedAvgDaysBeyond <= 60) {
    // Very Slow 31-60: 30-49
    paydexScore = 49 - Math.round((weightedAvgDaysBeyond - 30) * 0.6);
  } else if (weightedAvgDaysBeyond <= 90) {
    // Delinquent 61-90: 20-29
    paydexScore = 29 - Math.round((weightedAvgDaysBeyond - 60) * 0.3);
  } else {
    // Severely delinquent 90+: 1-19
    paydexScore = Math.max(1, 19 - Math.round((weightedAvgDaysBeyond - 90) * 0.2));
  }

  paydexScore = Math.max(1, Math.min(100, paydexScore));

  // Determine PAYDEX Rating
  let paydexRating: string;
  if (paydexScore >= 80) {
    paydexRating = 'Prompt';
  } else if (paydexScore >= 70) {
    paydexRating = 'Generally Prompt';
  } else if (paydexScore >= 50) {
    paydexRating = 'Slow Pay';
  } else if (paydexScore >= 30) {
    paydexRating = 'Very Slow Pay';
  } else if (paydexScore >= 20) {
    paydexRating = 'Delinquent';
  } else {
    paydexRating = 'Severely Delinquent';
  }

  // Calculate Payment Trend (last 3 months vs previous 3 months)
  const threeMonthsAgo = now - (90 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = now - (180 * 24 * 60 * 60 * 1000);

  const recentPayments = paymentExperiences.filter(p => p.date.getTime() >= threeMonthsAgo);
  const olderPayments = paymentExperiences.filter(p => 
    p.date.getTime() >= sixMonthsAgo && p.date.getTime() < threeMonthsAgo
  );

  let paymentTrend = 'Stable';
  if (recentPayments.length >= 2 && olderPayments.length >= 2) {
    const recentAvg = recentPayments.reduce((sum, p) => sum + p.daysBeyond, 0) / recentPayments.length;
    const olderAvg = olderPayments.reduce((sum, p) => sum + p.daysBeyond, 0) / olderPayments.length;

    const trendDiff = olderAvg - recentAvg; // Positive = improving
    if (trendDiff > 10) {
      paymentTrend = 'Improving';
    } else if (trendDiff > 5) {
      paymentTrend = 'Slightly Improving';
    } else if (trendDiff < -10) {
      paymentTrend = 'Declining';
    } else if (trendDiff < -5) {
      paymentTrend = 'Slightly Declining';
    }
  }

  // Calculate current owing and past due
  let currentOwing = 0;
  let pastDueAmount = 0;
  for (const inv of openInvoices) {
    const amount = inv.outstanding_amount || inv.amount || 0;
    currentOwing += amount;
    if (inv.due_date && new Date(inv.due_date).getTime() < now) {
      pastDueAmount += amount;
    }
  }

  // Payment manner description
  let mannerDescription: string;
  if (paydexScore >= 80) {
    mannerDescription = 'Pays within terms. Excellent payment history.';
  } else if (paydexScore >= 70) {
    mannerDescription = 'Generally pays within terms with occasional minor delays.';
  } else if (paydexScore >= 50) {
    mannerDescription = 'Pays 14-30 days beyond terms. Monitor closely.';
  } else if (paydexScore >= 30) {
    mannerDescription = 'Pays 31-60 days beyond terms. High collection effort required.';
  } else {
    mannerDescription = 'Pays 60+ days beyond terms. Severe collection risk.';
  }

  const paymentExperience: PaymentExperienceSummary = {
    prompt_payments_pct: Math.round((promptCount / totalExperiences) * 100),
    slow_payments_pct: Math.round((slowCount / totalExperiences) * 100),
    very_slow_payments_pct: Math.round((verySlowCount / totalExperiences) * 100),
    delinquent_payments_pct: Math.round((delinquentCount / totalExperiences) * 100),
    weighted_avg_days_beyond_terms: Math.round(weightedAvgDaysBeyond),
    total_payment_experiences: totalExperiences,
    high_credit_amount: highCredit,
    current_owing: currentOwing,
    past_due_amount: pastDueAmount,
    payment_manner_description: mannerDescription
  };

  return { paydexScore, paydexRating, paymentTrend, paymentExperience };
}

/**
 * Calculate credit limit recommendation based on payment behavior
 * Uses D&B-style methodology
 */
function calculateCreditLimitRecommendation(
  paydexScore: number | null,
  highCredit: number,
  currentOwing: number,
  avgPaymentAmount: number,
  paymentTrend: string
): number | null {
  if (paydexScore === null) return null;

  // Base credit limit on historical high credit and PAYDEX
  let multiplier: number;
  
  if (paydexScore >= 80) {
    multiplier = 2.0;  // Can extend 2x their highest credit
  } else if (paydexScore >= 70) {
    multiplier = 1.5;
  } else if (paydexScore >= 50) {
    multiplier = 1.0;  // Keep at current level
  } else if (paydexScore >= 30) {
    multiplier = 0.5;  // Reduce credit
  } else {
    multiplier = 0.25; // Severely reduce or cash only
  }

  // Adjust for trend
  if (paymentTrend === 'Improving') {
    multiplier *= 1.1;
  } else if (paymentTrend === 'Declining') {
    multiplier *= 0.8;
  }

  // Calculate base credit limit
  const baseCredit = Math.max(highCredit, avgPaymentAmount * 3);
  const recommendedLimit = Math.round(baseCredit * multiplier);

  // Round to nice numbers
  if (recommendedLimit >= 100000) {
    return Math.round(recommendedLimit / 10000) * 10000;
  } else if (recommendedLimit >= 10000) {
    return Math.round(recommendedLimit / 1000) * 1000;
  } else if (recommendedLimit >= 1000) {
    return Math.round(recommendedLimit / 100) * 100;
  }
  return recommendedLimit;
}
