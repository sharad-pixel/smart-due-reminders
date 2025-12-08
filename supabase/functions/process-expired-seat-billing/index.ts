import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@18.5.0';

/**
 * Process Expired Seat Billing
 * 
 * This scheduled function runs daily to:
 * 1. Find disabled users whose seat_billing_ends_at has passed
 * 2. Clear their billing end date (marking them as fully removed from billing)
 * 3. Recalculate and sync Stripe seat quantities for affected accounts
 * 
 * This ensures deactivated users remain billable through their paid term.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SEAT_PRICE_IDS = {
  month: 'price_1SbvzLBqszPdRiQvI5Dl6LkA',
  year: 'price_1SbvzLBqszPdRiQvI5Dl6LkA',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[EXPIRED-SEAT-BILLING] ${step}${detailsStr}`);
};

async function updateStripeSeatQuantity(
  stripe: Stripe,
  supabase: any,
  accountId: string,
  seatCount: number
): Promise<{ success: boolean; error?: string }> {
  const { data: ownerProfile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_subscription_id, billing_interval')
    .eq('id', accountId)
    .single();

  if (profileError || !ownerProfile?.stripe_subscription_id) {
    logStep('No active subscription found', { accountId });
    return { success: true };
  }

  const billingInterval = ownerProfile.billing_interval === 'year' ? 'year' : 'month';
  const seatPriceId = SEAT_PRICE_IDS[billingInterval];

  try {
    const subscription = await stripe.subscriptions.retrieve(ownerProfile.stripe_subscription_id);
    
    const seatItem = subscription.items.data.find(
      (item: { price: { id: string } }) => 
        item.price.id === SEAT_PRICE_IDS.month || 
        item.price.id === SEAT_PRICE_IDS.year
    );

    const previousSeatCount = seatItem?.quantity || 0;

    if (seatItem) {
      if (seatCount === 0) {
        await stripe.subscriptionItems.del(seatItem.id, {
          proration_behavior: 'none', // No proration - billing period already paid
        });
        logStep('Removed seat line item after period end', { accountId });
      } else {
        await stripe.subscriptionItems.update(seatItem.id, {
          quantity: seatCount,
          proration_behavior: 'none', // No proration - billing period already paid
        });
        logStep('Updated seat quantity after period end', { 
          accountId, 
          from: previousSeatCount, 
          to: seatCount 
        });
      }
    }

    return { success: true };
  } catch (error) {
    logStep('Stripe error', { error: error instanceof Error ? error.message : error });
    return { success: false, error: error instanceof Error ? error.message : 'Stripe update failed' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' });
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const now = new Date().toISOString();
    logStep('Processing expired seat billing', { now });

    // Find all disabled users whose billing period has ended
    const { data: expiredSeats, error: fetchError } = await supabase
      .from('account_users')
      .select('id, account_id, user_id, email, seat_billing_ends_at')
      .eq('status', 'disabled')
      .not('seat_billing_ends_at', 'is', null)
      .lte('seat_billing_ends_at', now);

    if (fetchError) {
      throw fetchError;
    }

    if (!expiredSeats || expiredSeats.length === 0) {
      logStep('No expired seat billing to process');
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('Found expired seats', { count: expiredSeats.length });

    // Group by account_id to batch Stripe updates
    const accountSeats: Record<string, any[]> = {};
    for (const seat of expiredSeats) {
      if (!accountSeats[seat.account_id]) {
        accountSeats[seat.account_id] = [];
      }
      accountSeats[seat.account_id].push(seat);
    }

    let processedCount = 0;
    const errors: any[] = [];

    for (const [accountId, seats] of Object.entries(accountSeats)) {
      try {
        logStep('Processing account', { accountId, expiredSeats: seats.length });

        // Clear seat_billing_ends_at for expired seats
        const seatIds = seats.map(s => s.id);
        const { error: updateError } = await supabase
          .from('account_users')
          .update({ 
            seat_billing_ends_at: null,
            updated_at: now 
          })
          .in('id', seatIds);

        if (updateError) {
          throw updateError;
        }

        // Calculate new billable seat count (active users only now)
        const { data: activeSeats } = await supabase
          .from('account_users')
          .select('id')
          .eq('account_id', accountId)
          .eq('is_owner', false)
          .eq('status', 'active');

        // Also count any disabled users still in billing period
        const { data: stillBillingSeats } = await supabase
          .from('account_users')
          .select('id')
          .eq('account_id', accountId)
          .eq('is_owner', false)
          .eq('status', 'disabled')
          .not('seat_billing_ends_at', 'is', null)
          .gt('seat_billing_ends_at', now);

        const seatCount = (activeSeats?.length || 0) + (stillBillingSeats?.length || 0);

        // Update Stripe
        const billingResult = await updateStripeSeatQuantity(stripe, supabase, accountId, seatCount);
        
        if (!billingResult.success) {
          errors.push({ accountId, error: billingResult.error });
        }

        // Log audit event
        await supabase.from('audit_logs').insert({
          user_id: accountId,
          action_type: 'expired_seat_billing_processed',
          resource_type: 'subscription',
          resource_id: accountId,
          new_values: { 
            expired_seats: seats.map(s => s.email),
            new_seat_count: seatCount 
          },
          metadata: { processed_at: now },
        });

        processedCount += seats.length;
        logStep('Account processed', { accountId, removedSeats: seats.length, newSeatCount: seatCount });
      } catch (accountError) {
        logStep('Error processing account', { 
          accountId, 
          error: accountError instanceof Error ? accountError.message : accountError 
        });
        errors.push({ accountId, error: accountError instanceof Error ? accountError.message : 'Unknown error' });
      }
    }

    logStep('Completed processing', { processedCount, errors: errors.length });

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: processedCount,
        errors: errors.length > 0 ? errors : undefined 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logStep('Fatal error', { error: error instanceof Error ? error.message : error });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
