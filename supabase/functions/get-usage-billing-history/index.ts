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

    // Fetch all usage records for this account, ordered by month descending
    const { data: usageRecords, error: usageError } = await supabaseClient
      .from('invoice_usage')
      .select('*')
      .eq('user_id', accountId)
      .order('month', { ascending: false })
      .limit(24); // Last 24 months max

    if (usageError) throw new Error(`Error fetching usage: ${usageError.message}`);

    logStep("Usage records fetched", { count: usageRecords?.length });

    // Get user's plan info for overage rate
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('plan_type, stripe_subscription_id, stripe_customer_id')
      .eq('id', accountId)
      .single();

    const OVERAGE_RATE = 1.99;

    // Fetch Stripe invoices for this customer
    // Use stripe_customer_id directly (works for admin overrides where subscription_id is null)
    let stripeInvoicesByMonth: Record<string, Array<{
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
    }>> = {};

    // Determine Stripe customer ID from either direct field or subscription
    let customerId: string | null = null;

    try {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });

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
        // Last resort: look up by email
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
          logStep("Found customer by email lookup", { customerId });
        }
      }

      if (customerId) {
        logStep("Fetching Stripe invoices", { customerId });

        // Fetch recent invoices from Stripe — always by customer, regardless of subscription
        const invoices = await stripe.invoices.list({
          customer: customerId,
          limit: 24,
        });

        // Group invoices by month (YYYY-MM)
        for (const inv of invoices.data) {
          const invDate = new Date((inv.period_start || inv.created) * 1000);
          const monthKey = `${invDate.getFullYear()}-${String(invDate.getMonth() + 1).padStart(2, '0')}`;

          if (!stripeInvoicesByMonth[monthKey]) {
            stripeInvoicesByMonth[monthKey] = [];
          }

          stripeInvoicesByMonth[monthKey].push({
            id: inv.id,
            number: inv.number,
            amount_due: (inv.amount_due || 0) / 100,
            amount_paid: (inv.amount_paid || 0) / 100,
            status: inv.status || 'unknown',
            hosted_invoice_url: inv.hosted_invoice_url || null,
            invoice_pdf: inv.invoice_pdf || null,
            period_start: new Date((inv.period_start || inv.created) * 1000).toISOString(),
            period_end: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : '',
            created: new Date(inv.created * 1000).toISOString(),
          });
        }

        logStep("Stripe invoices grouped by month", { monthCount: Object.keys(stripeInvoicesByMonth).length });
      } else {
        logStep("No Stripe customer found - continuing without invoice data");
      }
    } catch (stripeError: any) {
      logStep("Stripe error (non-blocking)", { error: stripeError?.message });
      // Continue without Stripe data
    }

    // Build the response combining usage + Stripe invoice data
    const history = (usageRecords || []).map((record) => {
      const totalUsed = (record.included_invoices_used || 0) + (record.overage_invoices || 0);
      const overageCharges = (record.overage_invoices || 0) * OVERAGE_RATE;

      return {
        month: record.month,
        included_invoices_used: record.included_invoices_used || 0,
        overage_invoices: record.overage_invoices || 0,
        overage_charges_total: overageCharges,
        total_invoices_used: totalUsed,
        last_updated_at: record.last_updated_at,
        stripe_invoices: stripeInvoicesByMonth[record.month] || [],
      };
    });

    // Also include months that only exist in Stripe (no usage record yet)
    const usageMonths = new Set((usageRecords || []).map(r => r.month));
    for (const stripeMonth of Object.keys(stripeInvoicesByMonth)) {
      if (!usageMonths.has(stripeMonth)) {
        history.push({
          month: stripeMonth,
          included_invoices_used: 0,
          overage_invoices: 0,
          overage_charges_total: 0,
          total_invoices_used: 0,
          last_updated_at: null,
          stripe_invoices: stripeInvoicesByMonth[stripeMonth],
        });
      }
    }

    // Sort by month descending
    history.sort((a, b) => b.month.localeCompare(a.month));

    return new Response(JSON.stringify({
      history,
      overage_rate: OVERAGE_RATE,
      plan_type: profile?.plan_type || 'free',
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
