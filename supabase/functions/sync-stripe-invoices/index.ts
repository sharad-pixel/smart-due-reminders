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

// Decrypt a value using AES-GCM
async function decryptValue(encryptedValue: string): Promise<string> {
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
  if (!encryptionKey) {
    throw new Error('Encryption key not configured');
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  const encryptedData = Uint8Array.from(atob(encryptedValue), c => c.charCodeAt(0));
  const iv = encryptedData.slice(0, 12);
  const data = encryptedData.slice(12);

  const keyMaterial = encoder.encode(encryptionKey);
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial.slice(0, 32),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return decoder.decode(decrypted);
}

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

    // Get the user's Stripe credentials
    const { data: integration, error: integrationError } = await supabaseClient
      .from('stripe_integrations')
      .select('stripe_secret_key_encrypted')
      .eq('user_id', effectiveAccountId)
      .maybeSingle();

    if (integrationError) {
      throw new Error(`Failed to fetch Stripe integration: ${integrationError.message}`);
    }

    let stripeKey: string;
    
    if (integration?.stripe_secret_key_encrypted) {
      // Use user's own Stripe key
      stripeKey = await decryptValue(integration.stripe_secret_key_encrypted);
      logStep("Using user-provided Stripe key");
    } else {
      throw new Error("No Stripe API key configured. Please add your Stripe secret key in Settings.");
    }

    // Update sync status to 'syncing'
    await supabaseClient
      .from('stripe_integrations')
      .upsert({
        user_id: effectiveAccountId,
        is_connected: true,
        sync_status: 'syncing',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    // Create sync log entry
    let syncLogId: string | null = null;
    try {
      const { data: insertedLog } = await supabaseClient.from('stripe_sync_log').insert({
        user_id: effectiveAccountId,
        sync_type: 'full',
        status: 'running',
        errors: []
      }).select('id').single();
      syncLogId = insertedLog?.id || null;
      logStep('STRIPE_SYNC_LOG_CREATED', { syncLogId });
    } catch (e) {
      logStep('STRIPE_SYNCLOG_INSERT_FAILED', { error: String(e) });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Fetch invoices from Stripe - all statuses for complete sync
    const invoices: Stripe.Invoice[] = [];
    
    // Get open invoices (unpaid)
    const openInvoices = await stripe.invoices.list({
      status: 'open',
      limit: 100,
      expand: ['data.customer']
    });
    invoices.push(...openInvoices.data);
    logStep("Fetched open invoices", { count: openInvoices.data.length });

    // Get paid invoices to capture settlements
    const paidInvoices = await stripe.invoices.list({
      status: 'paid',
      limit: 100,
      expand: ['data.customer']
    });
    invoices.push(...paidInvoices.data);
    logStep("Fetched paid invoices", { count: paidInvoices.data.length });

    // Get void invoices (cancelled/credited)
    const voidInvoices = await stripe.invoices.list({
      status: 'void',
      limit: 100,
      expand: ['data.customer']
    });
    invoices.push(...voidInvoices.data);
    logStep("Fetched void invoices", { count: voidInvoices.data.length });

    // Get uncollectible invoices (written off)
    const uncollectibleInvoices = await stripe.invoices.list({
      status: 'uncollectible',
      limit: 100,
      expand: ['data.customer']
    });
    invoices.push(...uncollectibleInvoices.data);
    logStep("Fetched uncollectible invoices", { count: uncollectibleInvoices.data.length });
    
    let syncedCount = 0;
    let createdDebtors = 0;
    let transactionsLogged = 0;
    let newInvoicesCreated = 0;
    let conflictsDetected = 0;
    let conflictsResolved = 0;
    let overridesReset = 0;
    let statusUpdates = { paid: 0, partial: 0, canceled: 0, voided: 0, open: 0 };
    const errors: string[] = [];

    // Helper function to map Stripe status to our invoice status
    // Valid enum values: Open, Paid, Disputed, Settled, InPaymentPlan, Canceled, FinalInternalCollections, PartiallyPaid, Voided
    const mapStripeStatus = (stripeInvoice: Stripe.Invoice): 'Open' | 'Paid' | 'PartiallyPaid' | 'Canceled' | 'Voided' => {
      const amountPaid = stripeInvoice.amount_paid || 0;
      const amountDue = stripeInvoice.amount_due || 0;
      const amountRemaining = stripeInvoice.amount_remaining || 0;

      switch (stripeInvoice.status) {
        case 'paid':
          if (amountPaid > 0 && amountPaid < amountDue && amountRemaining === 0) {
            return 'PartiallyPaid';
          }
          return 'Paid';
        case 'void':
          return 'Voided'; // Use Voided status for void invoices
        case 'uncollectible':
          return 'Canceled'; // Use Canceled for uncollectible
        case 'open':
        default:
          if (amountPaid > 0 && amountRemaining > 0) {
            return 'PartiallyPaid';
          }
          return 'Open';
      }
    };

    for (const stripeInvoice of invoices) {
      try {
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
          const { data: newDebtor, error: debtorError } = await supabaseClient
            .from('debtors')
            .insert({
              user_id: effectiveAccountId,
              company_name: customerName,
              name: customerName,
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
          
          // Create a proper contact entry for outreach
          const { error: contactError } = await supabaseClient
            .from('debtor_contacts')
            .insert({
              debtor_id: debtorId,
              user_id: effectiveAccountId,
              name: customerName,
              email: customerEmail,
              phone: customer.phone || null,
              is_primary: true,
              outreach_enabled: true
            });
          
          if (contactError) {
            logStep("Error creating contact", { error: contactError.message, debtorId });
          }
          
          createdDebtors++;
          logStep("Created new debtor with contact", { debtorId, customerEmail });
        } else {
          debtorId = existingDebtor.id;
        }

        const mappedStatus = mapStripeStatus(stripeInvoice);
        
        if (mappedStatus === 'Paid') statusUpdates.paid++;
        else if (mappedStatus === 'PartiallyPaid') statusUpdates.partial++;
        else if (mappedStatus === 'Canceled') statusUpdates.canceled++;
        else if (mappedStatus === 'Voided') statusUpdates.voided++;
        else statusUpdates.open++;

        let paymentDate: string | null = null;
        let paidDate: string | null = null;
        if (stripeInvoice.status === 'paid' && stripeInvoice.status_transitions?.paid_at) {
          const paidAt = new Date(stripeInvoice.status_transitions.paid_at * 1000).toISOString().split('T')[0];
          paymentDate = paidAt;
          paidDate = paidAt;
        }

        // Check if invoice already exists
        let existingInvoice: { 
          id: string; 
          status: string; 
          amount?: number;
          due_date?: string;
          has_local_overrides?: boolean;
          override_count?: number;
        } | null = null;
        
        const { data: byStripeId } = await supabaseClient
          .from('invoices')
          .select('id, status, amount, due_date, has_local_overrides, override_count')
          .eq('stripe_invoice_id', stripeInvoice.id)
          .eq('user_id', effectiveAccountId)
          .maybeSingle();
        
        if (byStripeId) {
          existingInvoice = byStripeId;
        } else {
          const invoiceNumber = stripeInvoice.number || stripeInvoice.id;
          const { data: byInvoiceNumber } = await supabaseClient
            .from('invoices')
            .select('id, status, amount, due_date, has_local_overrides, override_count')
            .eq('invoice_number', invoiceNumber)
            .eq('user_id', effectiveAccountId)
            .maybeSingle();
          
          if (byInvoiceNumber) {
            existingInvoice = byInvoiceNumber;
          } else {
            const { data: byExternalId } = await supabaseClient
              .from('invoices')
              .select('id, status, amount, due_date, has_local_overrides, override_count')
              .eq('external_invoice_id', stripeInvoice.id)
              .eq('user_id', effectiveAccountId)
              .maybeSingle();
            
            if (byExternalId) {
              existingInvoice = byExternalId;
            }
          }
        }

        const stripeAmount = (stripeInvoice.amount_due || 0) / 100;
        const stripeDueDate = stripeInvoice.due_date 
          ? new Date(stripeInvoice.due_date * 1000).toISOString().split('T')[0] 
          : new Date().toISOString().split('T')[0];
        const stripeIntegrationUrl = `https://dashboard.stripe.com/invoices/${stripeInvoice.id}`;

        const invoiceData: Record<string, any> = {
          user_id: effectiveAccountId,
          debtor_id: debtorId,
          invoice_number: stripeInvoice.number || stripeInvoice.id,
          amount: stripeAmount,
          amount_outstanding: (stripeInvoice.amount_remaining || 0) / 100,
          amount_original: (stripeInvoice.total || 0) / 100,
          currency: stripeInvoice.currency?.toUpperCase() || 'USD',
          issue_date: stripeInvoice.created ? new Date(stripeInvoice.created * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          due_date: stripeDueDate,
          status: mappedStatus,
          source_system: 'stripe',
          stripe_invoice_id: stripeInvoice.id,
          stripe_customer_id: customer.id,
          stripe_hosted_url: stripeInvoice.hosted_invoice_url || null,
          external_invoice_id: stripeInvoice.id,
          external_link: stripeInvoice.hosted_invoice_url || null,
          product_description: stripeInvoice.description || stripeInvoice.lines?.data?.[0]?.description || 'Stripe Invoice',
          reference_id: stripeInvoice.number || stripeInvoice.id,
          // Source-of-truth integration fields
          integration_source: 'stripe',
          integration_id: stripeInvoice.id,
          integration_url: stripeIntegrationUrl,
          original_amount: stripeAmount,
          original_due_date: stripeDueDate,
          last_synced_at: new Date().toISOString()
        };

        if (paymentDate) {
          invoiceData.payment_date = paymentDate;
          invoiceData.paid_date = paidDate;
        }

        // Add notes based on status - using Stripe raw status for notes
        if (stripeInvoice.status === 'void') {
          invoiceData.notes = `Voided in Stripe on ${new Date().toLocaleDateString()}`;
        } else if (stripeInvoice.status === 'uncollectible') {
          invoiceData.notes = `Marked uncollectible in Stripe on ${new Date().toLocaleDateString()}`;
        } else if (mappedStatus === 'PartiallyPaid') {
          const amountPaid = (stripeInvoice.amount_paid || 0) / 100;
          invoiceData.notes = `Partially paid - $${amountPaid.toFixed(2)} paid via Stripe`;
        } else if (mappedStatus === 'Paid') {
          invoiceData.notes = `Paid in full via Stripe${paidDate ? ` on ${paidDate}` : ''}`;
        }

        let invoiceRecordId: string;
        let isNewInvoice = false;
        
        if (existingInvoice) {
          // Check for local overrides that need to be resolved
          if (existingInvoice.has_local_overrides) {
            const conflicts: Record<string, { recouply_value: any; stripe_value: any }> = {};
            
            // Compare amount
            if (existingInvoice.amount !== undefined && existingInvoice.amount !== stripeAmount) {
              conflicts.amount = {
                recouply_value: existingInvoice.amount,
                stripe_value: stripeAmount
              };
            }
            
            // Compare due_date
            if (existingInvoice.due_date && existingInvoice.due_date !== stripeDueDate) {
              conflicts.due_date = {
                recouply_value: existingInvoice.due_date,
                stripe_value: stripeDueDate
              };
            }
            
            // Log conflicts if any
            if (Object.keys(conflicts).length > 0) {
              conflictsDetected++;
              
              // Insert sync conflict record
              await supabaseClient
                .from('invoice_sync_conflicts')
                .insert({
                  invoice_id: existingInvoice.id,
                  user_id: effectiveAccountId,
                  integration_source: 'stripe',
                  conflicts,
                  resolved: true // Auto-resolved by sync
                });
              
              // Log override reset in override_log
              for (const [fieldName, values] of Object.entries(conflicts)) {
                await supabaseClient
                  .from('invoice_override_log')
                  .insert({
                    invoice_id: existingInvoice.id,
                    user_id: effectiveAccountId,
                    field_name: fieldName,
                    original_value: String(values.stripe_value),
                    new_value: String(values.stripe_value),
                    acknowledged_warning: true,
                    integration_source: 'stripe'
                  });
              }
              
              conflictsResolved++;
              overridesReset += existingInvoice.override_count || 0;
              
              logStep("Override conflict resolved", { 
                invoiceId: stripeInvoice.id, 
                conflicts,
                overridesReset: existingInvoice.override_count 
              });
            }
            
            // Reset override flags since Stripe data is source of truth
            invoiceData.has_local_overrides = false;
            invoiceData.override_count = 0;
          }

          const { error: updateError } = await supabaseClient
            .from('invoices')
            .update(invoiceData)
            .eq('id', existingInvoice.id);

          if (updateError) {
            errors.push(`Failed to update invoice ${stripeInvoice.id}: ${updateError.message}`);
            continue;
          }
          
          invoiceRecordId = existingInvoice.id;
          
          if (existingInvoice.status !== mappedStatus) {
            logStep("Status updated", { 
              invoiceId: stripeInvoice.id, 
              oldStatus: existingInvoice.status, 
              newStatus: mappedStatus 
            });
          }
        } else {
          // New invoice - set initial override state
          invoiceData.has_local_overrides = false;
          invoiceData.override_count = 0;
          const { data: newInvoice, error: insertError } = await supabaseClient
            .from('invoices')
            .insert(invoiceData)
            .select('id')
            .single();

          if (insertError) {
            errors.push(`Failed to create invoice ${stripeInvoice.id}: ${insertError.message}`);
            continue;
          }
          invoiceRecordId = newInvoice.id;
          isNewInvoice = true;
          newInvoicesCreated++;
        }

        // Sync transaction history from Stripe
        try {
          const { data: existingTxs } = await supabaseClient
            .from('invoice_transactions')
            .select('reference_number')
            .eq('invoice_id', invoiceRecordId);
          
          const existingRefs = new Set((existingTxs || []).map(tx => tx.reference_number).filter(Boolean));

          if (stripeInvoice.payment_intent) {
            const paymentIntentId = typeof stripeInvoice.payment_intent === 'string' 
              ? stripeInvoice.payment_intent 
              : stripeInvoice.payment_intent.id;
            
            try {
              const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
              
              if (paymentIntent.status === 'succeeded' && paymentIntent.amount_received > 0) {
                const paymentRef = `stripe_pi_${paymentIntentId}`;
                if (!existingRefs.has(paymentRef)) {
                  const amountPaid = paymentIntent.amount_received / 100;
                  const balanceAfter = (stripeInvoice.amount_remaining || 0) / 100;
                  
                  await supabaseClient
                    .from('invoice_transactions')
                    .insert({
                      invoice_id: invoiceRecordId,
                      user_id: effectiveAccountId,
                      transaction_type: 'payment',
                      amount: amountPaid,
                      balance_after: balanceAfter,
                      payment_method: paymentIntent.payment_method_types?.[0] || 'card',
                      reference_number: paymentRef,
                      transaction_date: new Date(paymentIntent.created * 1000).toISOString().split('T')[0],
                      notes: `Payment via Stripe`,
                      source_system: 'stripe',
                      external_transaction_id: paymentIntentId,
                      metadata: { 
                        stripe_payment_intent_id: paymentIntentId,
                        stripe_invoice_id: stripeInvoice.id,
                        source: 'stripe_sync'
                      }
                    });
                  
                  transactionsLogged++;
                  existingRefs.add(paymentRef);
                }
              }
              
              // Check for refunds
              const refunds = await stripe.refunds.list({
                payment_intent: paymentIntentId,
                limit: 100
              });
              
              for (const refund of refunds.data) {
                const refundRef = `stripe_refund_${refund.id}`;
                if (!existingRefs.has(refundRef)) {
                  const refundAmount = refund.amount / 100;
                  
                  await supabaseClient
                    .from('invoice_transactions')
                    .insert({
                      invoice_id: invoiceRecordId,
                      user_id: effectiveAccountId,
                      transaction_type: 'refund',
                      amount: -refundAmount,
                      payment_method: 'refund',
                      reference_number: refundRef,
                      transaction_date: new Date(refund.created * 1000).toISOString().split('T')[0],
                      notes: `Refund via Stripe${refund.reason ? `: ${refund.reason}` : ''}`,
                      source_system: 'stripe',
                      external_transaction_id: refund.id,
                      metadata: { 
                        stripe_refund_id: refund.id,
                        stripe_invoice_id: stripeInvoice.id,
                        source: 'stripe_sync'
                      }
                    });
                  
                  transactionsLogged++;
                  existingRefs.add(refundRef);
                }
              }
            } catch (piError) {
              logStep("Error fetching payment intent", { paymentIntentId, error: String(piError) });
            }
          }

          // Check for credit notes
          try {
            const creditNotes = await stripe.creditNotes.list({
              invoice: stripeInvoice.id,
              limit: 100
            });

            for (const creditNote of creditNotes.data) {
              const cnRef = `stripe_cn_${creditNote.id}`;
              if (!existingRefs.has(cnRef)) {
                const creditAmount = creditNote.amount / 100;
                
                await supabaseClient
                  .from('invoice_transactions')
                  .insert({
                    invoice_id: invoiceRecordId,
                    user_id: effectiveAccountId,
                    transaction_type: 'credit',
                    amount: -creditAmount,
                    payment_method: 'credit_note',
                    reference_number: cnRef,
                    transaction_date: new Date(creditNote.created * 1000).toISOString().split('T')[0],
                    notes: `Credit note via Stripe${creditNote.reason ? `: ${creditNote.reason}` : ''}`,
                    source_system: 'stripe',
                    external_transaction_id: creditNote.id,
                    metadata: { 
                      stripe_credit_note_id: creditNote.id,
                      stripe_invoice_id: stripeInvoice.id,
                      source: 'stripe_sync'
                    }
                  });
                
                transactionsLogged++;
                existingRefs.add(cnRef);
              }
            }
          } catch (cnError) {
            logStep("Error fetching credit notes", { invoiceId: stripeInvoice.id, error: String(cnError) });
          }

          // Log discounts
          if (stripeInvoice.discount) {
            const discount = stripeInvoice.discount;
            const discountRef = `stripe_discount_${stripeInvoice.id}_${discount.coupon?.id || 'unknown'}`;
            if (!existingRefs.has(discountRef)) {
              const discountAmount = (stripeInvoice.total_discount_amounts?.[0]?.amount || 0) / 100;
              if (discountAmount > 0) {
                await supabaseClient
                  .from('invoice_transactions')
                  .insert({
                    invoice_id: invoiceRecordId,
                    user_id: effectiveAccountId,
                    transaction_type: 'discount',
                    amount: -discountAmount,
                    payment_method: 'discount',
                    reference_number: discountRef,
                    transaction_date: new Date(stripeInvoice.created * 1000).toISOString().split('T')[0],
                    notes: `Discount: ${discount.coupon?.name || discount.coupon?.id || 'Applied discount'}`,
                    source_system: 'stripe',
                    external_transaction_id: discount.coupon?.id || stripeInvoice.id,
                    metadata: { 
                      stripe_invoice_id: stripeInvoice.id,
                      source: 'stripe_sync'
                    }
                  });
                
                transactionsLogged++;
              }
            }
          }

          // Log write-offs
          if (stripeInvoice.status === 'uncollectible') {
            const woRef = `stripe_writeoff_${stripeInvoice.id}`;
            if (!existingRefs.has(woRef)) {
              const woAmount = (stripeInvoice.amount_remaining || 0) / 100;
              if (woAmount > 0) {
                await supabaseClient
                  .from('invoice_transactions')
                  .insert({
                    invoice_id: invoiceRecordId,
                    user_id: effectiveAccountId,
                    transaction_type: 'write_off',
                    amount: -woAmount,
                    balance_after: 0,
                    payment_method: 'write_off',
                    reference_number: woRef,
                    transaction_date: new Date().toISOString().split('T')[0],
                    notes: 'Marked as uncollectible in Stripe',
                    source_system: 'stripe',
                    external_transaction_id: stripeInvoice.id,
                    metadata: { 
                      stripe_invoice_id: stripeInvoice.id,
                      source: 'stripe_sync'
                    }
                  });
                
                transactionsLogged++;
              }
            }
          }

        } catch (txError) {
          logStep("Error syncing transactions", { invoiceId: stripeInvoice.id, error: String(txError) });
        }

        syncedCount++;
      } catch (invoiceError) {
        const errorMsg = invoiceError instanceof Error ? invoiceError.message : String(invoiceError);
        errors.push(`Error processing invoice ${stripeInvoice.id}: ${errorMsg}`);
        logStep("Error processing invoice", { invoiceId: stripeInvoice.id, error: errorMsg });
      }
    }

    logStep("Status breakdown", statusUpdates);

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

    logStep("Sync completed", { 
      syncedCount, 
      createdDebtors, 
      transactionsLogged, 
      newInvoicesCreated, 
      conflictsDetected,
      conflictsResolved,
      overridesReset,
      errorCount: errors.length 
    });

    // AUTOMATICALLY trigger ensure-invoice-workflows after sync
    // This assigns workflows to newly synced invoices
    let workflowResult: any = null;
    if (newInvoicesCreated > 0 || statusUpdates.open > 0) {
      logStep("Triggering workflow assignment for new/open invoices...");
      try {
        const { data, error: workflowError } = await supabaseClient.functions.invoke(
          'ensure-invoice-workflows',
          { body: {} }
        );

        if (workflowError) {
          logStep("Error calling ensure-invoice-workflows", { error: workflowError.message });
        } else {
          workflowResult = data;
          logStep("Workflow assignment completed", { 
            workflowsCreated: workflowResult?.workflowsCreated,
            drafted: workflowResult?.schedulerResult?.drafted
          });
        }
      } catch (err) {
        logStep("Exception calling ensure-invoice-workflows", { error: String(err) });
      }
    }

    // Update sync log with success
    const totalSynced = syncedCount + transactionsLogged;
    const totalFailed = errors.length;
    const finalStatus = totalFailed > 0 ? (totalSynced > 0 ? 'partial' : 'failed') : 'success';
    
    if (syncLogId) {
      try {
        await supabaseClient.from('stripe_sync_log').update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
          records_synced: totalSynced,
          records_failed: totalFailed,
          errors: errors.slice(0, 20)
        }).eq('id', syncLogId);
      } catch (e) {
        logStep('STRIPE_SYNCLOG_UPDATE_FAILED', { error: String(e) });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      invoices_synced: syncedCount,
      transactions_synced: transactionsLogged,
      conflicts_detected: conflictsDetected,
      conflicts_resolved: conflictsResolved,
      overrides_reset: overridesReset,
      created_debtors: createdDebtors,
      new_invoices_created: newInvoicesCreated,
      total_invoices: invoices.length,
      status_breakdown: statusUpdates,
      workflow_result: workflowResult ? {
        workflows_assigned: workflowResult.workflowsCreated || 0,
        drafts_generated: workflowResult.schedulerResult?.drafted || 0,
        drafts_sent: workflowResult.schedulerResult?.sent || 0
      } : null,
      errors: errors.slice(0, 5)
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });

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
