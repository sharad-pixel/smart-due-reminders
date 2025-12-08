import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ACCEPT-TEAM-INVITE] ${step}${detailsStr}`);
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

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      logStep('User auth failed', { error: userError });
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const user = userData.user;
    logStep('User authenticated', { userId: user.id, email: user.email });

    const body = await req.json();
    const { token: inviteToken } = body;

    if (!inviteToken) {
      return new Response(JSON.stringify({ success: false, error: 'Invite token is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the pending invite
    const { data: invite, error: inviteError } = await supabaseClient
      .from('account_users')
      .select('*')
      .eq('invite_token', inviteToken)
      .eq('status', 'pending')
      .single();

    if (inviteError || !invite) {
      logStep('Invite not found', { error: inviteError });
      return new Response(JSON.stringify({ success: false, error: 'Invalid invite token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if invite is expired
    if (invite.invite_expires_at && new Date(invite.invite_expires_at) < new Date()) {
      logStep('Invite expired', { expires_at: invite.invite_expires_at });
      return new Response(JSON.stringify({ success: false, error: 'Invite has expired' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify email matches (case-insensitive)
    if (invite.email?.toLowerCase() !== user.email?.toLowerCase()) {
      logStep('Email mismatch', { inviteEmail: invite.email, userEmail: user.email });
      return new Response(JSON.stringify({ 
        success: false, 
        error: `This invite was sent to ${invite.email}. Please log in with that email address.` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Accept the invite - update the account_users entry
    const { error: updateError } = await supabaseClient
      .from('account_users')
      .update({
        user_id: user.id,
        status: 'active',
        accepted_at: new Date().toISOString(),
        invite_token: null,
        invite_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invite.id);

    if (updateError) {
      logStep('Failed to update invite', { error: updateError });
      throw updateError;
    }

    logStep('Invite accepted successfully', { 
      userId: user.id, 
      accountId: invite.account_id, 
      role: invite.role 
    });

    // Sync Stripe seat billing
    try {
      const { data: seatCount } = await supabaseClient
        .rpc('get_billable_seat_count', { p_account_id: invite.account_id });

      logStep('Billable seat count', { accountId: invite.account_id, seatCount });

      // Get owner's profile for Stripe subscription
      const { data: ownerProfile } = await supabaseClient
        .from('profiles')
        .select('stripe_subscription_id, billing_interval')
        .eq('id', invite.account_id)
        .single();

      if (ownerProfile?.stripe_subscription_id) {
        // Update Stripe seat quantity
        const Stripe = (await import('https://esm.sh/stripe@18.5.0')).default;
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { 
          apiVersion: '2025-08-27.basil' 
        });

        const SEAT_PRICE_IDS = {
          month: 'price_1SbWueFaeMMSBqclnDqJkOQW',
          year: 'price_1SbWuuFaeMMSBqclX6xqgX9E',
        };

        const billingInterval = ownerProfile.billing_interval === 'year' ? 'year' : 'month';
        const seatPriceId = SEAT_PRICE_IDS[billingInterval];

        const subscription = await stripe.subscriptions.retrieve(ownerProfile.stripe_subscription_id);
        const seatItem = subscription.items.data.find(
          (item: { price: { id: string } }) => 
            item.price.id === SEAT_PRICE_IDS.month || 
            item.price.id === SEAT_PRICE_IDS.year
        );

        if (seatItem) {
          await stripe.subscriptionItems.update(seatItem.id, {
            quantity: seatCount || 1,
            proration_behavior: 'create_prorations',
          });
          logStep('Updated Stripe seat quantity', { quantity: seatCount });
        } else if (seatCount && seatCount > 0) {
          await stripe.subscriptionItems.create({
            subscription: subscription.id,
            price: seatPriceId,
            quantity: seatCount,
            proration_behavior: 'create_prorations',
          });
          logStep('Added Stripe seat line item', { quantity: seatCount });
        }
      }
    } catch (stripeError) {
      logStep('Stripe sync error (non-fatal)', { error: stripeError });
      // Don't fail the invite acceptance if Stripe sync fails
    }

    return new Response(JSON.stringify({ 
      success: true, 
      account_id: invite.account_id,
      role: invite.role
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logStep('Error', { error: error instanceof Error ? error.message : error });
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
