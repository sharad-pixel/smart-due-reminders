import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

/**
 * Process Subscription Expiry Overages
 * 
 * When a subscription expires/cancels, this function:
 * 1. Calculates how many invoices exceed the free tier limit (15)
 * 2. Creates a Stripe charge for the overages at $1.99/invoice
 * 3. Updates the usage records accordingly
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FREE_TIER_LIMIT = 15;
const OVERAGE_RATE = 1.99; // $1.99 per invoice

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-SUBSCRIPTION-EXPIRY] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const { user_id, stripe_customer_id } = await req.json();
    
    if (!user_id && !stripe_customer_id) {
      throw new Error("Either user_id or stripe_customer_id is required");
    }

    // Get user profile
    let profile;
    if (user_id) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, stripe_customer_id, plan_type')
        .eq('id', user_id)
        .single();
      
      if (error) throw new Error(`Profile not found: ${error.message}`);
      profile = data;
    } else {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, stripe_customer_id, plan_type')
        .eq('stripe_customer_id', stripe_customer_id)
        .single();
      
      if (error) throw new Error(`Profile not found: ${error.message}`);
      profile = data;
    }

    if (!profile?.stripe_customer_id) {
      logStep("No Stripe customer ID found - cannot charge overages");
      return new Response(JSON.stringify({
        success: false,
        message: "No Stripe customer ID found"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Profile found", { userId: profile.id, stripeCustomerId: profile.stripe_customer_id });

    // Count ALL countable invoices for this user (not filtered by month)
    // When subscription expires, we charge for all invoices above the free tier limit
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('id, created_at, is_overage')
      .eq('user_id', profile.id)
      .in('status', ['Open', 'InPaymentPlan', 'Paid', 'PartiallyPaid', 'Settled'])
      .eq('is_overage', false) // Only count invoices not already marked as overage
      .order('created_at', { ascending: true });

    if (invoicesError) {
      throw new Error(`Error fetching invoices: ${invoicesError.message}`);
    }

    const totalInvoices = invoices?.length || 0;
    
    // Check if overages have already been processed by looking at invoice_usage
    // Get the most recent usage record
    const { data: existingUsage } = await supabase
      .from('invoice_usage')
      .select('*')
      .eq('user_id', profile.id)
      .order('month', { ascending: false })
      .limit(1)
      .single();

    // Calculate how many invoices have already been charged for
    const alreadyChargedOverages = existingUsage?.overage_invoices || 0;
    const includedUsed = existingUsage?.included_invoices_used || 0;
    
    // Calculate the overage: total invoices minus free tier, minus already charged overages
    const overageCount = Math.max(0, totalInvoices - FREE_TIER_LIMIT - alreadyChargedOverages);

    logStep("Invoice count calculated", { 
      totalInvoices, 
      freeTierLimit: FREE_TIER_LIMIT, 
      alreadyChargedOverages,
      overageCount 
    });

    if (overageCount === 0) {
      logStep("No new overage invoices - nothing to charge");
      return new Response(JSON.stringify({
        success: true,
        message: "No new overage invoices",
        totalInvoices,
        alreadyChargedOverages,
        overageCount: 0,
        chargeAmount: 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    // Get current month for usage record
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Calculate charge amount in cents
    const chargeAmountCents = Math.round(overageCount * OVERAGE_RATE * 100);
    const chargeAmountDollars = overageCount * OVERAGE_RATE;

    logStep("Calculating overage charge", { 
      overageCount, 
      ratePerInvoice: OVERAGE_RATE,
      chargeAmountCents,
      chargeAmountDollars
    });

    // Check if customer has a default payment method
    const customer = await stripe.customers.retrieve(profile.stripe_customer_id) as Stripe.Customer;
    
    if (customer.deleted) {
      throw new Error("Stripe customer has been deleted");
    }

    const paymentMethodId = customer.invoice_settings?.default_payment_method as string | null 
      || customer.default_source as string | null;

    if (!paymentMethodId) {
      logStep("No payment method on file - creating invoice instead");
      
      // Create an invoice for the overage charges
      const invoice = await stripe.invoices.create({
        customer: profile.stripe_customer_id,
        collection_method: 'send_invoice',
        days_until_due: 7,
        description: `Invoice overage charges for ${currentMonth}`,
        metadata: {
          type: 'subscription_expiry_overage',
          user_id: profile.id,
          month: currentMonth,
          overage_count: String(overageCount),
        },
      });

      // Add line item for overages
      await stripe.invoiceItems.create({
        customer: profile.stripe_customer_id,
        invoice: invoice.id,
        amount: chargeAmountCents,
        currency: 'usd',
        description: `${overageCount} invoice${overageCount > 1 ? 's' : ''} above free tier limit (15) @ $${OVERAGE_RATE}/invoice`,
      });

      // Finalize and send the invoice
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
      await stripe.invoices.sendInvoice(invoice.id);

      logStep("Invoice created and sent", { 
        invoiceId: finalizedInvoice.id,
        amount: chargeAmountDollars
      });

      // Update usage record - add to existing overages
      const newTotalOverages = alreadyChargedOverages + overageCount;
      const existingCharges = existingUsage?.overage_charges_total || 0;
      await supabase
        .from('invoice_usage')
        .upsert({
          user_id: profile.id,
          month: currentMonth,
          included_invoices_used: FREE_TIER_LIMIT,
          overage_invoices: newTotalOverages,
          overage_charges_total: existingCharges + chargeAmountDollars,
          last_updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,month' });

      // Mark the newly charged overage invoices (those beyond free tier + already charged)
      const startIndex = FREE_TIER_LIMIT + alreadyChargedOverages;
      const overageInvoiceIds = invoices
        ?.slice(startIndex, startIndex + overageCount)
        .map(inv => inv.id) || [];

      if (overageInvoiceIds.length > 0) {
        await supabase
          .from('invoices')
          .update({ is_overage: true })
          .in('id', overageInvoiceIds);
        logStep("Marked invoices as overage", { count: overageInvoiceIds.length });
      }

      return new Response(JSON.stringify({
        success: true,
        method: 'invoice',
        invoiceId: finalizedInvoice.id,
        totalInvoices,
        overageCount,
        chargeAmount: chargeAmountDollars
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Customer has payment method - create direct charge
    logStep("Creating direct charge", { paymentMethodId });

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: chargeAmountCents,
        currency: 'usd',
        customer: profile.stripe_customer_id,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description: `Invoice overage charges for ${currentMonth}: ${overageCount} invoice${overageCount > 1 ? 's' : ''} @ $${OVERAGE_RATE}/invoice`,
        metadata: {
          type: 'subscription_expiry_overage',
          user_id: profile.id,
          month: currentMonth,
          overage_count: String(overageCount),
        },
      });

      logStep("Payment successful", { 
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status
      });

      // Update usage record - add to existing overages
      const newTotalOverages2 = alreadyChargedOverages + overageCount;
      const existingCharges2 = existingUsage?.overage_charges_total || 0;
      await supabase
        .from('invoice_usage')
        .upsert({
          user_id: profile.id,
          month: currentMonth,
          included_invoices_used: FREE_TIER_LIMIT,
          overage_invoices: newTotalOverages2,
          overage_charges_total: existingCharges2 + chargeAmountDollars,
          last_updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,month' });

      // Mark the newly charged overage invoices
      const startIndex2 = FREE_TIER_LIMIT + alreadyChargedOverages;
      const overageInvoiceIds2 = invoices
        ?.slice(startIndex2, startIndex2 + overageCount)
        .map(inv => inv.id) || [];

      if (overageInvoiceIds2.length > 0) {
        await supabase
          .from('invoices')
          .update({ is_overage: true })
          .in('id', overageInvoiceIds2);
        logStep("Marked invoices as overage", { count: overageInvoiceIds2.length });
      }

      return new Response(JSON.stringify({
        success: true,
        method: 'payment_intent',
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        totalInvoices,
        overageCount,
        chargeAmount: chargeAmountDollars
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    } catch (paymentError: any) {
      // If payment fails, create an invoice instead
      logStep("Direct payment failed, creating invoice", { error: paymentError.message });

      const invoice = await stripe.invoices.create({
        customer: profile.stripe_customer_id,
        collection_method: 'send_invoice',
        days_until_due: 7,
        description: `Invoice overage charges for ${currentMonth}`,
        metadata: {
          type: 'subscription_expiry_overage',
          user_id: profile.id,
          month: currentMonth,
          overage_count: String(overageCount),
        },
      });

      await stripe.invoiceItems.create({
        customer: profile.stripe_customer_id,
        invoice: invoice.id,
        amount: chargeAmountCents,
        currency: 'usd',
        description: `${overageCount} invoice${overageCount > 1 ? 's' : ''} above free tier limit (15) @ $${OVERAGE_RATE}/invoice`,
      });

      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
      await stripe.invoices.sendInvoice(invoice.id);

      // Update usage record - add to existing overages
      const newTotalOverages3 = alreadyChargedOverages + overageCount;
      const existingCharges3 = existingUsage?.overage_charges_total || 0;
      await supabase
        .from('invoice_usage')
        .upsert({
          user_id: profile.id,
          month: currentMonth,
          included_invoices_used: FREE_TIER_LIMIT,
          overage_invoices: newTotalOverages3,
          overage_charges_total: existingCharges3 + chargeAmountDollars,
          last_updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,month' });

      // Mark the newly charged overage invoices
      const startIndex3 = FREE_TIER_LIMIT + alreadyChargedOverages;
      const overageInvoiceIds3 = invoices
        ?.slice(startIndex3, startIndex3 + overageCount)
        .map(inv => inv.id) || [];

      if (overageInvoiceIds3.length > 0) {
        await supabase
          .from('invoices')
          .update({ is_overage: true })
          .in('id', overageInvoiceIds3);
        logStep("Marked invoices as overage", { count: overageInvoiceIds3.length });
      }

      return new Response(JSON.stringify({
        success: true,
        method: 'invoice_fallback',
        invoiceId: finalizedInvoice.id,
        paymentError: paymentError.message,
        totalInvoices,
        overageCount,
        chargeAmount: chargeAmountDollars
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
