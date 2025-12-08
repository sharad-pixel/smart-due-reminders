import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CUSTOMER-PORTAL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user?.email) {
      throw new Error('User not authenticated');
    }

    logStep('User authenticated', { email: user.email, userId: user.id });

    // First check if user already has a stripe_customer_id in their profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      logStep('Error fetching profile', { error: profileError });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    let customerId: string = '';

    // Use existing customer ID from profile if available, but verify it exists in Stripe
    if (profile?.stripe_customer_id) {
      try {
        await stripe.customers.retrieve(profile.stripe_customer_id);
        customerId = profile.stripe_customer_id;
        logStep('Verified existing customer from profile', { customerId });
      } catch (retrieveError) {
        logStep('Stored customer ID invalid, will search/create', { storedId: profile.stripe_customer_id });
        // Customer doesn't exist in Stripe, will fall through to search/create
      }
    }

    // If no valid customer ID, search or create
    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      
      if (customers.data.length === 0) {
        logStep('No customer found, creating new Stripe customer');
        
        const newCustomer = await stripe.customers.create({
          email: user.email,
          name: user.user_metadata?.name || user.user_metadata?.full_name || undefined,
          metadata: {
            supabase_user_id: user.id,
          },
        });
        
        customerId = newCustomer.id;
        logStep('New customer created', { customerId });
      } else {
        customerId = customers.data[0].id;
        logStep('Existing customer found in Stripe', { customerId });
      }

      // Update profile with valid stripe_customer_id
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
      
      if (updateError) {
        logStep('Error updating profile with customer ID', { error: updateError });
      } else {
        logStep('Profile updated with Stripe customer ID', { customerId });
      }
    }

    // Create portal session
    const origin = req.headers.get('origin') || 'https://recouply.ai';
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/profile`,
    });

    logStep('Portal session created', { sessionId: portalSession.id });

    return new Response(
      JSON.stringify({ url: portalSession.url }),
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
