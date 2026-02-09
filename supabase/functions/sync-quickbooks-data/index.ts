import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 2-minute early refresh buffer to avoid edge cases
const TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000;

// QB API pagination settings
const QB_PAGE_SIZE = 1000;
const QB_MINOR_VERSION = 75;

// Default incremental sync: last 24 months
const INCREMENTAL_MONTHS = 24;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body for options
    let fullSync = false;
    let scheduledUserId: string | null = null;
    try {
      const body = await req.json();
      fullSync = body?.full_sync === true;
      scheduledUserId = body?.userId || null;
    } catch {
      // No body or invalid JSON - use defaults
    }

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    const isScheduledSync = scheduledUserId && token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    let userId: string;

    if (isScheduledSync) {
      // Scheduled sync via service role
      userId = scheduledUserId!;
      console.log('QB_SCHEDULED_SYNC', { userId });
    } else {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      );

      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      userId = user.id;
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create sync log at the START of sync (always)
    let syncLogId: string | null = null;
    try {
      const { data: insertedLog } = await supabaseAdmin.from('quickbooks_sync_log').insert({
        user_id: userId,
        sync_type: fullSync ? 'full' : 'incremental',
        status: 'running',
        errors: []
      }).select('id').single();
      syncLogId = insertedLog?.id || null;
      console.log('QB_SYNC_LOG_CREATED', { syncLogId });
    } catch (e) {
      console.error('QB_SYNCLOG_INSERT_FAILED', e);
    }

    // Get user's QuickBooks connection
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('quickbooks_realm_id, quickbooks_access_token, quickbooks_refresh_token, quickbooks_token_expires_at')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.quickbooks_realm_id) {
      // Update sync log with error
      if (syncLogId) {
        await supabaseAdmin.from('quickbooks_sync_log').update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          errors: ['QuickBooks not connected']
        }).eq('id', syncLogId);
      }
      return new Response(JSON.stringify({ error: 'QuickBooks not connected', errors: ['QuickBooks not connected'] }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let accessToken = profile.quickbooks_access_token;
    let currentRefreshToken = profile.quickbooks_refresh_token;
    const realmId = profile.quickbooks_realm_id;

    // Check if token is expired (with 2-minute buffer) and refresh if needed
    if (profile.quickbooks_token_expires_at) {
      const expiresAt = new Date(profile.quickbooks_token_expires_at);
      const refreshThreshold = new Date(Date.now() + TOKEN_REFRESH_BUFFER_MS);
      
      if (expiresAt <= refreshThreshold) {
        console.log('Token expired or expiring soon, refreshing with CAS...');
        const refreshResult = await refreshTokenCAS(supabaseAdmin, userId, currentRefreshToken);
        if (!refreshResult) {
          // Update sync log with error
          if (syncLogId) {
            await supabaseAdmin.from('quickbooks_sync_log').update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              errors: ['Failed to refresh token. Please reconnect QuickBooks.']
            }).eq('id', syncLogId);
          }
          return new Response(JSON.stringify({ error: 'Failed to refresh token. Please reconnect QuickBooks.', errors: ['Failed to refresh token'] }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        accessToken = refreshResult.accessToken;
        currentRefreshToken = refreshResult.refreshToken;
      }
    }

    const environment = Deno.env.get('QUICKBOOKS_ENVIRONMENT') || 'sandbox';
    const apiBase = environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    let customersSynced = 0;
    let invoicesSynced = 0;
    let paymentsSynced = 0;
    let contactsSynced = 0;
    let terminalSkipped = 0;
    const errors: string[] = [];

    // Token refresh context for qbQueryAll retry logic
    const tokenContext = {
      accessToken,
      refreshToken: currentRefreshToken,
      supabaseAdmin,
      userId: userId
    };

    // Calculate cutoff date for incremental sync
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - INCREMENTAL_MONTHS);
    const cutoffStr = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD

    try {
      // Sync Customers with pagination (always full sync for customers)
      console.log('Fetching customers from QuickBooks...');
      const customers = await qbQueryAll(
        apiBase,
        realmId,
        'SELECT * FROM Customer',
        tokenContext
      );

      // Build invoice query - incremental by default (last 24 months)
      // Include include=invoiceLink parameter to get customer-facing payment links
      let invoiceQuery = 'SELECT * FROM Invoice';
      if (!fullSync) {
        invoiceQuery = `SELECT * FROM Invoice WHERE TxnDate >= '${cutoffStr}'`;
      }
      console.log('Fetching invoices from QuickBooks...');
      const invoices = await qbQueryAll(apiBase, realmId, invoiceQuery, tokenContext, true);

      // Build payment query - incremental by default
      let paymentQuery = 'SELECT * FROM Payment';
      if (!fullSync) {
        paymentQuery = `SELECT * FROM Payment WHERE TxnDate >= '${cutoffStr}'`;
      }
      console.log('Fetching payments from QuickBooks...');
      const payments = await qbQueryAll(apiBase, realmId, paymentQuery, tokenContext);

      // Log fetched counts
      console.log('QB_FETCH_COUNTS', {
        customers: customers.length,
        invoices: invoices.length,
        payments: payments.length
      });

      // Process customers and sync contacts
      for (const customer of customers) {
        let debtorIdForContacts: string | null = null;
        
        try {
          const { data: upsertedDebtor, error: upsertError } = await supabaseAdmin
            .from('debtors')
            .upsert({
              user_id: user.id,
              quickbooks_customer_id: customer.Id,
              quickbooks_sync_token: customer.SyncToken,
              company_name: customer.CompanyName || customer.DisplayName || 'Unknown',
              name: customer.DisplayName || customer.CompanyName || 'Unknown',
              email: customer.PrimaryEmailAddr?.Address || '',
              phone: customer.PrimaryPhone?.FreeFormNumber || null,
              address_line1: customer.BillAddr?.Line1 || null,
              city: customer.BillAddr?.City || null,
              state: customer.BillAddr?.CountrySubDivisionCode || null,
              postal_code: customer.BillAddr?.PostalCode || null,
              country: customer.BillAddr?.Country || null,
              integration_source: 'quickbooks',
              is_active: customer.Active !== false
            }, {
              onConflict: 'user_id,quickbooks_customer_id'
            })
            .select('id')
            .single();

          if (!upsertError && upsertedDebtor) {
            customersSynced++;
            debtorIdForContacts = upsertedDebtor.id;
          } else if (upsertError) {
            console.error('Customer upsert error:', upsertError);
            errors.push(`CUSTOMER_UPSERT_FAILED qb_customer_id=${customer.Id} name=${customer.DisplayName || customer.CompanyName}: ${upsertError.message || JSON.stringify(upsertError)}`);
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          errors.push(`CUSTOMER_UPSERT_FAILED qb_customer_id=${customer.Id} name=${customer.DisplayName || customer.CompanyName}: ${msg}`);
        }

        // If we couldn't get debtor_id from upsert, look it up
        if (!debtorIdForContacts) {
          const { data: existingDebtor } = await supabaseAdmin
            .from('debtors')
            .select('id')
            .eq('user_id', user.id)
            .eq('quickbooks_customer_id', customer.Id)
            .single();
          
          if (existingDebtor) {
            debtorIdForContacts = existingDebtor.id;
          }
        }

        // Sync contacts for this customer into debtor_contacts (used by outreach)
        if (debtorIdForContacts) {
          const primaryName = customer.DisplayName || customer.CompanyName || 'Unknown';
          const primaryEmail = customer.PrimaryEmailAddr?.Address || null;
          const primaryPhone = customer.PrimaryPhone?.FreeFormNumber || customer.Mobile?.FreeFormNumber || null;
          const externalPrimaryId = `${customer.Id}:primary`;
          
          // A) Primary contact - only insert if email exists and no primary yet
          if (primaryEmail) {
            try {
              // Check if a primary contact already exists for this debtor
              const { data: existingPrimary } = await supabaseAdmin
                .from('debtor_contacts')
                .select('id')
                .eq('debtor_id', debtorIdForContacts)
                .eq('is_primary', true)
                .limit(1);
              
              const hasPrimary = existingPrimary && existingPrimary.length > 0;
              
              const { error: primaryContactError } = await supabaseAdmin
                .from('debtor_contacts')
                .upsert({
                  user_id: user.id,
                  debtor_id: debtorIdForContacts,
                  external_contact_id: externalPrimaryId,
                  name: primaryName,
                  email: primaryEmail,
                  phone: primaryPhone,
                  title: null,
                  is_primary: !hasPrimary, // Only set as primary if no primary exists
                  outreach_enabled: true,
                  source: 'quickbooks',
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'user_id,debtor_id,external_contact_id'
                });

              if (!primaryContactError) {
                contactsSynced++;
              } else {
                console.error('Primary contact upsert error:', primaryContactError);
                errors.push(`CONTACT_UPSERT_FAILED qb_customer_id=${customer.Id} ext_contact_id=${externalPrimaryId}: ${primaryContactError.message || JSON.stringify(primaryContactError)}`);
              }
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'Unknown error';
              errors.push(`CONTACT_UPSERT_FAILED qb_customer_id=${customer.Id} ext_contact_id=${externalPrimaryId}: ${msg}`);
            }
          }

          // B) Additional contacts from Contact array
          const additionalContacts = customer.Contact || [];
          for (let i = 0; i < additionalContacts.length; i++) {
            const c = additionalContacts[i];
            const extContactId = `${customer.Id}:contact:${i}`;
            const firstName = c.GivenName || null;
            const lastName = c.FamilyName || null;
            const contactName = `${c.GivenName || ''} ${c.FamilyName || ''}`.trim() || null;
            const contactEmail = c.EmailAddress || null;
            const contactPhone = c.Phone?.FreeFormNumber || c.Mobile?.FreeFormNumber || null;
            const contactTitle = c.Title || null;

            // Only sync if contact has email or phone
            if (contactEmail || contactPhone) {
              try {
                const { error: additionalContactError } = await supabaseAdmin
                  .from('debtor_contacts')
                  .upsert({
                    user_id: user.id,
                    debtor_id: debtorIdForContacts,
                    external_contact_id: extContactId,
                    name: contactName || `${firstName || ''} ${lastName || ''}`.trim() || 'Contact',
                    email: contactEmail,
                    phone: contactPhone,
                    title: contactTitle,
                    is_primary: false,
                    outreach_enabled: true,
                    source: 'quickbooks',
                    updated_at: new Date().toISOString()
                  }, {
                    onConflict: 'user_id,debtor_id,external_contact_id'
                  });

                if (!additionalContactError) {
                  contactsSynced++;
                } else {
                  console.error('Additional contact upsert error:', additionalContactError);
                  errors.push(`CONTACT_UPSERT_FAILED qb_customer_id=${customer.Id} ext_contact_id=${extContactId}: ${additionalContactError.message || JSON.stringify(additionalContactError)}`);
                }
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : 'Unknown error';
                errors.push(`CONTACT_UPSERT_FAILED qb_customer_id=${customer.Id} ext_contact_id=${extContactId}: ${msg}`);
              }
            }
          }

          // C) Ensure a primary contact exists - if none and debtor has email, create one
          const { data: checkPrimary } = await supabaseAdmin
            .from('debtor_contacts')
            .select('id')
            .eq('debtor_id', debtorIdForContacts)
            .eq('is_primary', true)
            .limit(1);
          
          if ((!checkPrimary || checkPrimary.length === 0)) {
            // Check if any contacts exist
            const { data: anyContacts } = await supabaseAdmin
              .from('debtor_contacts')
              .select('id')
              .eq('debtor_id', debtorIdForContacts)
              .order('created_at', { ascending: true })
              .limit(1);
            
            if (anyContacts && anyContacts.length > 0) {
              // Set oldest as primary
              await supabaseAdmin
                .from('debtor_contacts')
                .update({ is_primary: true })
                .eq('id', anyContacts[0].id);
            } else if (primaryEmail) {
              // No contacts at all - create from debtor email
              const { error: fallbackError } = await supabaseAdmin
                .from('debtor_contacts')
                .insert({
                  user_id: user.id,
                  debtor_id: debtorIdForContacts,
                  name: primaryName,
                  email: primaryEmail,
                  phone: primaryPhone,
                  is_primary: true,
                  outreach_enabled: true,
                  source: 'auto_generated'
                });
              if (!fallbackError) {
                contactsSynced++;
              }
            }
          }
        }
      }

      // Prefetch all debtors for this tenant to avoid N+1 lookups
      const { data: allDebtors } = await supabaseAdmin
        .from('debtors')
        .select('id, quickbooks_customer_id')
        .eq('user_id', user.id)
        .not('quickbooks_customer_id', 'is', null);

      // Build lookup map: qb_customer_id -> debtor_id
      const debtorMap = new Map<string, string>();
      for (const d of allDebtors || []) {
        if (d.quickbooks_customer_id) {
          debtorMap.set(d.quickbooks_customer_id, d.id);
        }
      }

      // ============================================================
      // ONE-DIRECTIONAL SYNC: QuickBooks → Recouply (READ-ONLY)
      // Recouply NEVER writes back to QuickBooks
      // ============================================================
      
      // Normalized status mapping for collection logic
      interface NormalizedQBInvoice {
        status: 'Open' | 'Paid' | 'PartiallyPaid' | 'Voided';
        normalizedStatus: 'open' | 'paid' | 'partially_paid' | 'terminal';
        isCollectible: boolean;
        terminalReason: string | null;
        paymentOrigin: string | null;
      }

      // Helper to map QuickBooks invoice status with normalized fields
      // QuickBooks is SOURCE OF TRUTH for all invoice data
      const mapQBInvoiceStatus = (qbInvoice: any): NormalizedQBInvoice => {
        // Check if invoice is voided (QB uses PrivateNote or has $0 total with specific markers)
        const privateNote = (qbInvoice.PrivateNote || '').toLowerCase();
        if (privateNote.includes('void') || privateNote.includes('cancelled') || privateNote.includes('canceled')) {
          terminalSkipped++;
          return {
            status: 'Voided',
            normalizedStatus: 'terminal',
            isCollectible: false,
            terminalReason: 'voided_in_quickbooks',
            paymentOrigin: 'voided'
          };
        }
        
        // Check if invoice has been deleted/voided (TotalAmt = 0 and Balance = 0 and no line items)
        const lines = qbInvoice.Line || [];
        const hasValidLines = lines.some((line: any) => line.Amount && line.Amount > 0);
        if (qbInvoice.TotalAmt === 0 && qbInvoice.Balance === 0 && !hasValidLines) {
          terminalSkipped++;
          return {
            status: 'Voided',
            normalizedStatus: 'terminal',
            isCollectible: false,
            terminalReason: 'voided_in_quickbooks',
            paymentOrigin: 'voided'
          };
        }
        
        // Check if fully paid
        if (qbInvoice.Balance === 0 && qbInvoice.TotalAmt > 0) {
          return {
            status: 'Paid',
            normalizedStatus: 'paid',
            isCollectible: false,
            terminalReason: null,
            paymentOrigin: 'quickbooks_payment'
          };
        }
        
        // Check if partially paid
        if (qbInvoice.Balance > 0 && qbInvoice.Balance < qbInvoice.TotalAmt) {
          return {
            status: 'PartiallyPaid',
            normalizedStatus: 'partially_paid',
            isCollectible: true,
            terminalReason: null,
            paymentOrigin: null
          };
        }
        
        // Default to Open
        return {
          status: 'Open',
          normalizedStatus: 'open',
          isCollectible: true,
          terminalReason: null,
          paymentOrigin: null
        };
      };

      // Process invoices
      for (const invoice of invoices) {
        try {
          // Find linked debtor from prefetched map
          const debtorId = debtorMap.get(invoice.CustomerRef?.value);

          if (!debtorId) {
            errors.push(`Invoice ${invoice.DocNumber}: No matching customer`);
            continue;
          }

          const dueDate = invoice.DueDate || invoice.TxnDate;
          const normalizedInvoice = mapQBInvoiceStatus(invoice);
          
          // Build notes based on status - informational, not errors
          let notes: string | null = null;
          if (normalizedInvoice.status === 'Voided') {
            notes = `[TERMINAL] Voided in QuickBooks - excluded from collections`;
          } else if (normalizedInvoice.status === 'PartiallyPaid') {
            const paid = (invoice.TotalAmt || 0) - (invoice.Balance || 0);
            notes = `Partially paid - $${paid.toFixed(2)} received via QuickBooks`;
          } else if (normalizedInvoice.status === 'Paid') {
            notes = `Paid in full via QuickBooks`;
          }

          // QuickBooks returns amounts in dollars (not cents), so use directly
          // Build the QuickBooks invoice link URL (customer-facing payment URL)
          const qbInvoiceLink = invoice.InvoiceLink || null;
          const qbIntegrationUrl = `https://app.qbo.intuit.com/app/invoice?txnId=${invoice.Id}`;
          
          const upsertData: Record<string, any> = {
            user_id: user.id,
            debtor_id: debtorId,
            quickbooks_invoice_id: invoice.Id,
            quickbooks_doc_number: invoice.DocNumber,
            invoice_number: invoice.DocNumber || `QB-${invoice.Id}`,
            // QB returns amounts in dollars - store as-is (not multiplied by 100)
            amount: invoice.TotalAmt || 0,
            amount_outstanding: invoice.Balance || 0,
            issue_date: invoice.TxnDate,
            due_date: dueDate,
            status: normalizedInvoice.status,
            // Normalized fields for collection logic
            normalized_status: normalizedInvoice.normalizedStatus,
            is_collectible: normalizedInvoice.isCollectible,
            terminal_reason: normalizedInvoice.terminalReason,
            payment_origin: normalizedInvoice.paymentOrigin,
            // Source system tracking (READ-ONLY from QuickBooks)
            source_system: 'quickbooks',
            integration_source: 'quickbooks',
            // QuickBooks invoice links (external_link for customer-facing, integration_url for admin)
            external_link: qbInvoiceLink,
            integration_url: qbIntegrationUrl,
            last_synced_at: new Date().toISOString()
          };
          
          if (notes) {
            upsertData.notes = notes;
          }

          const { error: upsertError } = await supabaseAdmin
            .from('invoices')
            .upsert(upsertData, {
              onConflict: 'user_id,quickbooks_invoice_id'
            });

          if (!upsertError) {
            invoicesSynced++;
          } else {
            console.error('Invoice upsert error:', upsertError);
            errors.push(`INVOICE_UPSERT_FAILED qb_invoice_id=${invoice.Id} doc=${invoice.DocNumber}: ${upsertError.message || JSON.stringify(upsertError)}`);
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          errors.push(`INVOICE_UPSERT_FAILED qb_invoice_id=${invoice.Id} doc=${invoice.DocNumber}: ${msg}`);
        }
      }

      // Prefetch all invoices for this tenant to map qb_invoice_id -> invoice.id
      const { data: allInvoices } = await supabaseAdmin
        .from('invoices')
        .select('id, quickbooks_invoice_id')
        .eq('user_id', user.id)
        .not('quickbooks_invoice_id', 'is', null);

      // Build lookup map: qb_invoice_id -> invoice_id
      const invoiceMap = new Map<string, string>();
      for (const inv of allInvoices || []) {
        if (inv.quickbooks_invoice_id) {
          invoiceMap.set(inv.quickbooks_invoice_id, inv.id);
        }
      }

      // Process payments - track which were successfully synced to avoid duplicate counting
      const processedPaymentKeys = new Set<string>();
      
      for (const payment of payments) {
        try {
          // Find linked debtor from CustomerRef
          const debtorId = debtorMap.get(payment.CustomerRef?.value) || null;
          const paymentDate = payment.TxnDate || null;
          const paymentMethod = payment.PaymentMethodRef?.name || null;
          const referenceNumber = payment.PaymentRefNum || null;
          const currency = payment.CurrencyRef?.value || 'USD';

          // Process each line item in the payment
          const lines = payment.Line || [];
          
          // Track if this payment had any linked invoices
          let hasLinkedInvoices = false;
          let paymentSyncedSuccessfully = false;
          
          for (const line of lines) {
            // Check for linked invoices in LinkedTxn array
            const linkedTxns = line.LinkedTxn || [];
            for (const linkedTxn of linkedTxns) {
              if (linkedTxn.TxnType === 'Invoice') {
                hasLinkedInvoices = true;
                const qbInvoiceId = linkedTxn.TxnId;
                const invoiceId = invoiceMap.get(qbInvoiceId) || null;
                // QB returns amounts in dollars - store as-is (not multiplied by 100)
                const amountApplied = line.Amount || 0;
                
                // Create unique key for this payment-invoice link
                const paymentKey = `${payment.Id}_${qbInvoiceId}`;
                
                // Skip if already processed (avoid duplicate counting)
                if (processedPaymentKeys.has(paymentKey)) {
                  continue;
                }

                // 1. Upsert to quickbooks_payments (primary sync target)
                const { error: upsertError } = await supabaseAdmin
                  .from('quickbooks_payments')
                  .upsert({
                    user_id: user.id,
                    debtor_id: debtorId,
                    invoice_id: invoiceId,
                    quickbooks_payment_id: payment.Id,
                    quickbooks_invoice_id: qbInvoiceId,
                    amount_applied: amountApplied,
                    currency: currency.toUpperCase(),
                    payment_date: paymentDate,
                    payment_method: paymentMethod,
                    reference_number: referenceNumber,
                    source: 'quickbooks',
                    raw: payment,
                    updated_at: new Date().toISOString()
                  }, {
                    onConflict: 'user_id,quickbooks_payment_id,quickbooks_invoice_id'
                  });

                if (!upsertError) {
                  processedPaymentKeys.add(paymentKey);
                  paymentsSynced++;
                  paymentSyncedSuccessfully = true;
                  
                  // 2. Also upsert to invoice_transactions for Payments Activity Dashboard
                  // This is a secondary sync - failures here don't count as payment sync failures
                  if (invoiceId) {
                    const externalTxnId = `qb_payment_${payment.Id}_${qbInvoiceId}`;
                    const { error: txnError } = await supabaseAdmin
                      .from('invoice_transactions')
                      .upsert({
                        invoice_id: invoiceId,
                        user_id: user.id,
                        transaction_type: 'payment',
                        amount: amountApplied,
                        transaction_date: paymentDate,
                        payment_method: paymentMethod,
                        reference_number: referenceNumber,
                        source_system: 'quickbooks',
                        external_transaction_id: externalTxnId,
                        notes: `QuickBooks Payment #${payment.Id}`,
                        metadata: {
                          quickbooks_payment_id: payment.Id,
                          quickbooks_invoice_id: qbInvoiceId,
                          currency: currency.toUpperCase()
                        }
                      }, {
                        onConflict: 'user_id,external_transaction_id'
                      });
                    
                    if (txnError) {
                      // Log but don't treat as sync failure - primary payment record succeeded
                      console.log(`Invoice transaction secondary sync skipped for payment ${payment.Id}: ${txnError.message}`);
                    }
                  }
                } else {
                  // Only log as error if it's a real database constraint issue, not a duplicate key
                  const isDuplicateError = upsertError.message?.includes('duplicate') || 
                                           upsertError.code === '23505';
                  if (!isDuplicateError) {
                    console.error('Payment upsert error:', upsertError);
                    errors.push(`PAYMENT_UPSERT_FAILED qb_payment_id=${payment.Id}: ${upsertError.message || JSON.stringify(upsertError)}`);
                  } else {
                    // Duplicate is not an error - payment already exists
                    paymentSyncedSuccessfully = true;
                  }
                }
              }
            }
          }
          
          // If payment has no linked invoices (standalone payment), record it without invoice link
          // This is NOT an error - just a payment that doesn't apply to a specific invoice yet
          if (!hasLinkedInvoices && payment.TotalAmt > 0) {
            const standaloneKey = `${payment.Id}_standalone`;
            if (!processedPaymentKeys.has(standaloneKey)) {
              const { error: standaloneError } = await supabaseAdmin
                .from('quickbooks_payments')
                .upsert({
                  user_id: user.id,
                  debtor_id: debtorId,
                  invoice_id: null,
                  quickbooks_payment_id: payment.Id,
                  quickbooks_invoice_id: null,
                  amount_applied: payment.TotalAmt || 0,
                  currency: currency.toUpperCase(),
                  payment_date: paymentDate,
                  payment_method: paymentMethod,
                  reference_number: referenceNumber,
                  source: 'quickbooks',
                  raw: payment,
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'user_id,quickbooks_payment_id,quickbooks_invoice_id'
                });
              
              if (!standaloneError) {
                processedPaymentKeys.add(standaloneKey);
                paymentsSynced++;
              }
              // Don't report standalone payment issues as errors - they're informational
            }
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          // Only log critical errors, not expected conditions
          if (!msg.includes('duplicate') && !msg.includes('already exists')) {
            errors.push(`PAYMENT_SYNC_ERROR qb_payment_id=${payment.Id}: ${msg}`);
          }
        }
      }

    } catch (syncError: unknown) {
      console.error('Sync error:', syncError);
      const msg = syncError instanceof Error ? syncError.message : 'Unknown sync error';
      errors.push(msg);
    }

    // ALWAYS update sync log at end with detailed metrics
    // Terminal invoices are NOT failures - they're valid states from source system
    // Filter errors to only count critical issues (not informational messages)
    const criticalErrors = errors.filter(e => 
      e.includes('UPSERT_FAILED') || 
      e.includes('SYNC_ERROR') || 
      e.includes('Unknown sync error')
    );
    
    const recordsSynced = customersSynced + invoicesSynced + paymentsSynced + contactsSynced;
    
    // Determine final status based on critical errors only
    // If we synced records and have some errors, it's partial
    // If we synced nothing and have errors, it's failed
    // If we have no critical errors, it's success
    let finalStatus: 'success' | 'partial' | 'failed';
    if (criticalErrors.length === 0) {
      finalStatus = 'success';
    } else if (recordsSynced > 0) {
      finalStatus = 'partial';
    } else {
      finalStatus = 'failed';
    }
    
    if (syncLogId) {
      await supabaseAdmin
        .from('quickbooks_sync_log')
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
          records_synced: recordsSynced,
          records_failed: criticalErrors.length,
          invoices_synced: invoicesSynced,
          invoices_terminal: terminalSkipped,
          customers_synced: customersSynced,
          contacts_synced: contactsSynced,
          payments_synced: paymentsSynced,
          // Only store critical errors in the log
          errors: criticalErrors.length > 0 ? criticalErrors : null
        })
        .eq('id', syncLogId);
    }

    // Update last sync time on profile
    await supabaseAdmin
      .from('profiles')
      .update({ quickbooks_last_sync_at: new Date().toISOString() })
      .eq('id', user.id);

    console.log(`Sync complete: ${customersSynced} customers, ${invoicesSynced} invoices, ${paymentsSynced} payments, ${contactsSynced} contacts, ${terminalSkipped} terminal`);

    return new Response(JSON.stringify({
      success: true,
      // One-directional sync indicator
      sync_direction: 'quickbooks_to_recouply',
      read_only: true,
      customers_synced: customersSynced,
      invoices_synced: invoicesSynced,
      payments_synced: paymentsSynced,
      contacts_synced: contactsSynced,
      // Terminal invoices are valid, not failures
      terminal_invoices: terminalSkipped,
      records_synced: recordsSynced,
      sync_type: fullSync ? 'full' : 'incremental',
      errors: errors
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Sync error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

interface TokenContext {
  accessToken: string;
  refreshToken: string;
  supabaseAdmin: any;
  userId: string;
}

/**
 * Paginated QuickBooks query helper.
 * Fetches all records using STARTPOSITION/MAXRESULTS pagination.
 * Retries once on 401 after refreshing the token.
 * @param includeInvoiceLink - If true, adds include=invoiceLink parameter for Invoice queries
 */
async function qbQueryAll(
  apiBase: string,
  realmId: string,
  baseQuery: string,
  tokenContext: TokenContext,
  includeInvoiceLink: boolean = false
): Promise<any[]> {
  const results: any[] = [];
  let startPosition = 1;
  let currentAccessToken = tokenContext.accessToken;
  
  // Extract entity name from query (e.g., "SELECT * FROM Customer" -> "Customer")
  const entityMatch = baseQuery.match(/FROM\s+(\w+)/i);
  const entityName = entityMatch ? entityMatch[1] : null;
  
  if (!entityName) {
    throw new Error(`Could not extract entity name from query: ${baseQuery}`);
  }

  while (true) {
    const paginatedQuery = `${baseQuery} STARTPOSITION ${startPosition} MAXRESULTS ${QB_PAGE_SIZE}`;
    const encodedQuery = encodeURIComponent(paginatedQuery);
    // Standardized URL: minorversion first, then query
    // Add include=invoiceLink for Invoice queries to get customer-facing payment links
    let url = `${apiBase}/v3/company/${realmId}/query?minorversion=${QB_MINOR_VERSION}&query=${encodedQuery}`;
    if (includeInvoiceLink && entityName === 'Invoice') {
      url += '&include=invoiceLink';
    }
    
    console.log(`Fetching ${entityName} from position ${startPosition}...`);
    
    let response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${currentAccessToken}`,
        'Accept': 'application/json'
      }
    });

    // On 401, try to refresh token and retry once
    if (response.status === 401) {
      console.log('QB API returned 401, attempting token refresh...');
      const refreshResult = await refreshTokenCAS(
        tokenContext.supabaseAdmin,
        tokenContext.userId,
        tokenContext.refreshToken
      );
      
      if (!refreshResult) {
        throw new Error('QB query failed: token refresh failed after 401');
      }
      
      // Update context with new tokens
      currentAccessToken = refreshResult.accessToken;
      tokenContext.accessToken = refreshResult.accessToken;
      tokenContext.refreshToken = refreshResult.refreshToken;
      
      // Retry the same request
      console.log('Retrying QB request with refreshed token...');
      response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${currentAccessToken}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`QB query failed after retry (${response.status}): ${errText}`);
      }
    } else if (!response.ok) {
      const errText = await response.text();
      throw new Error(`QB query failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const records = data.QueryResponse?.[entityName] || [];
    
    if (records.length === 0) {
      break;
    }
    
    results.push(...records);
    
    // If we got fewer than max, we've reached the end
    if (records.length < QB_PAGE_SIZE) {
      break;
    }
    
    startPosition += QB_PAGE_SIZE;
  }

  return results;
}

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

/**
 * Refresh QuickBooks token with Compare-And-Swap (CAS) to prevent race conditions.
 * Uses .maybeSingle() for proper CAS semantics:
 * - If updateError => real error, return null
 * - If updated row exists => return new tokens (from Intuit response, not DB)
 * - If no row updated => another process refreshed, fetch latest and validate
 */
async function refreshTokenCAS(
  supabaseAdmin: any,
  userId: string,
  oldRefreshToken: string
): Promise<RefreshResult | null> {
  try {
    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.error('Missing QuickBooks credentials for token refresh');
      return null;
    }

    // Call Intuit to refresh the token
    const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`)
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: oldRefreshToken
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token refresh failed:', response.status, errorText);
      return null;
    }

    const tokens = await response.json();
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

    // CAS update: only update if refresh_token still matches what we used
    // Use .maybeSingle() to distinguish "no match" from "real error"
    // Only select 'id' to avoid exposing sensitive columns
    const { data: updateResult, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        quickbooks_access_token: tokens.access_token,
        quickbooks_refresh_token: tokens.refresh_token,
        quickbooks_token_expires_at: expiresAt.toISOString()
      })
      .eq('id', userId)
      .eq('quickbooks_refresh_token', oldRefreshToken)
      .select('id')
      .maybeSingle();

    // Real database error
    if (updateError) {
      console.error('Database error during CAS update:', updateError);
      return null;
    }

    // CAS succeeded - we updated the row, return tokens from Intuit response
    if (updateResult?.id) {
      console.log('Token refreshed successfully with CAS');
      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token
      };
    }

    // No row updated - another process already refreshed the token
    // Re-fetch the profile to get the current tokens and validate not expired
    console.log('CAS: no row matched, another process may have refreshed. Fetching current token...');
    
    const { data: currentProfile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('quickbooks_access_token, quickbooks_refresh_token, quickbooks_token_expires_at')
      .eq('id', userId)
      .single();

    if (fetchError || !currentProfile?.quickbooks_access_token) {
      console.error('Failed to fetch current token after CAS miss:', fetchError);
      return null;
    }

    // Validate the fetched token is not expired
    if (currentProfile.quickbooks_token_expires_at) {
      const currentExpiry = new Date(currentProfile.quickbooks_token_expires_at);
      if (currentExpiry <= new Date()) {
        console.error('Fetched token is already expired - refresh race condition failed');
        return null;
      }
    }

    console.log('Using token refreshed by another process');
    return {
      accessToken: currentProfile.quickbooks_access_token,
      refreshToken: currentProfile.quickbooks_refresh_token
    };

  } catch (e: unknown) {
    console.error('Token refresh error:', e);
    return null;
  }
}
