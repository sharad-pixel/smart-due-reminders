import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Map Stripe price IDs to plan types
const PRICE_TO_PLAN_MAP: Record<string, string> = {
  'price_1SX2cyFaeMMSBqclAGkxSliI': 'starter',
  'price_1SX2dkFaeMMSBqclPIjUA6N2': 'growth',
  'price_1SX2duFaeMMSBqclrYq4rikr': 'pro',
};

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
        logStep("Checkout completed", { sessionId: session.id, customerId: session.customer });

        if (session.mode === 'subscription' && session.customer) {
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;

          // Get subscription details to determine plan
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price.id;
          const planType = PRICE_TO_PLAN_MAP[priceId] || 'free';

          // Update user profile with subscription info
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              plan_type: planType,
              trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
            })
            .eq('stripe_customer_id', customerId);

          if (updateError) {
            logStep("Error updating profile after checkout", { error: updateError });
          } else {
            logStep("Profile updated after checkout", { customerId, planType });
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
        const priceId = subscription.items.data[0]?.price.id;
        const planType = PRICE_TO_PLAN_MAP[priceId] || 'free';

        // Update profile with latest subscription status
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            stripe_subscription_id: subscription.id,
            plan_type: planType,
            trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
          })
          .eq('stripe_customer_id', customerId);

        if (updateError) {
          logStep("Error updating profile on subscription change", { error: updateError });
        } else {
          logStep("Profile updated on subscription change", { customerId, planType, status: subscription.status });
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
            trial_ends_at: null,
          })
          .eq('stripe_customer_id', customerId);

        if (updateError) {
          logStep("Error downgrading profile on subscription deletion", { error: updateError });
        } else {
          logStep("Profile downgraded to free", { customerId });
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
            const priceId = subscription.items.data[0]?.price.id;
            const planType = PRICE_TO_PLAN_MAP[priceId] || 'free';

            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                stripe_subscription_id: subscriptionId,
                plan_type: planType,
              })
              .eq('stripe_customer_id', customerId);

            if (updateError) {
              logStep("Error activating subscription after payment", { error: updateError });
            } else {
              logStep("Subscription activated after successful payment", { customerId, planType });
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

        // Optionally handle payment failures (send notification, grace period, etc.)
        // For now, Stripe will retry automatically
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
