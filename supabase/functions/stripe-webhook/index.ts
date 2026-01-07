import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Stripe Webhook Handler
 * 
 * Handles subscription lifecycle events and syncs billing data to Supabase.
 * Supports both monthly and annual billing intervals.
 * 
 * Key Events:
 * - checkout.session.completed: Initial subscription setup
 * - customer.subscription.created/updated: Subscription changes
 * - customer.subscription.deleted: Cancellation
 * - invoice.payment_succeeded/failed: Payment events
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// ============================================================================
// STRIPE PRICE ID TO PLAN MAPPING - Updated December 2024
// Maps both monthly and annual price IDs to plan types
// New pricing: Starter $199, Growth $499, Professional $799
// ============================================================================
const PRICE_TO_PLAN_MAP: Record<string, string> = {
  // Current monthly prices (December 2024)
  'price_1ScbGXBfb0dWgtCDpDqTtrC7': 'starter',      // $199/month
  'price_1ScbGbBfb0dWgtCDLjXblCw4': 'growth',       // $499/month
  'price_1ScbGeBfb0dWgtCDrtiXDKiJ': 'professional', // $799/month
  // Current annual prices
  'price_1ScbGZBfb0dWgtCDvfg6hyy6': 'starter',      // annual
  'price_1ScbGcBfb0dWgtCDQpH6uB7A': 'growth',       // annual
  'price_1ScbGfBfb0dWgtCDhCxrFPE4': 'professional', // annual
  // Legacy monthly prices (old pricing)
  'price_1SaNQ5FaeMMSBqcli04PsmKX': 'starter',
  'price_1SaNQKFaeMMSBqclWKbyVTSv': 'growth',
  'price_1SaNVyFaeMMSBqclrcAXjUmm': 'professional',
  // Legacy annual prices (20% discount)
  'price_1SaNWBFaeMMSBqcl6EK9frSv': 'starter',
  'price_1SaNWTFaeMMSBqclXYovl2Hj': 'growth',
  'price_1SaNXGFaeMMSBqcl08sXmTEm': 'professional',
};

// Seat price IDs (not mapped to plans, used for identification) - $75/seat/month
const SEAT_PRICE_IDS = [
  'price_1ScbGhBfb0dWgtCDZukktOuA', // Current monthly $75
  'price_1ScbGiBfb0dWgtCDOrLwli7A', // Current annual $720
  'price_1SbWueFaeMMSBqclnDqJkOQW', // Legacy monthly seat
  'price_1SbWuuFaeMMSBqclX6xqgX9E', // Legacy annual seat
];

/**
 * Extract billing interval from subscription
 */
function getBillingInterval(subscription: Stripe.Subscription): 'month' | 'year' {
  const interval = subscription.items.data[0]?.price?.recurring?.interval;
  return interval === 'year' ? 'year' : 'month';
}

/**
 * Get plan type from subscription (excluding seat items)
 */
