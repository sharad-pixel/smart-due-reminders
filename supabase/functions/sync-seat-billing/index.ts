import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@18.5.0';

/**
 * Sync seat billing with Stripe
 * 
 * This function updates the Stripe subscription quantity when team members
 * are added, activated, or deactivated.
 * 
 * BILLING LOGIC:
 * - Primary account owner is FREE (included in base plan)
 * - Each additional ACTIVE user = 1 billable seat @ $75/month
 * - Seat count = total active users - 1 (owner)
 * 
 * ACTIVATION TRIGGERS:
 * - Call this after: invite accepted, user enabled, user disabled, user removed
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SEAT_PRICE_PER_MONTH = 75.00;

// Set this to the Stripe price ID when configured
// NOTE: This should be set when Stripe integration is activated post-launch
const STRIPE_SEAT_PRICE_ID = Deno.env.get('STRIPE_SEAT_PRICE_ID') || null;

interface SyncRequest {
  accountId: string;
  action: 'recalculate' | 'preview';
}

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

    console.log(`[SYNC-SEAT-BILLING] Starting for account: ${targetAccountId}, action: ${action}`);

    // Get all active users for this account
    const { data: accountUsers, error: usersError } = await supabaseClient
      .from('account_users')
      .select('id, user_id, role, status')
      .eq('account_id', targetAccountId)
      .eq('status', 'active');

    if (usersError) {
      console.error('[SYNC-SEAT-BILLING] Error fetching users:', usersError);
      throw usersError;
    }

    // Calculate seat counts
    const activeUsers = accountUsers || [];
    const ownerCount = activeUsers.filter(u => u.role === 'owner').length;
    const totalActiveCount = activeUsers.length;
    
    // Owner is free, additional users are billable
    const billableSeats = Math.max(0, totalActiveCount - ownerCount);
    const estimatedMonthly = billableSeats * SEAT_PRICE_PER_MONTH;

    console.log(`[SYNC-SEAT-BILLING] Calculation:`, {
      totalActiveCount,
      ownerCount,
      billableSeats,
      estimatedMonthly,
    });

    // If just previewing, return the calculation
    if (action === 'preview') {
      return new Response(JSON.stringify({
        success: true,
        preview: true,
        totalActiveUsers: totalActiveCount,
        ownerCount,
        billableSeats,
        pricePerSeat: SEAT_PRICE_PER_MONTH,
        estimatedMonthly,
        stripeConfigured: !!STRIPE_SEAT_PRICE_ID,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For 'recalculate' action, update Stripe if configured
    if (!STRIPE_SEAT_PRICE_ID) {
      console.log('[SYNC-SEAT-BILLING] Stripe seat price not configured, skipping billing sync');
      return new Response(JSON.stringify({
        success: true,
        message: 'Seat count calculated. Stripe billing sync not yet configured.',
        billableSeats,
        estimatedMonthly,
        stripeConfigured: false,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Stripe secret key
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('[SYNC-SEAT-BILLING] STRIPE_SECRET_KEY not set');
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

    // Get account owner's profile to find Stripe customer
    const { data: ownerProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('email, stripe_customer_id, stripe_subscription_id')
      .eq('id', targetAccountId)
      .single();

    if (profileError || !ownerProfile?.stripe_subscription_id) {
      console.log('[SYNC-SEAT-BILLING] No active subscription found for account');
      return new Response(JSON.stringify({
        success: true,
        message: 'No active subscription to update',
        billableSeats,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(ownerProfile.stripe_subscription_id);

    // Find the seat line item or add it
    const seatItem = subscription.items.data.find(
      (item: { price: { id: string } }) => item.price.id === STRIPE_SEAT_PRICE_ID
    );

    if (seatItem) {
      // Update existing seat quantity
      if (billableSeats === 0) {
        // Remove seat item if no billable seats
        await stripe.subscriptionItems.del(seatItem.id, {
          proration_behavior: 'create_prorations',
        });
        console.log('[SYNC-SEAT-BILLING] Removed seat line item (0 billable seats)');
      } else {
        // Update quantity
        await stripe.subscriptionItems.update(seatItem.id, {
          quantity: billableSeats,
          proration_behavior: 'create_prorations',
        });
        console.log(`[SYNC-SEAT-BILLING] Updated seat quantity to ${billableSeats}`);
      }
    } else if (billableSeats > 0) {
      // Add new seat line item
      await stripe.subscriptionItems.create({
        subscription: subscription.id,
        price: STRIPE_SEAT_PRICE_ID,
        quantity: billableSeats,
        proration_behavior: 'create_prorations',
      });
      console.log(`[SYNC-SEAT-BILLING] Added seat line item with quantity ${billableSeats}`);
    }

    return new Response(JSON.stringify({
      success: true,
      billableSeats,
      estimatedMonthly,
      stripeUpdated: true,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[SYNC-SEAT-BILLING] Error:', error);
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
