import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-STRIPE-INVOICES] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Get the effective account ID for team support
    const { data: effectiveAccountData } = await supabaseClient.rpc('get_effective_account_id', { p_user_id: user.id });
    const effectiveAccountId = effectiveAccountData || user.id;
    logStep("Effective account ID", { effectiveAccountId });

    // Update sync status to 'syncing'
    await supabaseClient
      .from('stripe_integrations')
      .upsert({
        user_id: effectiveAccountId,
        is_connected: true,
        sync_status: 'syncing',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Fetch open and past_due invoices from Stripe
    const invoices: Stripe.Invoice[] = [];
    
    // Get open invoices
    const openInvoices = await stripe.invoices.list({
      status: 'open',
      limit: 100,
      expand: ['data.customer']
    });
    invoices.push(...openInvoices.data);
    logStep("Fetched open invoices", { count: openInvoices.data.length });

    // Get past_due invoices (uncollectible is past due in Stripe terms)
    // In Stripe, invoices don't have a "past_due" status directly - they remain "open"
    // but have a due_date in the past. We'll filter by due_date < today
    
    let syncedCount = 0;
    let createdDebtors = 0;
    const errors: string[] = [];

    for (const stripeInvoice of invoices) {
      try {
        // Skip if no customer
        if (!stripeInvoice.customer) continue;

        const customer = typeof stripeInvoice.customer === 'string' 
          ? null 
          : stripeInvoice.customer as Stripe.Customer;
        
        if (!customer) continue;

        const customerEmail = customer.email || `${customer.id}@stripe-customer.local`;
        const customerName = customer.name || customer.id;

        // Check if debtor exists by stripe_customer_id or email
        let { data: existingDebtor } = await supabaseClient
          .from('debtors')
          .select('id')
          .eq('user_id', effectiveAccountId)
          .or(`email.eq.${customerEmail},external_customer_id.eq.${customer.id}`)
          .maybeSingle();

        let debtorId: string;

        if (!existingDebtor) {
          // Create new debtor for this Stripe customer
          const { data: newDebtor, error: debtorError } = await supabaseClient
            .from('debtors')
            .insert({
              user_id: effectiveAccountId,
              company_name: customerName,
              name: customerName,
              contact_name: customerName,
              email: customerEmail,
              phone: customer.phone || null,
              external_customer_id: customer.id,
              external_system: 'stripe',
              reference_id: `STRIPE-${customer.id.slice(-8).toUpperCase()}`
            })
            .select('id')
            .single();

          if (debtorError) {
            logStep("Error creating debtor", { error: debtorError.message, customerId: customer.id });
            errors.push(`Failed to create debtor for ${customerEmail}: ${debtorError.message}`);
            continue;
          }
          debtorId = newDebtor.id;
          createdDebtors++;
          logStep("Created new debtor", { debtorId, customerEmail });
        } else {
          debtorId = existingDebtor.id;
        }

        // Check if invoice already exists
        const { data: existingInvoice } = await supabaseClient
          .from('invoices')
          .select('id')
          .eq('stripe_invoice_id', stripeInvoice.id)
          .maybeSingle();

        const invoiceData = {
          user_id: effectiveAccountId,
          debtor_id: debtorId,
          invoice_number: stripeInvoice.number || stripeInvoice.id,
          amount: (stripeInvoice.amount_due || 0) / 100, // Convert from cents
          amount_outstanding: (stripeInvoice.amount_remaining || 0) / 100,
          amount_original: (stripeInvoice.total || 0) / 100,
          currency: stripeInvoice.currency?.toUpperCase() || 'USD',
          issue_date: stripeInvoice.created ? new Date(stripeInvoice.created * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          due_date: stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          status: 'Open' as const,
          source_system: 'stripe',
          stripe_invoice_id: stripeInvoice.id,
          stripe_customer_id: customer.id,
          stripe_hosted_url: stripeInvoice.hosted_invoice_url || null,
          external_invoice_id: stripeInvoice.id,
          external_link: stripeInvoice.hosted_invoice_url || null,
          product_description: stripeInvoice.description || stripeInvoice.lines?.data?.[0]?.description || 'Stripe Invoice',
          notes: `Imported from Stripe on ${new Date().toLocaleDateString()}`
        };

        if (existingInvoice) {
          // Update existing invoice
          const { error: updateError } = await supabaseClient
            .from('invoices')
            .update(invoiceData)
            .eq('id', existingInvoice.id);

          if (updateError) {
            errors.push(`Failed to update invoice ${stripeInvoice.id}: ${updateError.message}`);
            continue;
          }
        } else {
          // Create new invoice
          const { error: insertError } = await supabaseClient
            .from('invoices')
            .insert(invoiceData);

          if (insertError) {
            errors.push(`Failed to create invoice ${stripeInvoice.id}: ${insertError.message}`);
            continue;
          }
        }

        syncedCount++;
      } catch (invoiceError) {
        const errorMsg = invoiceError instanceof Error ? invoiceError.message : String(invoiceError);
        errors.push(`Error processing invoice ${stripeInvoice.id}: ${errorMsg}`);
        logStep("Error processing invoice", { invoiceId: stripeInvoice.id, error: errorMsg });
      }
    }

    // Update integration status
    await supabaseClient
      .from('stripe_integrations')
      .update({
        is_connected: true,
        sync_status: errors.length > 0 ? 'partial' : 'success',
        last_sync_at: new Date().toISOString(),
        last_sync_error: errors.length > 0 ? errors.slice(0, 3).join('; ') : null,
        invoices_synced_count: syncedCount,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', effectiveAccountId);

    logStep("Sync completed", { syncedCount, createdDebtors, errorCount: errors.length });

    return new Response(JSON.stringify({
      success: true,
      synced_count: syncedCount,
      created_debtors: createdDebtors,
      total_invoices: invoices.length,
      errors: errors.slice(0, 5)
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });

    // Try to update sync status to error
    try {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const { data: userData } = await supabaseClient.auth.getUser(token);
        if (userData?.user?.id) {
          const { data: effectiveAccountData } = await supabaseClient.rpc('get_effective_account_id', { p_user_id: userData.user.id });
          await supabaseClient
            .from('stripe_integrations')
            .update({
              sync_status: 'error',
              last_sync_error: errorMessage,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', effectiveAccountData || userData.user.id);
        }
      }
    } catch (e) {
      // Ignore errors when updating status
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