function getPlanFromSubscription(subscription: Stripe.Subscription): string {
  for (const item of subscription.items.data) {
    const priceId = item.price.id;
    // Skip seat prices
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
    logStep("Webhook received");

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify webhook signature
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      throw new Error('No signature provided');
    }

    const body = await req.text();
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    
    let event: Stripe.Event;
    
    if (webhookSecret) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        logStep("Webhook signature verified", { type: event.type });
      } catch (err) {
        logStep("Webhook signature verification failed", { error: err });
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      // For testing without webhook secret
      event = JSON.parse(body);
      logStep("Processing webhook without signature verification (dev mode)", { type: event.type });
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        logStep("Checkout completed", { sessionId: session.id, customerId: session.customer, userId });

        if (session.mode === 'subscription' && session.customer) {
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;

          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const planType = getPlanFromSubscription(subscription);
          const billingInterval = getBillingInterval(subscription);

          logStep("Subscription details", { planType, billingInterval, subscriptionId });

          // Build update payload
          const updatePayload = {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan_type: planType,
            billing_interval: billingInterval,
            subscription_status: subscription.status,
            current_period_end: subscription.current_period_end 
              ? new Date(subscription.current_period_end * 1000).toISOString() 
              : null,
            trial_ends_at: subscription.trial_end 
              ? new Date(subscription.trial_end * 1000).toISOString() 
              : null,
            cancel_at_period_end: subscription.cancel_at_period_end,
          };

          // Try to update by user_id first (from session metadata), then by customer_id
          let updateError = null;
          if (userId) {
            const result = await supabase
              .from('profiles')
              .update(updatePayload)
              .eq('id', userId);
            updateError = result.error;
            logStep("Updated profile by user_id", { userId, error: updateError });
          } else {
            const result = await supabase
              .from('profiles')
              .update(updatePayload)
              .eq('stripe_customer_id', customerId);
            updateError = result.error;
            logStep("Updated profile by customer_id", { customerId, error: updateError });
          }

          if (updateError) {
            logStep("Error updating profile after checkout", { error: updateError });
          } else {
            logStep("Profile updated after checkout", { customerId, userId, planType, billingInterval });
          }
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription event", { 
          type: event.type,
          subscriptionId: subscription.id,
          status: subscription.status 
        });

        const customerId = subscription.customer as string;
        const planType = getPlanFromSubscription(subscription);
        const billingInterval = getBillingInterval(subscription);

        // Update profile with latest subscription status
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            stripe_subscription_id: subscription.id,
            plan_type: planType,
            billing_interval: billingInterval,
            current_period_end: subscription.current_period_end 
              ? new Date(subscription.current_period_end * 1000).toISOString() 
              : null,
            trial_ends_at: subscription.trial_end 
              ? new Date(subscription.trial_end * 1000).toISOString() 
              : null,
            cancel_at_period_end: subscription.cancel_at_period_end,
            subscription_status: subscription.status,
          })
          .eq('stripe_customer_id', customerId);

        if (updateError) {
          logStep("Error updating profile on subscription change", { error: updateError });
        } else {
          logStep("Profile updated on subscription change", { 
            customerId, 
            planType, 
            billingInterval,
            status: subscription.status 
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription deleted", { subscriptionId: subscription.id });

        const customerId = subscription.customer as string;

        // Downgrade to free plan
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            stripe_subscription_id: null,
            plan_type: 'free',
            billing_interval: 'month',
            current_period_end: null,
            trial_ends_at: null,
            cancel_at_period_end: false,
            subscription_status: 'canceled',
          })
          .eq('stripe_customer_id', customerId);

        if (updateError) {
          logStep("Error downgrading profile on subscription deletion", { error: updateError });
        } else {
          logStep("Profile downgraded to free", { customerId });
        }

        // Process overage charges for invoices above the free tier limit
        // This charges $1.99 per invoice for any invoices above the 15 free tier limit
        try {
          logStep("Processing subscription expiry overages", { customerId });
          
          const { data: overageResult, error: overageError } = await supabase.functions.invoke(
            'process-subscription-expiry-overages',
            { body: { stripe_customer_id: customerId } }
          );
          
          if (overageError) {
            logStep("Error processing overages (non-blocking)", { error: overageError.message });
          } else {
            logStep("Overage processing complete", { result: overageResult });
          }
        } catch (overageErr) {
          logStep("Exception processing overages (non-blocking)", { 
            error: overageErr instanceof Error ? overageErr.message : String(overageErr) 
          });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice payment succeeded", { 
          invoiceId: invoice.id,
          customerId: invoice.customer 
        });

        // If this is the first invoice of a new subscription, mark as active
        if (invoice.billing_reason === 'subscription_create') {
          const customerId = invoice.customer as string;
          const subscriptionId = invoice.subscription as string;

          if (subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const planType = getPlanFromSubscription(subscription);
            const billingInterval = getBillingInterval(subscription);

            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                stripe_subscription_id: subscriptionId,
                plan_type: planType,
                billing_interval: billingInterval,
                subscription_status: 'active',
              })
              .eq('stripe_customer_id', customerId);

            if (updateError) {
              logStep("Error activating subscription after payment", { error: updateError });
            } else {
              logStep("Subscription activated after successful payment", { customerId, planType, billingInterval });
            }
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice payment failed", { 
          invoiceId: invoice.id,
          customerId: invoice.customer 
        });

        // Update subscription status to past_due and record failure
        const customerId = invoice.customer as string;
        await supabase
          .from('profiles')
          .update({ 
            subscription_status: 'past_due',
            payment_failure_notice_sent_at: null, // Reset to trigger new warning flow
            payment_failure_count: 0,
          })
          .eq('stripe_customer_id', customerId);
        
        logStep("Profile marked as past_due, payment failure flow initiated", { customerId });
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice payment succeeded", { 
          invoiceId: invoice.id,
          customerId: invoice.customer 
        });

        // Clear any payment failure state and unlock account
        const paidCustomerId = invoice.customer as string;
        
        // Get the subscription details if this was a subscription payment
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
          const planType = getPlanFromSubscription(subscription);
          const billingInterval = getBillingInterval(subscription);

          await supabase
            .from('profiles')
            .update({
              subscription_status: 'active',
              is_account_locked: false,
              account_locked_at: null,
              payment_failure_notice_sent_at: null,
              payment_failure_count: 0,
              plan_type: planType,
              billing_interval: billingInterval,
              current_period_end: subscription.current_period_end 
                ? new Date(subscription.current_period_end * 1000).toISOString() 
                : null,
            })
            .eq('stripe_customer_id', paidCustomerId);

          logStep("Account unlocked after successful payment", { customerId: paidCustomerId, planType });
        } else {
          // One-time payment, just clear failure state
          await supabase
            .from('profiles')
            .update({
              is_account_locked: false,
              account_locked_at: null,
              payment_failure_notice_sent_at: null,
              payment_failure_count: 0,
            })
            .eq('stripe_customer_id', paidCustomerId);
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Webhook error", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
