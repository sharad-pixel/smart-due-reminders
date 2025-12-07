import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@18.5.0';

/**
 * Sync Seat Billing Edge Function
 * 
 * Updates Stripe subscription seat quantity when team members are added/removed.
 * Supports both monthly and annual billing intervals with 20% annual discount.
 * 
 * BILLING LOGIC:
 * - Primary account owner is FREE (included in base plan)
 * - Each additional ACTIVE user = 1 billable seat
 * - Monthly: $75/user/month
 * - Annual: $720/user/year (20% discount)
 * 
 * ACTIVATION TRIGGERS:
 * - Call this after: invite accepted, user enabled, user disabled, user removed
 * 
 * FUTURE ENHANCEMENT NOTE:
 * - Later we may support upgrading/downgrading between monthly and annual mid-term
 *   with appropriate proration and renewal dates.
 * - For now, interval is set at signup and only changed manually by Admin + support.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Seat pricing configuration
const SEAT_PRICING = {
  monthly: 75.00,
  annual: 720.00, // $75 * 12 * 0.8 = 20% discount
};

// Seat price IDs (must match Stripe configuration)
const SEAT_PRICE_IDS = {
  month: 'price_1SbWueFaeMMSBqclnDqJkOQW',  // $75/user/month
  year: 'price_1SbWuuFaeMMSBqclX6xqgX9E',   // $720/user/year
};

interface SyncRequest {
  accountId: string;
  action: 'recalculate' | 'preview';
}

interface ProfileData {
  email: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  billing_interval: string | null;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-SEAT-BILLING] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const user = userData.user;
    const { accountId, action = 'preview' }: SyncRequest = await req.json();

    // Determine which account to calculate for
    const targetAccountId = accountId || user.id;

    logStep('Starting', { targetAccountId, action });

    // Get all active users for this account
    const { data: accountUsers, error: usersError } = await supabaseClient
      .from('account_users')
      .select('id, user_id, role, status')
      .eq('account_id', targetAccountId)
      .eq('status', 'active');

    if (usersError) {
      logStep('Error fetching users', { error: usersError });
      throw usersError;
    }

    // Calculate seat counts
    const activeUsers = accountUsers || [];
    const ownerCount = activeUsers.filter(u => u.role === 'owner').length;
    const totalActiveCount = activeUsers.length;
    
    // Owner is free, additional users are billable
    const billableSeats = Math.max(0, totalActiveCount - ownerCount);

    // Get account owner's profile to determine billing interval
    const { data: ownerProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('email, stripe_customer_id, stripe_subscription_id, billing_interval')
      .eq('id', targetAccountId)
      .single() as { data: ProfileData | null; error: any };

    const billingInterval = (ownerProfile?.billing_interval === 'year' ? 'year' : 'month') as 'month' | 'year';
    const pricePerSeat = billingInterval === 'year' ? SEAT_PRICING.annual : SEAT_PRICING.monthly;
    const estimatedCost = billableSeats * pricePerSeat;

    logStep('Calculation complete', {
      totalActiveCount,
      ownerCount,
      billableSeats,
      billingInterval,
      pricePerSeat,
      estimatedCost,
    });

    // If just previewing, return the calculation
    if (action === 'preview') {
      return new Response(JSON.stringify({
        success: true,
        preview: true,
        totalActiveUsers: totalActiveCount,
        ownerCount,
        billableSeats,
        billingInterval,
        pricePerSeat,
        estimatedCost,
        costLabel: billingInterval === 'year' ? 'per year' : 'per month',
        stripeConfigured: !!ownerProfile?.stripe_subscription_id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For 'recalculate' action, update Stripe
    if (!ownerProfile?.stripe_subscription_id) {
      logStep('No active subscription found');
      return new Response(JSON.stringify({
        success: true,
        message: 'No active subscription to update',
        billableSeats,
        billingInterval,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Stripe secret key
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      logStep('STRIPE_SECRET_KEY not set');
      return new Response(JSON.stringify({
        success: false,
        error: 'Stripe not configured',
        billableSeats,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' });

    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(ownerProfile.stripe_subscription_id);
    
    // Determine which seat price to use based on billing interval
    const seatPriceId = SEAT_PRICE_IDS[billingInterval];
    
    // Find the seat line item (check both monthly and annual)
    const seatItem = subscription.items.data.find(
      (item: { price: { id: string } }) => 
        item.price.id === SEAT_PRICE_IDS.month || 
        item.price.id === SEAT_PRICE_IDS.year
    );

    let previousSeatCount = 0;

    if (seatItem) {
      previousSeatCount = seatItem.quantity || 0;
      
      // Check if the seat price matches the current billing interval
      const currentSeatPriceId = seatItem.price.id;
      const correctPriceId = seatPriceId;
      
      if (billableSeats === 0) {
        // Remove seat item if no billable seats
        await stripe.subscriptionItems.del(seatItem.id, {
          proration_behavior: 'create_prorations',
        });
        logStep('Removed seat line item (0 billable seats)');
      } else if (currentSeatPriceId !== correctPriceId) {
        // Price ID mismatch - need to swap (this happens when billing interval changes)
        // Remove old and add new
        await stripe.subscriptionItems.del(seatItem.id, {
          proration_behavior: 'create_prorations',
        });
        await stripe.subscriptionItems.create({
          subscription: subscription.id,
          price: correctPriceId,
          quantity: billableSeats,
          proration_behavior: 'create_prorations',
        });
        logStep('Swapped seat price for billing interval change', { 
          from: currentSeatPriceId, 
          to: correctPriceId,
          quantity: billableSeats 
        });
      } else {
        // Same price, just update quantity
        await stripe.subscriptionItems.update(seatItem.id, {
          quantity: billableSeats,
          proration_behavior: 'create_prorations',
        });
        logStep('Updated seat quantity', { from: previousSeatCount, to: billableSeats });
      }
    } else if (billableSeats > 0) {
      // Add new seat line item
      await stripe.subscriptionItems.create({
        subscription: subscription.id,
        price: seatPriceId,
        quantity: billableSeats,
        proration_behavior: 'create_prorations',
      });
      logStep('Added seat line item', { quantity: billableSeats, priceId: seatPriceId });
    }

    // Log audit event
    await supabaseClient.from('audit_logs').insert({
      user_id: user.id,
      action_type: 'seat_billing_sync',
      resource_type: 'subscription',
      resource_id: ownerProfile.stripe_subscription_id,
      old_values: { seat_count: previousSeatCount },
      new_values: { seat_count: billableSeats, billing_interval: billingInterval },
      metadata: { 
        account_id: targetAccountId,
        action: action,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      billableSeats,
      previousSeatCount,
      billingInterval,
      pricePerSeat,
      estimatedCost,
      stripeUpdated: true,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logStep('Error', { error: error instanceof Error ? error.message : error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
