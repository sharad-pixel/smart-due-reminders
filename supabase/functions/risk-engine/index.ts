import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RiskCalculation {
  risk_payment_score: number | null;
  risk_tier: string;
  risk_status_note: string;
  basis_invoices_count: number;
  basis_payments_count: number;
  basis_days_observed: number;
  calculation_details: object;
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

interface CollectionActivity {
  id: string;
  activity_type: string;
  channel: string;
  opened_at: string | null;
  responded_at: string | null;
  created_at: string;
}

// Data sufficiency thresholds
const MIN_INVOICES = 3;
const MIN_PAYMENTS = 2;
const MIN_DAYS_OBSERVED = 60;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { debtor_id, recalculate_all, user_id } = await req.json();

    // If called from cron without user context, process all
    let targetDebtorIds: string[] = [];
    let targetUserId: string | null = user_id || null;

    if (recalculate_all && user_id) {
      // Recalculate all for a specific user
      const { data: debtors, error } = await supabase
        .from('debtors')
        .select('id')
        .eq('user_id', user_id)
        .eq('is_archived', false);

      if (error) throw error;
      targetDebtorIds = debtors?.map(d => d.id) || [];
    } else if (debtor_id) {
      // Single debtor calculation
      targetDebtorIds = [debtor_id];
      
      // Get user_id from debtor if not provided
      if (!targetUserId) {
        const { data: debtor } = await supabase
          .from('debtors')
          .select('user_id')
          .eq('id', debtor_id)
          .single();
        targetUserId = debtor?.user_id;
      }
    } else if (recalculate_all && !user_id) {
      // Cron job - process all active debtors across all users
      const { data: debtors, error } = await supabase
        .from('debtors')
        .select('id, user_id')
        .eq('is_archived', false);

      if (error) throw error;
      targetDebtorIds = debtors?.map(d => d.id) || [];
    }

    console.log(`Processing ${targetDebtorIds.length} debtors`);

    const results: RiskCalculation[] = [];

    for (const debtorId of targetDebtorIds) {
      try {
        const result = await calculateRiskForDebtor(supabase, debtorId);
        results.push(result);
      } catch (err) {
        console.error(`Error processing debtor ${debtorId}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Risk engine error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function calculateRiskForDebtor(supabase: any, debtorId: string): Promise<RiskCalculation> {
  // Get debtor info
  const { data: debtor, error: debtorError } = await supabase
    .from('debtors')
    .select('*')
    .eq('id', debtorId)
    .single();

  if (debtorError || !debtor) {
    throw new Error(`Debtor not found: ${debtorId}`);
  }

  // Get all invoices for this debtor
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('*')
    .eq('debtor_id', debtorId)
    .order('invoice_date', { ascending: true });

  if (invoicesError) throw invoicesError;

  // Get collection activities (engagement history)
  const { data: activities, error: activitiesError } = await supabase
    .from('collection_activities')
    .select('*')
    .eq('debtor_id', debtorId)
    .eq('direction', 'outbound');

  const engagementData = activities || [];

  // Calculate data sufficiency metrics
  const invoiceCount = invoices?.length || 0;
  const paidInvoices = invoices?.filter((inv: Invoice) => 
    inv.status === 'Paid' || inv.status === 'Settled' || inv.payment_date
  ) || [];
  const paymentCount = paidInvoices.length;

  // Calculate days observed
  let daysObserved = 0;
  if (invoices && invoices.length > 0) {
    const firstInvoiceDate = new Date(invoices[0].invoice_date);
    const today = new Date();
    daysObserved = Math.floor((today.getTime() - firstInvoiceDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Check data sufficiency
  const isDataSufficient = 
    invoiceCount >= MIN_INVOICES && 
    paymentCount >= MIN_PAYMENTS && 
    daysObserved >= MIN_DAYS_OBSERVED;

  let result: RiskCalculation;

  if (!isDataSufficient) {
    // Not enough history - "Still learning"
    result = {
      risk_payment_score: null,
      risk_tier: 'Still learning',
      risk_status_note: `Insufficient history – still learning this account's behavior. (${invoiceCount} invoices, ${paymentCount} payments, ${daysObserved} days observed)`,
      basis_invoices_count: invoiceCount,
      basis_payments_count: paymentCount,
      basis_days_observed: daysObserved,
      calculation_details: {
        data_sufficient: false,
        min_invoices_required: MIN_INVOICES,
        min_payments_required: MIN_PAYMENTS,
        min_days_required: MIN_DAYS_OBSERVED
      }
    };
  } else {
    // Calculate full risk score
    result = calculateRiskScore(invoices, engagementData, invoiceCount, paymentCount, daysObserved);
  }

  // Update debtor record
  await supabase
    .from('debtors')
    .update({
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
      risk_payment_score: result.risk_payment_score,
      risk_tier: result.risk_tier,
      risk_status_note: result.risk_status_note,
      basis_invoices_count: result.basis_invoices_count,
      basis_payments_count: result.basis_payments_count,
      basis_days_observed: result.basis_days_observed,
      calculation_details: result.calculation_details
    });

  console.log(`Debtor ${debtorId}: Score=${result.risk_payment_score}, Tier=${result.risk_tier}`);

  return result;
}

function calculateRiskScore(
  invoices: Invoice[],
  engagementData: CollectionActivity[],
  invoiceCount: number,
  paymentCount: number,
  daysObserved: number
): RiskCalculation {
  let score = 100;
  const penalties: { reason: string; amount: number }[] = [];

  // Separate invoices by status
  const paidInvoices = invoices.filter(inv => 
    inv.status === 'Paid' || inv.status === 'Settled' || inv.payment_date
  );
  const openInvoices = invoices.filter(inv => 
    inv.status === 'Open' || inv.status === 'InPaymentPlan' || inv.status === 'PartiallyPaid'
  );
  const disputedInvoices = invoices.filter(inv => inv.status === 'Disputed');
  const writtenOffInvoices = invoices.filter(inv => 
    inv.status === 'WrittenOff' || inv.status === 'Canceled'
  );

  // ========================================
  // 1) DAYS TO PAY / LATE PAYMENT BEHAVIOR
  // ========================================
  if (paidInvoices.length > 0) {
    let totalDaysToPay = 0;
    let lateCount = 0;

    for (const inv of paidInvoices) {
      if (inv.payment_date && inv.due_date) {
        const paymentDate = new Date(inv.payment_date);
        const dueDate = new Date(inv.due_date);
        const invoiceDate = new Date(inv.invoice_date);
        
        const daysToPay = Math.floor((paymentDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
        totalDaysToPay += Math.max(0, daysToPay);
        
        // Late if paid more than 15 days past due
        const daysPastDue = Math.floor((paymentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysPastDue > 15) {
          lateCount++;
        }
      }
    }

    const avgDaysToPay = totalDaysToPay / paidInvoices.length;
    const lateRatio = lateCount / paidInvoices.length;

    // Penalty based on average days to pay
    if (avgDaysToPay > 90) {
      const penalty = 30;
      score -= penalty;
      penalties.push({ reason: `Average days to pay > 90 (${Math.round(avgDaysToPay)} days)`, amount: penalty });
    } else if (avgDaysToPay > 60) {
      const penalty = 20;
      score -= penalty;
      penalties.push({ reason: `Average days to pay 61-90 (${Math.round(avgDaysToPay)} days)`, amount: penalty });
    } else if (avgDaysToPay > 30) {
      const penalty = 10;
      score -= penalty;
      penalties.push({ reason: `Average days to pay 31-60 (${Math.round(avgDaysToPay)} days)`, amount: penalty });
    }

    // Penalty based on late ratio
    if (lateRatio > 0.5) {
      const penalty = 20;
      score -= penalty;
      penalties.push({ reason: `More than 50% invoices paid late (${Math.round(lateRatio * 100)}%)`, amount: penalty });
    } else if (lateRatio > 0.25) {
      const penalty = 10;
      score -= penalty;
      penalties.push({ reason: `25-50% invoices paid late (${Math.round(lateRatio * 100)}%)`, amount: penalty });
    }
  }

  // ========================================
  // 2) AGING BUCKET EXPOSURE
  // ========================================
  if (openInvoices.length > 0) {
    const totalOutstanding = openInvoices.reduce((sum, inv) => sum + (inv.outstanding_amount || inv.amount || 0), 0);
    
    if (totalOutstanding > 0) {
      // Calculate aging bucket amounts
      let amount60Plus = 0;
      let amount90Plus = 0;

      for (const inv of openInvoices) {
        const amount = inv.outstanding_amount || inv.amount || 0;
        const bucket = inv.aging_bucket || '';
        
        if (['dpd_61_90', 'dpd_91_120', 'dpd_121_150', 'dpd_150_plus'].includes(bucket)) {
          amount60Plus += amount;
        }
        if (['dpd_91_120', 'dpd_121_150', 'dpd_150_plus'].includes(bucket)) {
          amount90Plus += amount;
        }
      }

      const portion60Plus = amount60Plus / totalOutstanding;
      const portion90Plus = amount90Plus / totalOutstanding;

      // Penalties for aging exposure
      if (portion60Plus > 0.5) {
        const penalty = 20;
        score -= penalty;
        penalties.push({ reason: `Over 50% balance in 60+ days past due (${Math.round(portion60Plus * 100)}%)`, amount: penalty });
      } else if (portion60Plus > 0.25) {
        const penalty = 10;
        score -= penalty;
        penalties.push({ reason: `25-50% balance in 60+ days past due (${Math.round(portion60Plus * 100)}%)`, amount: penalty });
      }

      if (portion90Plus > 0.3) {
        const penalty = 10;
        score -= penalty;
        penalties.push({ reason: `Over 30% balance in 90+ days past due (${Math.round(portion90Plus * 100)}%)`, amount: penalty });
      }
    }
  }

  // ========================================
  // 3) DISPUTES / WRITE-OFFS
  // ========================================
  if (disputedInvoices.length > 0) {
    const penalty = 5;
    score -= penalty;
    penalties.push({ reason: `Has disputed invoices (${disputedInvoices.length})`, amount: penalty });
  }

  if (writtenOffInvoices.length > 3) {
    const penalty = 20;
    score -= penalty;
    penalties.push({ reason: `Multiple write-offs (${writtenOffInvoices.length})`, amount: penalty });
  } else if (writtenOffInvoices.length > 0) {
    const penalty = 10;
    score -= penalty;
    penalties.push({ reason: `Has write-offs (${writtenOffInvoices.length})`, amount: penalty });
  }

  // ========================================
  // 4) ENGAGEMENT BEHAVIOR
  // ========================================
  if (engagementData.length > 0) {
    const totalOutreach = engagementData.length;
    const openedCount = engagementData.filter(e => e.opened_at).length;
    const repliedCount = engagementData.filter(e => e.responded_at).length;

    const openRate = openedCount / totalOutreach;
    const replyRate = repliedCount / totalOutreach;

    if (openRate < 0.3 && totalOutreach >= 3) {
      const penalty = 5;
      score -= penalty;
      penalties.push({ reason: `Low email open rate (${Math.round(openRate * 100)}%)`, amount: penalty });
    }

    if (replyRate < 0.15 && totalOutreach >= 3) {
      const penalty = 5;
      score -= penalty;
      penalties.push({ reason: `Low email reply rate (${Math.round(replyRate * 100)}%)`, amount: penalty });
    }

    // Ghost check - no response after multiple reminders
    const noResponseCount = engagementData.filter(e => !e.opened_at && !e.responded_at).length;
    if (noResponseCount >= 3) {
      const penalty = 10;
      score -= penalty;
      penalties.push({ reason: `No response to ${noResponseCount} outreach attempts`, amount: penalty });
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine tier and note
  let tier: string;
  let note: string;

  if (score >= 85) {
    tier = 'Low';
    note = 'Consistently timely payments and low aging exposure.';
  } else if (score >= 70) {
    tier = 'Medium';
    note = 'Generally pays, but some late payments and aging exposure.';
  } else if (score >= 50) {
    tier = 'High';
    note = 'Frequent late payments and significant aging exposure.';
  } else {
    tier = 'Critical';
    note = 'Severely past due and limited engagement.';
  }

  return {
    risk_payment_score: Math.round(score),
    risk_tier: tier,
    risk_status_note: note,
    basis_invoices_count: invoiceCount,
    basis_payments_count: paymentCount,
    basis_days_observed: daysObserved,
    calculation_details: {
      data_sufficient: true,
      penalties,
      total_penalty: 100 - score,
      open_invoices: openInvoices.length,
      paid_invoices: paidInvoices.length,
      disputed_invoices: disputedInvoices.length,
      written_off_invoices: writtenOffInvoices.length,
      engagement_activities: engagementData.length
    }
  };
}