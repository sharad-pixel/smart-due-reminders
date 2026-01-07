import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Add Seat Checkout Session
 * 
 * Creates a Stripe Checkout session for adding additional team seats.
 * This adds seats to an existing subscription or creates a seat-only subscription.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SEAT_PRICE_IDS: Record<string, string> = {
  month: 'price_1ScbGhBfb0dWgtCDZukktOuA',  // $75/month
  year: 'price_1ScbGiBfb0dWgtCDOrLwli7A',   // $720/year
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADD-SEAT-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');
    
    const body = await req.json();
    const { quantity = 1 } = body;
    
    logStep('Request params', { quantity });
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user?.email) {
      throw new Error('User not authenticated');
    }

    logStep('User authenticated', { email: user.email, userId: user.id });

    // Get admin client for profile lookups
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get user's profile and billing interval
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, stripe_subscription_id, billing_interval, plan_type')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Could not find user profile');
    }

    logStep('Profile found', { 
      hasCustomer: !!profile.stripe_customer_id,
      hasSubscription: !!profile.stripe_subscription_id,
      billingInterval: profile.billing_interval,
      planType: profile.plan_type
    });

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    // Determine billing interval from existing subscription or default to monthly
    const billingInterval = profile.billing_interval || 'month';
    const seatPriceId = SEAT_PRICE_IDS[billingInterval];

    if (!seatPriceId) {
      throw new Error('Invalid billing interval');
    }

    logStep('Using seat price', { seatPriceId, billingInterval });

    let customerId = profile.stripe_customer_id;

    // Create customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
      
      logStep('Created new Stripe customer', { customerId });
    }

    // If user has an active subscription, add seat to it
    if (profile.stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
      
      if (subscription.status === 'active' || subscription.status === 'trialing') {
        // Find existing seat item or add new one
        const existingSeatItem = subscription.items.data.find(
          (item: any) => item.price.id === SEAT_PRICE_IDS.month || item.price.id === SEAT_PRICE_IDS.year
        );

        if (existingSeatItem) {
          // Update existing seat quantity
          const newQuantity = (existingSeatItem.quantity || 0) + quantity;
          await stripe.subscriptionItems.update(existingSeatItem.id, {
            quantity: newQuantity,
            proration_behavior: 'create_prorations',
          });
          
          logStep('Updated existing seat item', { 
            itemId: existingSeatItem.id, 
            oldQuantity: existingSeatItem.quantity,
            newQuantity 
          });

          return new Response(
            JSON.stringify({ 
              success: true,
              message: `Added ${quantity} seat(s) to your subscription`,
              redirect: '/team?seats_added=true'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          // Add new seat line item to subscription
          await stripe.subscriptionItems.create({
            subscription: profile.stripe_subscription_id,
            price: seatPriceId,
            quantity: quantity,
            proration_behavior: 'create_prorations',
          });
          
          logStep('Added seat item to subscription', { quantity });

          return new Response(
            JSON.stringify({ 
              success: true,
              message: `Added ${quantity} seat(s) to your subscription`,
              redirect: '/team?seats_added=true'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // No active subscription - create checkout for seats only
    const origin = req.headers.get('origin') || 'https://app.recouply.ai';
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: seatPriceId,
          quantity: quantity,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/team?checkout=success&seats_added=${quantity}`,
      cancel_url: `${origin}/team?checkout=cancelled`,
      metadata: {
        user_id: user.id,
        seat_purchase: 'true',
        quantity: String(quantity),
      },
    });

    logStep('Checkout session created', { sessionId: session.id, url: session.url });

    return new Response(
      JSON.stringify({ 
        url: session.url,
        sessionId: session.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logStep('ERROR', { message: error instanceof Error ? error.message : 'Unknown error' });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
