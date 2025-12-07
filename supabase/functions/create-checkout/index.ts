import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

/**
 * Create Checkout Session Edge Function
 * 
 * Supports both monthly and annual billing with 20% annual discount.
 * Also handles seat-based billing for team members.
 * 
 * PRICING STRUCTURE:
 * - Monthly: Standard pricing
 * - Annual: 20% discount (price * 12 * 0.8)
 * - Seats: $75/month or $720/year (20% discount)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// STRIPE PRICE IDs - Centralized configuration
// NOTE: Update these when switching between Test and Live modes
// ============================================================================
const PRICE_IDS: Record<string, Record<string, string>> = {
  month: {
    starter: 'price_1SaNQ5FaeMMSBqcli04PsmKX',      // $99/month
    growth: 'price_1SaNQKFaeMMSBqclWKbyVTSv',       // $199/month
    professional: 'price_1SaNVyFaeMMSBqclrcAXjUmm', // $499/month
  },
  year: {
    starter: 'price_1SaNWBFaeMMSBqcl6EK9frSv',      // $950.40/year (20% off)
    growth: 'price_1SaNWTFaeMMSBqclXYovl2Hj',       // $1,910.40/year (20% off)
    professional: 'price_1SaNXGFaeMMSBqcl08sXmTEm', // $4,790.40/year (20% off)
  }
};

// Seat add-on prices (20% annual discount)
const SEAT_PRICE_IDS: Record<string, string> = {
  month: 'price_1SbWueFaeMMSBqclnDqJkOQW',  // $75/user/month
  year: 'price_1SbWuuFaeMMSBqclX6xqgX9E',   // $720/user/year (20% off)
};

// Overage price for metered billing
const OVERAGE_PRICE_ID = 'price_1SaNZ7FaeMMSBqcleUXkrzWl';

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
    
    const { planId, billingInterval = 'month', additionalSeats = 0 } = await req.json();
    logStep('Request params', { planId, billingInterval, additionalSeats });
    
    // Validate billing interval
    if (!['month', 'year'].includes(billingInterval)) {
      return new Response(
        JSON.stringify({ error: 'Invalid billing interval. Must be "month" or "year"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate plan
    if (!planId || !PRICE_IDS[billingInterval]?.[planId]) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user?.email) {
      throw new Error('User not authenticated');
    }

    logStep('User authenticated', { email: user.email });

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep('Existing customer found', { customerId });
    }

    const priceId = PRICE_IDS[billingInterval][planId];
    logStep('Using price ID', { priceId, billingInterval });

    // Build line items (overage is metered and reported separately via track-invoice-usage)
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price: priceId,
        quantity: 1,
      },
    ];

    // Add seat line item if additional seats requested
    if (additionalSeats > 0) {
      const seatPriceId = SEAT_PRICE_IDS[billingInterval];
      lineItems.push({
        price: seatPriceId,
        quantity: additionalSeats,
      });
      logStep('Adding seats to subscription', { additionalSeats, seatPriceId });
    }
    
    logStep('Line items prepared', { lineItemsCount: lineItems.length });

    // Create checkout session with trial
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: lineItems,
      mode: 'subscription',
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          plan: planId,
          user_id: user.id,
          billing_interval: billingInterval,
        },
      },
      success_url: `${req.headers.get('origin')}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/pricing`,
      metadata: {
        user_id: user.id,
        plan: planId,
        billing_interval: billingInterval,
        additional_seats: String(additionalSeats),
      },
    });

    logStep('Checkout session created', { sessionId: session.id, billingInterval });

    // Update profile with Stripe customer ID if new
    if (!customerId && session.customer) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      await supabaseAdmin
        .from('profiles')
        .update({ 
          stripe_customer_id: session.customer as string,
          billing_interval: billingInterval,
        })
        .eq('id', user.id);
        
      logStep('Profile updated with customer ID and billing interval');
    }

    return new Response(
      JSON.stringify({ url: session.url }),
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
