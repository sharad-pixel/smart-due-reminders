import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-USAGE-BILLING-HISTORY] ${step}${detailsStr}`);
};

// Plan invoice limits for overage calculation
const PLAN_LIMITS: Record<string, number> = {
  free: 5,
  trial: 5,
  solo_pro: 25,
  starter: 100,
  growth: 300,
  professional: 500,
  enterprise: -1, // unlimited
};

const OVERAGE_RATE = 1.99;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    logStep("User authenticated", { userId: user.id });

    // Get effective account ID for team members
    const { data: effectiveAccountId } = await supabaseClient
      .rpc('get_effective_account_id', { p_user_id: user.id });
    const accountId = effectiveAccountId || user.id;

    // Get user's plan info
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('plan_type, stripe_subscription_id, stripe_customer_id, subscription_status, invoice_limit')
      .eq('id', accountId)
      .single();

    const planType = profile?.plan_type || 'free';
    const planLimit = profile?.invoice_limit || PLAN_LIMITS[planType] || 5;
    const isUnlimited = planLimit === -1;

    logStep("Profile loaded", { planType, planLimit, isUnlimited });

    // ─────────────────────────────────────────────────────────────
    // Step 1: Fetch Stripe subscription periods to know billing terms
    // ─────────────────────────────────────────────────────────────
    let stripeInvoices: Array<{
      id: string;
      number: string | null;
      amount_due: number;
      amount_paid: number;
      status: string;
      hosted_invoice_url: string | null;
      invoice_pdf: string | null;
      period_start: string;
      period_end: string;
      created: string;
      period_start_ts: number;
      period_end_ts: number;
      description: string | null;
      lines_summary: string | null;
    }> = [];

    // Billing periods derived from Stripe subscription invoices
    interface BillingPeriod {
      period_key: string;          // e.g. "2026-01" or "2026-01_2026-02" for mid-month
      period_start: string;        // ISO
      period_end: string;          // ISO
      period_start_ts: number;
      period_end_ts: number;
      stripe_invoices: typeof stripeInvoices;
      plan_type: string;
      plan_limit: number;
    }

    const billingPeriods: Record<string, BillingPeriod> = {};

    let customerId: string | null = null;

    try {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });

      // Resolve customer ID
      if (profile?.stripe_customer_id) {
        customerId = profile.stripe_customer_id;
        logStep("Using stripe_customer_id from profile", { customerId });
      } else if (profile?.stripe_subscription_id) {
        const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
        customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;
        logStep("Derived customer from subscription", { customerId });
      } else if (user.email) {
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
          logStep("Found customer by email lookup", { customerId });
        }
      }

      if (customerId) {
        logStep("Fetching Stripe invoices", { customerId });

        const invoicesList = await stripe.invoices.list({
          customer: customerId,
          limit: 36, // up to 3 years of monthly invoices
          expand: ['data.lines'],
        });

        for (const inv of invoicesList.data) {
          // Skip $0 draft invoices unless they have lines (trial invoices)
          if (inv.status === 'draft' && (inv.amount_due || 0) === 0) continue;

          const periodStartTs = inv.period_start || inv.created;
          const periodEndTs = inv.period_end || inv.created;

          const periodStartDate = new Date(periodStartTs * 1000);
          const yearMonth = `${periodStartDate.getFullYear()}-${String(periodStartDate.getMonth() + 1).padStart(2, '0')}`;

          // Build line items summary
          const linesSummary = inv.lines?.data
            ?.slice(0, 3)
            .map((l: any) => l.description)
            .filter(Boolean)
            .join('; ') || null;

          const stripeInv = {
            id: inv.id,
            number: inv.number,
            amount_due: (inv.amount_due || 0) / 100,
            amount_paid: (inv.amount_paid || 0) / 100,
            status: inv.status || 'unknown',
            hosted_invoice_url: inv.hosted_invoice_url || null,
            invoice_pdf: inv.invoice_pdf || null,
            period_start: new Date(periodStartTs * 1000).toISOString(),
            period_end: new Date(periodEndTs * 1000).toISOString(),
            created: new Date(inv.created * 1000).toISOString(),
            period_start_ts: periodStartTs,
            period_end_ts: periodEndTs,
            description: inv.description || null,
            lines_summary: linesSummary,
          };

          stripeInvoices.push(stripeInv);

          // Group into billing periods (by year-month of period_start)
          if (!billingPeriods[yearMonth]) {
            billingPeriods[yearMonth] = {
              period_key: yearMonth,
              period_start: new Date(periodStartTs * 1000).toISOString(),
              period_end: new Date(periodEndTs * 1000).toISOString(),
              period_start_ts: periodStartTs,
              period_end_ts: periodEndTs,
              stripe_invoices: [],
              plan_type: planType,
              plan_limit: planLimit,
            };
          }
          billingPeriods[yearMonth].stripe_invoices.push(stripeInv);
        }

        logStep("Stripe invoices processed", { count: stripeInvoices.length, periods: Object.keys(billingPeriods).length });
      }
    } catch (stripeError: any) {
      logStep("Stripe error (non-blocking)", { error: stripeError?.message });
    }

    // ─────────────────────────────────────────────────────────────
    // Step 2: For each billing period, count ACTIVE invoices (ERP logic)
    // Active = Open, InPaymentPlan, PartiallyPaid
    // Use the PEAK (max at any snapshot) or current count for the period
    // ─────────────────────────────────────────────────────────────

    // Get all billing period date ranges (last 24 months + Stripe periods)
    const now = new Date();
    const allPeriodKeys = new Set<string>();

    // Add Stripe-derived periods
    for (const k of Object.keys(billingPeriods)) {
      allPeriodKeys.add(k);
    }

    // Add last 24 calendar months even if no Stripe invoice
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      allPeriodKeys.add(key);
    }

    // Fetch active invoice counts grouped by month of creation (as ERP monthly snapshot)
    // We use created_at month as the billing attribution date
    const { data: activeInvoiceCounts, error: countError } = await supabaseClient
      .from('invoices')
      .select('id, created_at, status, amount_outstanding, currency')
      .eq('user_id', accountId)
      .in('status', ['Open', 'InPaymentPlan', 'PartiallyPaid']);

    if (countError) {
      logStep("Error fetching active invoices (non-blocking)", { error: countError.message });
    }

    // For each calendar month, count how many active invoices existed AT THE END of that month
    // (i.e., were created on or before end of month, and are still active OR were active during that month)
    // Simplified: count invoices created in or before that month that are currently still active
    // Plus invoices that were active at some point in that month (using created_at <= end_of_month)

    // Build a richer picture: for each period, how many invoices were active
    const periodActiveCount: Record<string, { count: number; peak_overage: number; currency_breakdown: Record<string, number> }> = {};

    for (const periodKey of allPeriodKeys) {
      const [year, month] = periodKey.split('-').map(Number);
      const periodEnd = new Date(year, month, 0, 23, 59, 59, 999); // last ms of that month

      // Count invoices that were created on or before end of this month and are currently active
      // This gives us the active invoice load attributable to this billing period
      const activeInPeriod = (activeInvoiceCounts || []).filter(inv => {
        const createdAt = new Date(inv.created_at);
        return createdAt <= periodEnd;
      });

      const currencyBreakdown: Record<string, number> = {};
      for (const inv of activeInPeriod) {
        const cur = inv.currency || 'USD';
        currencyBreakdown[cur] = (currencyBreakdown[cur] || 0) + 1;
      }

      const count = activeInPeriod.length;
      const overageCount = isUnlimited ? 0 : Math.max(0, count - planLimit);

      periodActiveCount[periodKey] = {
        count,
        peak_overage: overageCount,
        currency_breakdown: currencyBreakdown,
      };
    }

    logStep("Active invoice counts computed", { periods: Object.keys(periodActiveCount).length });

    // ─────────────────────────────────────────────────────────────
    // Step 3: Fetch invoice_usage records for the account
    // ─────────────────────────────────────────────────────────────
    const { data: usageRecords } = await supabaseClient
      .from('invoice_usage')
      .select('*')
      .eq('user_id', accountId)
      .order('month', { ascending: false })
      .limit(24);

    const usageByMonth: Record<string, any> = {};
    for (const r of usageRecords || []) {
      usageByMonth[r.month] = r;
    }

    // ─────────────────────────────────────────────────────────────
    // Step 4: Build unified history rows
    // ─────────────────────────────────────────────────────────────
    const history = Array.from(allPeriodKeys)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 24)
      .map(periodKey => {
        const [year, month] = periodKey.split('-').map(Number);
        const periodStart = new Date(year, month - 1, 1).toISOString();
        const periodEnd = new Date(year, month, 0, 23, 59, 59).toISOString();

        const usage = usageByMonth[periodKey];
        const activeData = periodActiveCount[periodKey] || { count: 0, peak_overage: 0, currency_breakdown: {} };
        const stripe_period = billingPeriods[periodKey];

        // Use the larger of tracked usage or actual active count as the authoritative count
        const trackedTotal = usage ? ((usage.included_invoices_used || 0) + (usage.overage_invoices || 0)) : 0;
        const erpActiveCount = activeData.count;

        // ERP consumption: use the higher signal
        const effectiveCount = Math.max(trackedTotal, erpActiveCount);
        const overageCount = isUnlimited ? 0 : Math.max(0, effectiveCount - planLimit);
        const includedCount = Math.min(effectiveCount, isUnlimited ? effectiveCount : planLimit);
        const overageCharges = overageCount * OVERAGE_RATE;

        return {
          month: periodKey,
          period_start: stripe_period?.period_start || periodStart,
          period_end: stripe_period?.period_end || periodEnd,

          // ERP consumption data
          active_invoice_count: erpActiveCount,
          plan_limit: isUnlimited ? null : planLimit,
          plan_type: planType,

          // Usage breakdown
          included_invoices_used: includedCount,
          overage_invoices: overageCount,
          overage_charges_total: overageCharges,
          total_invoices_used: effectiveCount,

          // Currency breakdown (multi-currency ERP support)
          currency_breakdown: activeData.currency_breakdown,
          is_unlimited: isUnlimited,

          // Legacy usage record data (if exists)
          usage_record: usage ? {
            included_invoices_used: usage.included_invoices_used || 0,
            overage_invoices: usage.overage_invoices || 0,
            last_updated_at: usage.last_updated_at,
          } : null,

          // Stripe invoices for this period
          stripe_invoices: stripe_period?.stripe_invoices || [],
          has_stripe_billing: (stripe_period?.stripe_invoices || []).length > 0,
        };
      });

    // Filter out empty months (no activity at all) beyond the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const filteredHistory = history.filter(row => {
      const rowDate = new Date(row.period_start);
      // Always include last 6 months, or months with any activity
      return rowDate >= sixMonthsAgo ||
        row.active_invoice_count > 0 ||
        row.has_stripe_billing ||
        row.usage_record !== null;
    });

    logStep("History built", { count: filteredHistory.length });

    return new Response(JSON.stringify({
      history: filteredHistory,
      overage_rate: OVERAGE_RATE,
      plan_type: planType,
      plan_limit: isUnlimited ? null : planLimit,
      is_unlimited: isUnlimited,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
