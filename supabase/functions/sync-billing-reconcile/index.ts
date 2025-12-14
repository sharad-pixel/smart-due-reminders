import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@18.5.0';

/**
 * Sync Billing Reconcile Edge Function
 * 
 * Reconciles database seat/usage state with Stripe billing.
 * Creates charges for any unbilled items found in the database.
 * 
 * Actions:
 * - 'preview': Returns what would be charged without making changes
 * - 'reconcile': Creates missing Stripe charges and syncs state
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SEAT_PRICE_IDS = {
  month: 'price_1SbvzLBqszPdRiQvI5Dl6LkA',
  year: 'price_1SbvzLBqszPdRiQvI5Dl6LkA', // Using same for now
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-BILLING-RECONCILE] ${step}${detailsStr}`);
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
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'preview';

    logStep('Starting reconciliation', { userId: user.id, action });

    // Get user's profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, email, stripe_customer_id, stripe_subscription_id, billing_interval, plan_type')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found');
    }

    logStep('Profile found', { 
      hasStripeCustomer: !!profile.stripe_customer_id,
      hasSubscription: !!profile.stripe_subscription_id,
      planType: profile.plan_type
    });

    // Get database seat count (active + pending + disabled within billing period)
    const { data: accountUsers, error: usersError } = await supabaseClient
      .from('account_users')
      .select('id, user_id, role, status, is_owner, seat_billing_ends_at')
      .eq('account_id', user.id);

    if (usersError) throw usersError;

    // Calculate billable seats from database
    const dbActiveSeats = (accountUsers || []).filter(u => 
      !u.is_owner && u.status === 'active'
    ).length;
    
    const dbDisabledWithBilling = (accountUsers || []).filter(u => 
      !u.is_owner && 
      u.status === 'disabled' && 
      u.seat_billing_ends_at && 
      new Date(u.seat_billing_ends_at) > new Date()
    ).length;
    
    const dbPendingSeats = (accountUsers || []).filter(u => 
      !u.is_owner && u.status === 'pending'
    ).length;
    
    const totalDbBillableSeats = dbActiveSeats + dbDisabledWithBilling + dbPendingSeats;

    logStep('Database seat analysis', { 
      dbActiveSeats, 
      dbDisabledWithBilling, 
      dbPendingSeats,
      totalDbBillableSeats 
    });

    // Initialize Stripe
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Stripe not configured',
        dbSeats: totalDbBillableSeats,
        stripeSeats: 0,
        discrepancy: totalDbBillableSeats,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' });

    // Check if customer exists in Stripe
    let stripeCustomerId = profile.stripe_customer_id;
    let stripeSubscriptionId = profile.stripe_subscription_id;
    let stripeSeats = 0;
    let subscriptionStatus = 'none';

    if (stripeCustomerId) {
      // Verify customer exists in Stripe first
      try {
        await stripe.customers.retrieve(stripeCustomerId);
      } catch (err: any) {
        if (err.code === 'resource_missing' || err.statusCode === 404 || err.message?.includes('No such customer')) {
          logStep('Stripe customer not found, clearing stale reference');
          // Clear the stale customer ID from the database
          await supabaseClient
            .from('profiles')
            .update({ stripe_customer_id: null, stripe_subscription_id: null })
            .eq('id', user.id);
          
          return new Response(JSON.stringify({
            success: false,
            error: 'Stripe billing account not found. Please re-subscribe to a plan.',
            dbSeats: totalDbBillableSeats,
            stripeSeats: 0,
            needsResubscribe: true,
          }), {
            status: 200, // Return 200 so frontend handles gracefully
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw err;
      }

      // Check for existing subscription
      const subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: 'active',
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        const subscription = subscriptions.data[0];
        stripeSubscriptionId = subscription.id;
        subscriptionStatus = subscription.status;

        // Find seat line item
        const seatItem = subscription.items.data.find(
          (item: { price: { id: string } }) => 
            item.price.id === SEAT_PRICE_IDS.month || 
            item.price.id === SEAT_PRICE_IDS.year
        );

        if (seatItem) {
          stripeSeats = seatItem.quantity || 0;
        }
      }
    }

    const discrepancy = totalDbBillableSeats - stripeSeats;

    logStep('Stripe analysis', { 
      stripeCustomerId, 
      stripeSubscriptionId, 
      stripeSeats,
      subscriptionStatus,
      discrepancy 
    });

    // If just preview, return the analysis
    if (action === 'preview') {
      return new Response(JSON.stringify({
        success: true,
        preview: true,
        dbSeats: totalDbBillableSeats,
        stripeSeats,
        discrepancy,
        needsReconciliation: discrepancy !== 0,
        hasSubscription: !!stripeSubscriptionId,
        subscriptionStatus,
        breakdown: {
          activeSeats: dbActiveSeats,
          pendingSeats: dbPendingSeats,
          disabledWithBilling: dbDisabledWithBilling,
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Perform reconciliation
    if (!stripeCustomerId || !stripeSubscriptionId) {
      // Return 200 with info so UI handles gracefully - user has a plan in DB but no Stripe subscription
      return new Response(JSON.stringify({
        success: false,
        noSubscription: true,
        message: 'No active Stripe subscription found. Your plan may have been set up manually or requires re-subscription.',
        dbSeats: totalDbBillableSeats,
        stripeSeats: 0,
        planType: profile.plan_type,
        breakdown: {
          activeSeats: dbActiveSeats,
          pendingSeats: dbPendingSeats,
          disabledWithBilling: dbDisabledWithBilling,
        }
      }), {
        status: 200, // Return 200 so frontend handles gracefully
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (discrepancy === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Billing is already in sync',
        dbSeats: totalDbBillableSeats,
        stripeSeats,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the subscription
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const billingInterval = (profile.billing_interval === 'year' ? 'year' : 'month') as 'month' | 'year';
    const seatPriceId = SEAT_PRICE_IDS[billingInterval];

    // Find existing seat item
    const seatItem = subscription.items.data.find(
      (item: { price: { id: string } }) => 
        item.price.id === SEAT_PRICE_IDS.month || 
        item.price.id === SEAT_PRICE_IDS.year
    );

    if (seatItem) {
      if (totalDbBillableSeats === 0) {
        // Remove seat item entirely
        await stripe.subscriptionItems.del(seatItem.id, {
          proration_behavior: 'create_prorations',
        });
        logStep('Removed seat line item');
      } else {
        // Update quantity
        await stripe.subscriptionItems.update(seatItem.id, {
          quantity: totalDbBillableSeats,
          proration_behavior: 'create_prorations',
        });
        logStep('Updated seat quantity', { from: stripeSeats, to: totalDbBillableSeats });
      }
    } else if (totalDbBillableSeats > 0) {
      // Add new seat line item
      await stripe.subscriptionItems.create({
        subscription: subscription.id,
        price: seatPriceId,
        quantity: totalDbBillableSeats,
        proration_behavior: 'create_prorations',
      });
      logStep('Added seat line item', { quantity: totalDbBillableSeats });
    }

    // Log audit event
    await supabaseClient.from('audit_logs').insert({
      user_id: user.id,
      action_type: 'billing_reconciliation',
      resource_type: 'subscription',
      resource_id: stripeSubscriptionId,
      old_values: { stripe_seats: stripeSeats },
      new_values: { stripe_seats: totalDbBillableSeats, db_seats: totalDbBillableSeats },
      metadata: { 
        discrepancy,
        action: 'reconcile',
      },
    });

    return new Response(JSON.stringify({
      success: true,
      reconciled: true,
      previousStripeSeats: stripeSeats,
      newStripeSeats: totalDbBillableSeats,
      discrepancyResolved: discrepancy,
      message: `Successfully updated Stripe billing from ${stripeSeats} to ${totalDbBillableSeats} seats`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logStep('Error', { error: error instanceof Error ? error.message : error });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
