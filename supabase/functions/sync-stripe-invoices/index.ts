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
    let statusUpdates = { paid: 0, partial: 0, credited: 0, writtenOff: 0, open: 0 };
    const errors: string[] = [];

    // Helper function to map Stripe status to our invoice status
    const mapStripeStatus = (stripeInvoice: Stripe.Invoice): 'Open' | 'Paid' | 'Partial' | 'Credited' | 'Written Off' => {
      const amountPaid = stripeInvoice.amount_paid || 0;
      const amountDue = stripeInvoice.amount_due || 0;
      const amountRemaining = stripeInvoice.amount_remaining || 0;

      switch (stripeInvoice.status) {
        case 'paid':
          // Check if partially paid (amount_paid < total but marked as paid with forgiveness)
          if (amountPaid > 0 && amountPaid < amountDue && amountRemaining === 0) {
            return 'Partial'; // Settled for less than full amount
          }
          return 'Paid';
        case 'void':
          return 'Credited'; // Voided invoices are treated as credited
        case 'uncollectible':
          return 'Written Off';
        case 'open':
        default:
          // Check if any payment has been made on open invoice
          if (amountPaid > 0 && amountRemaining > 0) {
            return 'Partial';
          }
          return 'Open';
      }
    };

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
            // Don't fail the whole sync for contact creation issues
          }
          
          createdDebtors++;
          logStep("Created new debtor with contact", { debtorId, customerEmail });
        } else {
          debtorId = existingDebtor.id;
        }

        // Determine the correct status
        const mappedStatus = mapStripeStatus(stripeInvoice);
        
        // Track status updates
        if (mappedStatus === 'Paid') statusUpdates.paid++;
        else if (mappedStatus === 'Partial') statusUpdates.partial++;
        else if (mappedStatus === 'Credited') statusUpdates.credited++;
        else if (mappedStatus === 'Written Off') statusUpdates.writtenOff++;
        else statusUpdates.open++;

        // Calculate payment date for paid/partial invoices
        let paymentDate: string | null = null;
        let paidDate: string | null = null;
        if (stripeInvoice.status === 'paid' && stripeInvoice.status_transitions?.paid_at) {
          const paidAt = new Date(stripeInvoice.status_transitions.paid_at * 1000).toISOString().split('T')[0];
          paymentDate = paidAt;
          paidDate = paidAt;
        }

        // Check if invoice already exists - match by stripe_invoice_id, invoice_number, or external_invoice_id
        let existingInvoice: { id: string; status: string } | null = null;
        
        // First try to match by stripe_invoice_id
        const { data: byStripeId } = await supabaseClient
          .from('invoices')
          .select('id, status')
          .eq('stripe_invoice_id', stripeInvoice.id)
          .eq('user_id', effectiveAccountId)
          .maybeSingle();
        
        if (byStripeId) {
          existingInvoice = byStripeId;
        } else {
          // Try to match by invoice_number (Stripe invoice number)
          const invoiceNumber = stripeInvoice.number || stripeInvoice.id;
          const { data: byInvoiceNumber } = await supabaseClient
            .from('invoices')
            .select('id, status')
            .eq('invoice_number', invoiceNumber)
            .eq('user_id', effectiveAccountId)
            .maybeSingle();
          
          if (byInvoiceNumber) {
            existingInvoice = byInvoiceNumber;
          } else {
            // Try to match by external_invoice_id
            const { data: byExternalId } = await supabaseClient
              .from('invoices')
              .select('id, status')
              .eq('external_invoice_id', stripeInvoice.id)
              .eq('user_id', effectiveAccountId)
              .maybeSingle();
            
            if (byExternalId) {
              existingInvoice = byExternalId;
            }
          }
        }

        const invoiceData: Record<string, any> = {
          user_id: effectiveAccountId,
          debtor_id: debtorId,
          invoice_number: stripeInvoice.number || stripeInvoice.id,
          amount: (stripeInvoice.amount_due || 0) / 100, // Convert from cents
          amount_outstanding: (stripeInvoice.amount_remaining || 0) / 100,
          amount_original: (stripeInvoice.total || 0) / 100,
          currency: stripeInvoice.currency?.toUpperCase() || 'USD',
          issue_date: stripeInvoice.created ? new Date(stripeInvoice.created * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          due_date: stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          status: mappedStatus,
          source_system: 'stripe',
          stripe_invoice_id: stripeInvoice.id,
          stripe_customer_id: customer.id,
          stripe_hosted_url: stripeInvoice.hosted_invoice_url || null,
          external_invoice_id: stripeInvoice.id,
          external_link: stripeInvoice.hosted_invoice_url || null,
          product_description: stripeInvoice.description || stripeInvoice.lines?.data?.[0]?.description || 'Stripe Invoice',
          reference_id: stripeInvoice.number || stripeInvoice.id
        };

        // Add payment-related fields if applicable
        if (paymentDate) {
          invoiceData.payment_date = paymentDate;
          invoiceData.paid_date = paidDate;
        }

        // Add notes based on status
        if (mappedStatus === 'Credited') {
          invoiceData.notes = `Voided/Credited in Stripe on ${new Date().toLocaleDateString()}`;
        } else if (mappedStatus === 'Written Off') {
          invoiceData.notes = `Marked uncollectible in Stripe on ${new Date().toLocaleDateString()}`;
        } else if (mappedStatus === 'Partial') {
          const amountPaid = (stripeInvoice.amount_paid || 0) / 100;
          invoiceData.notes = `Partially settled - $${amountPaid.toFixed(2)} paid via Stripe`;
        } else if (mappedStatus === 'Paid') {
          invoiceData.notes = `Paid in full via Stripe${paidDate ? ` on ${paidDate}` : ''}`;
        }

        let invoiceRecordId: string;
        
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
          
          invoiceRecordId = existingInvoice.id;
          
          // Log status change if different
          if (existingInvoice.status !== mappedStatus) {
            logStep("Status updated", { 
              invoiceId: stripeInvoice.id, 
              oldStatus: existingInvoice.status, 
              newStatus: mappedStatus 
            });
          }
        } else {
          // Create new invoice
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
        }

        // Sync transaction history from Stripe - payments, credits, refunds
        try {
          // Get existing transactions for this invoice to avoid duplicates
          const { data: existingTxs } = await supabaseClient
            .from('invoice_transactions')
            .select('reference_number')
            .eq('invoice_id', invoiceRecordId);
          
          const existingRefs = new Set((existingTxs || []).map(tx => tx.reference_number).filter(Boolean));

          // Fetch payment intents associated with this invoice
          if (stripeInvoice.payment_intent) {
            const paymentIntentId = typeof stripeInvoice.payment_intent === 'string' 
              ? stripeInvoice.payment_intent 
              : stripeInvoice.payment_intent.id;
            
            try {
              const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
              
              // Log the payment if not already logged
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
              
              // Check for refunds on this payment intent
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
                      amount: refundAmount,
                      balance_after: null, // Refunds increase balance, but we don't track running balance
                      reference_number: refundRef,
                      reason: refund.reason || 'Refund from Stripe',
                      transaction_date: new Date(refund.created * 1000).toISOString().split('T')[0],
                      notes: `Refund processed via Stripe${refund.reason ? `: ${refund.reason}` : ''}`,
                      metadata: { 
                        stripe_refund_id: refund.id,
                        stripe_payment_intent_id: paymentIntentId,
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

          // Log credit notes / discounts if invoice is voided or has discounts
          if (stripeInvoice.status === 'void') {
            const voidRef = `stripe_void_${stripeInvoice.id}`;
            if (!existingRefs.has(voidRef)) {
              const voidAmount = (stripeInvoice.total || 0) / 100;
              
              await supabaseClient
                .from('invoice_transactions')
                .insert({
                  invoice_id: invoiceRecordId,
                  user_id: effectiveAccountId,
                  transaction_type: 'credit',
                  amount: voidAmount,
                  balance_after: 0,
                  reference_number: voidRef,
                  reason: 'Invoice voided in Stripe',
                  transaction_date: new Date().toISOString().split('T')[0],
                  notes: 'Invoice voided/credited in Stripe',
                  metadata: { 
                    stripe_invoice_id: stripeInvoice.id,
                    source: 'stripe_sync'
                  }
                });
              
              transactionsLogged++;
            }
          }

          // Log write-off for uncollectible invoices
          if (stripeInvoice.status === 'uncollectible') {
            const uncollectibleRef = `stripe_uncollectible_${stripeInvoice.id}`;
            if (!existingRefs.has(uncollectibleRef)) {
              const writeOffAmount = (stripeInvoice.amount_remaining || stripeInvoice.amount_due || 0) / 100;
              
              await supabaseClient
                .from('invoice_transactions')
                .insert({
                  invoice_id: invoiceRecordId,
                  user_id: effectiveAccountId,
                  transaction_type: 'write_off',
                  amount: writeOffAmount,
                  balance_after: 0,
                  reference_number: uncollectibleRef,
                  reason: 'Marked uncollectible in Stripe',
                  transaction_date: new Date().toISOString().split('T')[0],
                  notes: 'Invoice marked as uncollectible in Stripe',
                  metadata: { 
                    stripe_invoice_id: stripeInvoice.id,
                    source: 'stripe_sync'
                  }
                });
              
              transactionsLogged++;
            }
          }

          // Fetch and log Credit Notes from Stripe (this is how credits like $25k are applied)
          try {
            const creditNotes = await stripe.creditNotes.list({
              invoice: stripeInvoice.id,
              limit: 100
            });
            
            logStep("Fetched credit notes for invoice", { 
              invoiceId: stripeInvoice.id, 
              creditNoteCount: creditNotes.data.length 
            });
            
            for (const creditNote of creditNotes.data) {
              const creditRef = `stripe_cn_${creditNote.id}`;
              if (!existingRefs.has(creditRef)) {
                const creditAmount = creditNote.amount / 100;
                
                await supabaseClient
                  .from('invoice_transactions')
                  .insert({
                    invoice_id: invoiceRecordId,
                    user_id: effectiveAccountId,
                    transaction_type: 'credit',
                    amount: creditAmount,
                    balance_after: (stripeInvoice.amount_remaining || 0) / 100,
                    reference_number: creditRef,
                    reason: creditNote.reason || 'Credit applied in Stripe',
                    transaction_date: new Date(creditNote.created * 1000).toISOString().split('T')[0],
                    notes: creditNote.memo || `Credit Note #${creditNote.number || creditNote.id} via Stripe`,
                    metadata: { 
                      stripe_credit_note_id: creditNote.id,
                      stripe_credit_note_number: creditNote.number,
                      stripe_invoice_id: stripeInvoice.id,
                      credit_note_status: creditNote.status,
                      credit_note_reason: creditNote.reason,
                      source: 'stripe_sync'
                    }
                  });
                
                transactionsLogged++;
                existingRefs.add(creditRef);
                logStep("Logged credit note", { creditNoteId: creditNote.id, amount: creditAmount });
              }
            }
          } catch (cnError) {
            logStep("Error fetching credit notes", { invoiceId: stripeInvoice.id, error: String(cnError) });
          }

          // Check for partial payments via discount/credit applied in Stripe
          const discountAmount = (stripeInvoice.total_discount_amounts || []).reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
          if (discountAmount > 0) {
            const discountRef = `stripe_discount_${stripeInvoice.id}`;
            if (!existingRefs.has(discountRef)) {
              await supabaseClient
                .from('invoice_transactions')
                .insert({
                  invoice_id: invoiceRecordId,
                  user_id: effectiveAccountId,
                  transaction_type: 'credit',
                  amount: discountAmount / 100,
                  balance_after: (stripeInvoice.amount_remaining || 0) / 100,
                  reference_number: discountRef,
                  reason: 'Discount applied in Stripe',
                  transaction_date: new Date(stripeInvoice.created * 1000).toISOString().split('T')[0],
                  notes: 'Discount/coupon applied via Stripe',
                  metadata: { 
                    stripe_invoice_id: stripeInvoice.id,
                    source: 'stripe_sync'
                  }
                });
              
              transactionsLogged++;
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

    logStep("Sync completed", { syncedCount, createdDebtors, transactionsLogged, errorCount: errors.length });

    return new Response(JSON.stringify({
      success: true,
      synced_count: syncedCount,
      created_debtors: createdDebtors,
      transactions_logged: transactionsLogged,
      total_invoices: invoices.length,
      status_breakdown: statusUpdates,
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
