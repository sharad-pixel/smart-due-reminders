import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[REPORT-INGESTION-USAGE] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeKey) {
      logStep("STRIPE_SECRET_KEY not configured");
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("User authenticated", { userId: user.id });

    // Get effective account ID
    const { data: effectiveAccountId } = await supabase
      .rpc("get_effective_account_id", { p_user_id: user.id });
    const accountId = effectiveAccountId || user.id;

    // Get user's Stripe subscription
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_subscription_id, email")
      .eq("id", accountId)
      .single();

    if (!profile?.stripe_subscription_id) {
      logStep("No active subscription, skipping Stripe reporting");
      return new Response(JSON.stringify({ success: true, reported: false, reason: "no_subscription" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Found subscription", { subscriptionId: profile.stripe_subscription_id });

    // Retrieve subscription and find smart ingestion metered item
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
    const SMART_INGESTION_PRICE_ID = "price_1THHe6Bfb0dWgtCDh4iTrzAe";
    
    let meteredItem = subscription.items.data.find(
      (item: any) => item.price.id === SMART_INGESTION_PRICE_ID
    );

    // If smart ingestion isn't on the subscription yet, add it
    if (!meteredItem) {
      logStep("Smart ingestion price not on subscription, adding it");
      try {
        const updated = await stripe.subscriptions.update(profile.stripe_subscription_id, {
          items: [{ price: SMART_INGESTION_PRICE_ID }],
          proration_behavior: "none",
        });
        meteredItem = updated.items.data.find(
          (item: any) => item.price.id === SMART_INGESTION_PRICE_ID
        );
      } catch (addErr: any) {
        logStep("Failed to add smart ingestion to subscription", { error: addErr?.message });
        return new Response(JSON.stringify({ success: false, error: "Failed to add ingestion price to subscription" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!meteredItem) {
      logStep("Could not find or create metered item");
      return new Response(JSON.stringify({ success: false, error: "Metered item not available" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse optional quantity from request body (defaults to 1 page)
    let quantity = 1;
    try {
      if (req.headers.get("content-type")?.includes("application/json")) {
        const body = await req.json();
        const q = Number(body?.quantity);
        if (Number.isFinite(q) && q >= 1) {
          quantity = Math.floor(q);
        }
      }
    } catch (_e) {
      // No body or invalid JSON — keep default of 1
    }

    // Report N units of usage (1 unit per page) for this approved file
    await stripe.subscriptionItems.createUsageRecord(
      meteredItem.id,
      {
        quantity,
        action: "increment",
        timestamp: Math.floor(Date.now() / 1000),
      }
    );

    logStep("Reported ingestion page usage to Stripe", { itemId: meteredItem.id, quantity });

    return new Response(JSON.stringify({ success: true, reported: true, quantity }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
