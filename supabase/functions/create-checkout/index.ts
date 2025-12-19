import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

/**
 * Create Checkout Session Edge Function
 * 
 * PRICING (December 2024):
 * - Starter: $199/month
 * - Growth: $499/month
 * - Professional: $799/month
 * - Per Seat: $75/user/month
 * - Per Invoice: $1.99/invoice
 * 
 * Trial is ONE-TIME per email address (tracked via trial_used_at)
 * Subscription is account-level (owner's subscription covers team members)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Updated price IDs - December 2024
const PRICE_IDS: Record<string, Record<string, string>> = {
  month: {
    starter: 'price_1ScbGXBfb0dWgtCDpDqTtrC7',      // $199/month
    growth: 'price_1ScbGbBfb0dWgtCDLjXblCw4',       // $499/month
    professional: 'price_1ScbGeBfb0dWgtCDrtiXDKiJ', // $799/month
  },
  year: {
    starter: 'price_1ScbGZBfb0dWgtCDvfg6hyy6',      // $191,040/year (annual)
    growth: 'price_1ScbGcBfb0dWgtCDQpH6uB7A',       // $479,040/year (annual)
    professional: 'price_1ScbGfBfb0dWgtCDhCxrFPE4', // $767,040/year (annual)
  }
};

// Seat pricing: $75/user/month
const SEAT_PRICE_IDS: Record<string, string> = {
  month: 'price_1ScbGhBfb0dWgtCDZukktOuA',  // $75/month
  year: 'price_1ScbGiBfb0dWgtCDOrLwli7A',   // $720/year
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');
    
    const body = await req.json();
    const { 
      planId, 
      priceId: directPriceId,
      billingInterval = 'month', 
      additionalSeats = 0,
      successUrl,
      cancelUrl 
    } = body;
    
    logStep('Request params', { planId, directPriceId, billingInterval, additionalSeats });
    
    if (!['month', 'year'].includes(billingInterval)) {
      return new Response(
        JSON.stringify({ error: 'Invalid billing interval. Must be "month" or "year"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Allow either planId or direct priceId
    let selectedPriceId: string;
    if (directPriceId) {
      selectedPriceId = directPriceId;
    } else if (planId && PRICE_IDS[billingInterval]?.[planId]) {
      selectedPriceId = PRICE_IDS[billingInterval][planId];
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid plan ID or price ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Get admin client for profile updates
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if user is a team member (not an owner)
    const { data: membership } = await supabaseAdmin
      .from('account_users')
      .select('account_id, role')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    // If user is a team member (not owner), they can't start their own subscription
    if (membership && membership.role !== 'owner') {
      logStep('User is team member, cannot start own subscription', { role: membership.role });
      return new Response(
        JSON.stringify({ 
          error: 'Team members cannot start subscriptions. Please contact your account owner to upgrade.' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user's profile for existing subscription and trial usage
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('trial_used_at, subscription_status, stripe_customer_id')
      .eq('id', user.id)
      .single();

    const hasUsedTrial = !!profile?.trial_used_at;
    const hasActiveSubscription = profile?.subscription_status === 'active';
    
    logStep('Profile check', { hasUsedTrial, hasActiveSubscription, trialUsedAt: profile?.trial_used_at });

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    // Check if customer exists in Stripe
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep('Existing Stripe customer found', { customerId });
    }

    logStep('Using price ID', { selectedPriceId, billingInterval });

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price: selectedPriceId,
        quantity: 1,
      },
    ];

    if (additionalSeats > 0) {
      const seatPriceId = SEAT_PRICE_IDS[billingInterval];
      lineItems.push({
        price: seatPriceId,
        quantity: additionalSeats,
      });
      logStep('Adding seats to subscription', { additionalSeats, seatPriceId });
    }

    // Determine if user is eligible for trial (first-time only)
    const isEligibleForTrial = !hasUsedTrial && !hasActiveSubscription;
    logStep('Trial eligibility', { isEligibleForTrial, hasUsedTrial, hasActiveSubscription });

    // Build subscription data
    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: {
        plan: planId,
        user_id: user.id,
        billing_interval: billingInterval,
      },
    };

    // Only add trial if user has never had one
    if (isEligibleForTrial) {
      subscriptionData.trial_period_days = 14;
      logStep('Adding 14-day trial to subscription');
    } else {
      logStep('No trial - user has already used their trial or has active subscription');
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: lineItems,
      mode: 'subscription',
      subscription_data: subscriptionData,
      success_url: `${req.headers.get('origin')}/dashboard?checkout=success`,
      cancel_url: `${req.headers.get('origin')}/dashboard?checkout=cancelled`,
      metadata: {
        user_id: user.id,
        plan: planId,
        billing_interval: billingInterval,
        additional_seats: String(additionalSeats),
        is_first_trial: isEligibleForTrial ? 'true' : 'false',
      },
    });

    logStep('Checkout session created', { 
      sessionId: session.id, 
      billingInterval,
      hasTrial: isEligibleForTrial 
    });

    // Mark trial as used if this is their first subscription attempt
    // (We mark it now to prevent race conditions with multiple checkout attempts)
    if (isEligibleForTrial && !profile?.trial_used_at) {
      await supabaseAdmin
        .from('profiles')
        .update({ 
          trial_used_at: new Date().toISOString(),
          stripe_customer_id: session.customer as string || profile?.stripe_customer_id,
          billing_interval: billingInterval,
        })
        .eq('id', user.id);
      
      logStep('Marked trial as used for user');
    } else if (!customerId && session.customer) {
      // Just update customer ID if new customer
      await supabaseAdmin
        .from('profiles')
        .update({ 
          stripe_customer_id: session.customer as string,
          billing_interval: billingInterval,
        })
        .eq('id', user.id);
      
      logStep('Profile updated with customer ID');
    }

    return new Response(
      JSON.stringify({ 
        url: session.url,
        hasTrial: isEligibleForTrial 
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