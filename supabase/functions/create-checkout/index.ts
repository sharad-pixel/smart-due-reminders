import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Price IDs for each plan - synced with Stripe
// Note: 'professional' from pricing page maps to 'pro' in the database
const PLAN_PRICE_IDS: Record<string, string> = {
  'starter': 'price_1SX2cyFaeMMSBqclAGkxSliI',      // $99/month - 50 invoices
  'growth': 'price_1SX2dkFaeMMSBqclPIjUA6N2',       // $199/month - 200 invoices
  'professional': 'price_1SX2duFaeMMSBqclrYq4rikr', // $399/month - 500 invoices, team features
  'pro': 'price_1SX2duFaeMMSBqclrYq4rikr'           // $399/month - DB value
};

// Metered price for invoice overages - $1 per invoice over plan limit
const OVERAGE_PRICE_ID = 'price_1SX35zFaeMMSBqclPXpUHQmv';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { planId } = await req.json();
    
    if (!planId || !PLAN_PRICE_IDS[planId]) {
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

    console.log('Creating checkout for user:', user.email, 'plan:', planId);

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      console.log('Existing customer found:', customerId);
    }

    // Create checkout session with 14-day trial
    // Note: Metered overage pricing is added via webhook after subscription creation
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: PLAN_PRICE_IDS[planId],
          quantity: 1,
        },
      ],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: 14,
      },
      success_url: `${req.headers.get('origin')}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/pricing`,
    });

    console.log('Checkout session created:', session.id);

    // Update profile with Stripe customer ID if new
    if (!customerId && session.customer) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          stripe_customer_id: session.customer as string
        })
        .eq('id', user.id);
      
      if (updateError) {
        console.error('Failed to update profile with customer ID:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-checkout:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
