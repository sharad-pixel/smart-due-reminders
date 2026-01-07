import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CANCEL-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get user's profile to find subscription ID
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("stripe_subscription_id, stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profileError) throw new Error(`Failed to fetch profile: ${profileError.message}`);
    if (!profile?.stripe_subscription_id) {
      throw new Error("No active subscription found");
    }
    logStep("Found subscription", { subscriptionId: profile.stripe_subscription_id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Cancel the subscription at period end (gives user access until current period ends)
    const { cancel_at_period_end } = await req.json().catch(() => ({ cancel_at_period_end: true }));
    
    let canceledSubscription;
    if (cancel_at_period_end) {
      // Cancel at period end - user keeps access until subscription period ends
      canceledSubscription = await stripe.subscriptions.update(profile.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
      logStep("Subscription set to cancel at period end", { 
        subscriptionId: canceledSubscription.id,
        cancelAt: canceledSubscription.cancel_at 
      });
    } else {
      // Immediate cancellation
      canceledSubscription = await stripe.subscriptions.cancel(profile.stripe_subscription_id);
      logStep("Subscription canceled immediately", { subscriptionId: canceledSubscription.id });

      // Update profile to remove subscription
      await supabaseClient
        .from("profiles")
        .update({
          stripe_subscription_id: null,
          plan_type: "free",
        })
        .eq("id", user.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        cancel_at_period_end: canceledSubscription.cancel_at_period_end,
        current_period_end: canceledSubscription.current_period_end
          ? new Date(canceledSubscription.current_period_end * 1000).toISOString()
          : null
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in cancel-subscription", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
