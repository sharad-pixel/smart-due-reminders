import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[TRACK-INVOICE-USAGE] ${step}${detailsStr}`);
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

    const { invoice_id } = await req.json();
    if (!invoice_id) throw new Error("invoice_id is required");

    // Fetch invoice to check status
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from('invoices')
      .select('status')
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      throw new Error("Invoice not found");
    }

    logStep("Invoice status check", { status: invoice.status });

    // Only count Open or InPaymentPlan invoices
    const countableStatuses = ['Open', 'InPaymentPlan'];
    if (!countableStatuses.includes(invoice.status || '')) {
      logStep("Invoice status not countable - skipping tracking", { status: invoice.status });
      return new Response(JSON.stringify({
        success: true,
        is_overage: false,
        message: `Invoice status '${invoice.status}' does not count towards usage`,
        counted: false
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Get current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get user's plan
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('plan_id, stripe_subscription_id')
      .eq('id', user.id)
      .single();

    if (!profile?.plan_id) throw new Error("User plan not found");

    const { data: plan } = await supabaseClient
      .from('plans')
      .select('*')
      .eq('id', profile.plan_id)
      .single();

    if (!plan) throw new Error("Plan not found");

    logStep("Plan loaded", { planName: plan.name, limit: plan.invoice_limit });

    // Check if plan has unlimited invoices (Bespoke)
    const hasUnlimitedInvoices = plan.feature_flags?.can_use_unlimited_invoices === true;
    
    if (hasUnlimitedInvoices) {
      logStep("Unlimited plan - no tracking needed");
      return new Response(JSON.stringify({ 
        success: true, 
        is_overage: false,
        message: "Unlimited plan" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Get or create usage record
    let { data: usage } = await supabaseClient
      .from('invoice_usage')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .single();

    if (!usage) {
      const { data: newUsage } = await supabaseClient
        .from('invoice_usage')
        .insert({
          user_id: user.id,
          month: currentMonth,
          included_invoices_used: 0,
          overage_invoices: 0,
          overage_charges_total: 0
        })
        .select()
        .single();
      usage = newUsage;
    }

    const totalUsed = (usage?.included_invoices_used || 0) + (usage?.overage_invoices || 0);
    const includedLimit = plan.invoice_limit || 0;
    const isOverage = totalUsed >= includedLimit;

    logStep("Usage check", { totalUsed, includedLimit, isOverage });

    // Update usage
    let updateData: any = {};
    if (isOverage) {
      // This is an overage invoice
      updateData = {
        overage_invoices: (usage?.overage_invoices || 0) + 1,
        overage_charges_total: ((usage?.overage_charges_total || 0) + (plan.overage_amount || 0)),
        last_updated_at: new Date().toISOString()
      };

      // Mark invoice as overage
      await supabaseClient
        .from('invoices')
        .update({ is_overage: true })
        .eq('id', invoice_id);

      logStep("Marked as overage invoice");

      // Report usage to Stripe if user has active subscription
      if (profile.stripe_subscription_id) {
        try {
          const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
            apiVersion: "2025-08-27.basil",
          });

          // Get subscription to find the metered item for invoice overages
          const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
          
          // Find the specific invoice price item ($1.99 per invoice)
          const INVOICE_PRICE_ID = 'price_1SbvzMBqszPdRiQv0AM0GDrv';
          const meteredItem = subscription.items.data.find((item: any) => 
            item.price.id === INVOICE_PRICE_ID
          );

          if (meteredItem) {
            // Report 1 unit of usage for this invoice at $1.99
            await stripe.subscriptionItems.createUsageRecord(
              meteredItem.id,
              {
                quantity: 1,
                action: 'increment',
                timestamp: Math.floor(Date.now() / 1000)
              }
            );
            logStep("Reported invoice usage to Stripe - 1 invoice at $1.99", { itemId: meteredItem.id });
          } else {
            logStep("Invoice metered item not found in subscription - user may need to resubscribe");
          }
        } catch (stripeError: any) {
          logStep("Stripe error (non-blocking)", { error: stripeError?.message || String(stripeError) });
          // Don't fail the request if Stripe reporting fails
        }
      }
    } else {
      // Within included limit
      updateData = {
        included_invoices_used: (usage?.included_invoices_used || 0) + 1,
        last_updated_at: new Date().toISOString()
      };
    }

    // Update usage record
    await supabaseClient
      .from('invoice_usage')
      .update(updateData)
      .eq('user_id', user.id)
      .eq('month', currentMonth);

    logStep("Usage updated", updateData);

    return new Response(JSON.stringify({
      success: true,
      is_overage: isOverage,
      total_used: totalUsed + 1,
      included_limit: includedLimit,
      overage_count: isOverage ? (usage?.overage_invoices || 0) + 1 : usage?.overage_invoices || 0
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