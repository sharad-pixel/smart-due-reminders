import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-UPCOMING-CHARGES] ${step}${detailsStr}`);
};

serve(async (req) => {
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
    const isTeamMember = accountId !== user.id;
    
    logStep("Effective account determined", { accountId, isTeamMember });

    // Get account owner's profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('email, stripe_customer_id, stripe_subscription_id, plan_type')
      .eq('id', accountId)
      .single();

    if (profileError || !profile) {
      throw new Error("Profile not found");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find Stripe customer
    let customerId = profile.stripe_customer_id;
    if (!customerId && profile.email) {
      const customers = await stripe.customers.list({ email: profile.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    if (!customerId) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({
        has_upcoming_invoice: false,
        message: "No billing account found"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Stripe customer found", { customerId });

    // Verify customer exists in Stripe first
    try {
      await stripe.customers.retrieve(customerId);
    } catch (err: any) {
      if (err.code === 'resource_missing' || err.statusCode === 404) {
        logStep("Stripe customer not found in Stripe, clearing reference");
        return new Response(JSON.stringify({
          has_upcoming_invoice: false,
          message: "Billing account needs to be re-established"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      throw err;
    }

    // Get upcoming invoice from Stripe using correct method name
    let upcomingInvoice;
    try {
      upcomingInvoice = await stripe.invoices.upcoming({
        customer: customerId,
      });
    } catch (err: any) {
      // No upcoming invoice is normal for customers without active subscriptions
      if (err.code === 'invoice_upcoming_none' || err.message?.includes('No upcoming invoices')) {
        return new Response(JSON.stringify({
          has_upcoming_invoice: false,
          message: "No upcoming invoice"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      throw err;
    }

    logStep("Retrieved upcoming invoice", { 
      amountDue: upcomingInvoice.amount_due,
      lineItemsCount: upcomingInvoice.lines.data.length 
    });

    // Parse line items
    const lineItems = upcomingInvoice.lines.data.map((item: Stripe.InvoiceLineItem) => ({
      description: item.description || item.price?.nickname || 'Subscription',
      amount: item.amount / 100, // Convert from cents
      quantity: item.quantity || 1,
      price_id: item.price?.id,
      period_start: item.period?.start ? new Date(item.period.start * 1000).toISOString() : null,
      period_end: item.period?.end ? new Date(item.period.end * 1000).toISOString() : null,
      is_proration: item.proration,
      type: item.price?.recurring ? 'recurring' : 'one_time',
    }));

    // Categorize charges
    const baseSubscription = lineItems.filter((item: any) => 
      !item.description?.toLowerCase().includes('seat') &&
      !item.description?.toLowerCase().includes('overage') &&
      !item.description?.toLowerCase().includes('invoice') &&
      item.type === 'recurring'
    );
    
    const seatCharges = lineItems.filter((item: any) => 
      item.description?.toLowerCase().includes('seat') ||
      item.description?.toLowerCase().includes('user')
    );
    
    const overageCharges = lineItems.filter((item: any) => 
      item.description?.toLowerCase().includes('overage') ||
      item.description?.toLowerCase().includes('invoice')
    );

    const prorations = lineItems.filter((item: any) => item.is_proration);

    // Get current period usage from invoice_usage table
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const { data: usageData } = await supabaseClient
      .from('invoice_usage')
      .select('*')
      .eq('user_id', accountId)
      .eq('month', currentMonth)
      .single();

    // Count active team members for seat consumption
    const { count: seatCount } = await supabaseClient
      .from('account_users')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('status', 'active')
      .eq('is_owner', false);

    const response = {
      has_upcoming_invoice: true,
      upcoming_invoice: {
        amount_due: upcomingInvoice.amount_due / 100,
        subtotal: upcomingInvoice.subtotal / 100,
        tax: (upcomingInvoice.tax || 0) / 100,
        total: upcomingInvoice.total / 100,
        currency: upcomingInvoice.currency?.toUpperCase() || 'USD',
        period_start: upcomingInvoice.period_start 
          ? new Date(upcomingInvoice.period_start * 1000).toISOString() 
          : null,
        period_end: upcomingInvoice.period_end 
          ? new Date(upcomingInvoice.period_end * 1000).toISOString() 
          : null,
        next_payment_attempt: upcomingInvoice.next_payment_attempt
          ? new Date(upcomingInvoice.next_payment_attempt * 1000).toISOString()
          : null,
      },
      breakdown: {
        base_subscription: {
          items: baseSubscription,
          total: baseSubscription.reduce((sum: number, item: any) => sum + item.amount, 0),
        },
        seat_charges: {
          items: seatCharges,
          total: seatCharges.reduce((sum: number, item: any) => sum + item.amount, 0),
          seat_count: seatCount || 0,
        },
        overage_charges: {
          items: overageCharges,
          total: overageCharges.reduce((sum: number, item: any) => sum + item.amount, 0),
          invoice_overages: usageData?.overage_invoices || 0,
        },
        prorations: {
          items: prorations,
          total: prorations.reduce((sum: number, item: any) => sum + item.amount, 0),
        },
      },
      consumption: {
        invoices: {
          used: usageData?.included_invoices_used || 0,
          overage: usageData?.overage_invoices || 0,
          overage_charges: usageData?.overage_charges_total || 0,
        },
        seats: {
          billable: seatCount || 0,
        },
        period: currentMonth,
      },
      is_team_member: isTeamMember,
    };

    logStep("Response prepared", { 
      amountDue: response.upcoming_invoice.amount_due,
      hasOverages: response.breakdown.overage_charges.total > 0 
    });

    return new Response(JSON.stringify(response), {
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
