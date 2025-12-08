import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

/**
 * Sync Subscription Status
 * 
 * Fetches the latest subscription data from Stripe and updates the user's profile.
 * Called after returning from Stripe Checkout or Customer Portal to ensure sync.
 * 
 * For team members, this returns the parent account's subscription data.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Price ID to plan mapping - Updated December 2024
const PRICE_TO_PLAN_MAP: Record<string, string> = {
  // New monthly prices ($199 / $499 / $799)
  'price_1SbvygBqszPdRiQvnV7E6rMr': 'starter',
  'price_1SbvzEBqszPdRiQv5C0Vj5JJ': 'growth',
  'price_1SbvzJBqszPdRiQvGtEB1XQx': 'professional',
  // Legacy monthly prices (old pricing)
  'price_1SaNQ5FaeMMSBqcli04PsmKX': 'starter',
  'price_1SaNQKFaeMMSBqclWKbyVTSv': 'growth',
  'price_1SaNVyFaeMMSBqclrcAXjUmm': 'professional',
  // Legacy annual prices
  'price_1SaNWBFaeMMSBqcl6EK9frSv': 'starter',
  'price_1SaNWTFaeMMSBqclXYovl2Hj': 'growth',
  'price_1SaNXGFaeMMSBqcl08sXmTEm': 'professional',
  // Very old legacy prices
  'price_1SX2cyFaeMMSBqclAGkxSliI': 'starter',
  'price_1SX2dkFaeMMSBqclPIjUA6N2': 'growth',
  'price_1SX2duFaeMMSBqclrYq4rikr': 'professional',
};

// Seat price IDs - $75/user/month
const SEAT_PRICE_IDS = [
  'price_1SbvzLBqszPdRiQvI5Dl6LkA',  // New $75/month
  'price_1SbWueFaeMMSBqclnDqJkOQW',  // Legacy monthly
  'price_1SbWuuFaeMMSBqclX6xqgX9E',  // Legacy annual
];

function getBillingInterval(subscription: Stripe.Subscription): 'month' | 'year' {
  const interval = subscription.items.data[0]?.price?.recurring?.interval;
  return interval === 'year' ? 'year' : 'month';
}

function getPlanFromSubscription(subscription: Stripe.Subscription): string {
  for (const item of subscription.items.data) {
    const priceId = item.price.id;
    if (SEAT_PRICE_IDS.includes(priceId)) continue;
    if (PRICE_TO_PLAN_MAP[priceId]) {
      return PRICE_TO_PLAN_MAP[priceId];
    }
  }
  return 'free';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user?.email) {
      throw new Error('User not authenticated');
    }

    logStep('User authenticated', { email: user.email, userId: user.id });

    // Get effective account ID for team members
    const { data: effectiveAccountId, error: effectiveError } = await supabase
      .rpc('get_effective_account_id', { p_user_id: user.id });
    
    if (effectiveError) {
      logStep('Error getting effective account', { error: effectiveError.message });
    }
    
    const accountId = effectiveAccountId || user.id;
    const isTeamMember = accountId !== user.id;
    
    logStep('Effective account determined', { accountId, isTeamMember });

    // Get account owner's profile to find their email for Stripe lookup
    const { data: ownerProfile, error: ownerError } = await supabase
      .from('profiles')
      .select('id, email, stripe_customer_id, stripe_subscription_id, plan_type, billing_interval, subscription_status, current_period_end')
      .eq('id', accountId)
      .single();

    if (ownerError || !ownerProfile) {
      throw new Error('Account owner profile not found');
    }

    logStep('Owner profile loaded', { 
      ownerId: ownerProfile.id, 
      ownerEmail: ownerProfile.email,
      existingPlan: ownerProfile.plan_type 
    });

    // If this is a team member, just return the owner's existing subscription data
    // without querying Stripe (only owners should sync their own subscription)
    if (isTeamMember) {
      logStep('Team member requesting subscription data, returning owner data');
      
      // Return owner's subscription data
      return new Response(
        JSON.stringify({
          subscribed: ownerProfile.subscription_status === 'active',
          plan_type: ownerProfile.plan_type || 'free',
          billing_interval: ownerProfile.billing_interval || 'month',
          subscription_status: ownerProfile.subscription_status || 'inactive',
          current_period_end: ownerProfile.current_period_end,
          is_team_member: true,
          owner_email: ownerProfile.email,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For account owners, proceed with Stripe sync
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    // Find customer by owner's email
    const customers = await stripe.customers.list({ email: ownerProfile.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep('No Stripe customer found');
      return new Response(
        JSON.stringify({ 
          subscribed: false,
          plan_type: 'free',
          message: 'No Stripe customer found'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const customerId = customers.data[0].id;
    logStep('Found Stripe customer', { customerId });

    // Update profile with customer ID if not set
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', accountId);

    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    logStep('Fetched subscriptions', { count: subscriptions.data.length });

    if (subscriptions.data.length === 0) {
      // Check for trialing subscriptions
      const trialingSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'trialing',
        limit: 1,
      });

      if (trialingSubscriptions.data.length === 0) {
        logStep('No active or trialing subscription found');
        
        // Update profile to free
        await supabase
          .from('profiles')
          .update({
            stripe_subscription_id: null,
            plan_type: 'free',
            subscription_status: null,
            current_period_end: null,
          })
          .eq('id', accountId);

        return new Response(
          JSON.stringify({ 
            subscribed: false,
            plan_type: 'free',
            message: 'No active subscription'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      subscriptions.data = trialingSubscriptions.data;
    }

    // Retrieve full subscription details to get period dates
    const subscriptionId = subscriptions.data[0].id;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    const planType = getPlanFromSubscription(subscription);
    const billingInterval = getBillingInterval(subscription);

    // Get period dates from subscription or fallback to first item
    const periodStart = subscription.current_period_start || subscription.items.data[0]?.current_period_start;
    const periodEnd = subscription.current_period_end || subscription.items.data[0]?.current_period_end;

    logStep('Subscription retrieved', { 
      subscriptionId: subscription.id, 
      planType, 
      billingInterval,
      status: subscription.status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
    });

    // Update profile with subscription data (using accountId, not user.id)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        plan_type: planType,
        billing_interval: billingInterval,
        subscription_status: subscription.status,
        current_period_end: periodEnd 
          ? new Date(periodEnd * 1000).toISOString() 
          : null,
        trial_ends_at: subscription.trial_end 
          ? new Date(subscription.trial_end * 1000).toISOString() 
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
      })
      .eq('id', accountId);

    if (updateError) {
      logStep('Error updating profile', { error: updateError });
      throw new Error('Failed to update profile');
    }

    logStep('Profile updated successfully');

    return new Response(
      JSON.stringify({
        subscribed: true,
        plan_type: planType,
        billing_interval: billingInterval,
        subscription_status: subscription.status,
        current_period_start: periodStart 
          ? new Date(periodStart * 1000).toISOString() 
          : null,
        current_period_end: periodEnd 
          ? new Date(periodEnd * 1000).toISOString() 
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logStep('ERROR', { message: error instanceof Error ? error.message : 'Unknown error' });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
