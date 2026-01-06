import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body for options
    let fullSync = false;
    try {
      const body = await req.json();
      fullSync = body?.full_sync === true;
    } catch {
      // No body or invalid JSON - use defaults
    }

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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create sync log at the START of sync (always)
    let syncLogId: string | null = null;
    try {
      const { data: insertedLog } = await supabaseAdmin.from('quickbooks_sync_log').insert({
        user_id: user.id,
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
      .eq('id', user.id)
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
        const refreshResult = await refreshTokenCAS(supabaseAdmin, user.id, currentRefreshToken);
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
    const errors: string[] = [];

    // Token refresh context for qbQueryAll retry logic
    const tokenContext = {
      accessToken,
      refreshToken: currentRefreshToken,
      supabaseAdmin,
      userId: user.id
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
      let invoiceQuery = 'SELECT * FROM Invoice';
      if (!fullSync) {
        invoiceQuery = `SELECT * FROM Invoice WHERE TxnDate >= '${cutoffStr}'`;
      }
      console.log('Fetching invoices from QuickBooks...');
      const invoices = await qbQueryAll(apiBase, realmId, invoiceQuery, tokenContext);

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

      // Process customers
      for (const customer of customers) {
        try {
          const { error: upsertError } = await supabaseAdmin
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
            });

          if (!upsertError) {
            customersSynced++;
          } else {
            console.error('Customer upsert error:', upsertError);
            errors.push(`CUSTOMER_UPSERT_FAILED qb_customer_id=${customer.Id} name=${customer.DisplayName || customer.CompanyName}: ${upsertError.message || JSON.stringify(upsertError)}`);
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          errors.push(`CUSTOMER_UPSERT_FAILED qb_customer_id=${customer.Id} name=${customer.DisplayName || customer.CompanyName}: ${msg}`);
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
          const status = invoice.Balance === 0 ? 'Paid' : 'Open';

          const { error: upsertError } = await supabaseAdmin
            .from('invoices')
            .upsert({
              user_id: user.id,
              debtor_id: debtorId,
              quickbooks_invoice_id: invoice.Id,
              quickbooks_doc_number: invoice.DocNumber,
              invoice_number: invoice.DocNumber || `QB-${invoice.Id}`,
              amount: Math.round((invoice.TotalAmt || 0) * 100),
              outstanding_amount: Math.round((invoice.Balance || 0) * 100),
              invoice_date: invoice.TxnDate,
              due_date: dueDate,
              status: status,
              integration_source: 'quickbooks',
              last_synced_at: new Date().toISOString()
            }, {
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

      // Process payments
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
          for (const line of lines) {
            // Check for linked invoices in LinkedTxn array
            const linkedTxns = line.LinkedTxn || [];
            for (const linkedTxn of linkedTxns) {
              if (linkedTxn.TxnType === 'Invoice') {
                const qbInvoiceId = linkedTxn.TxnId;
                const invoiceId = invoiceMap.get(qbInvoiceId) || null;
                const amountApplied = Math.round((line.Amount || 0) * 100);

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
                  paymentsSynced++;
                } else {
                  console.error('Payment upsert error:', upsertError);
                  errors.push(`PAYMENT_UPSERT_FAILED qb_payment_id=${payment.Id}: ${upsertError.message || JSON.stringify(upsertError)}`);
                }
              }
            }
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          errors.push(`PAYMENT_UPSERT_FAILED qb_payment_id=${payment.Id}: ${msg}`);
        }
      }

    } catch (syncError: unknown) {
      console.error('Sync error:', syncError);
      const msg = syncError instanceof Error ? syncError.message : 'Unknown sync error';
      errors.push(msg);
    }

    // ALWAYS update sync log at end
    const finalStatus = errors.length > 0 ? (customersSynced + invoicesSynced + paymentsSynced > 0 ? 'partial' : 'failed') : 'success';
    const recordsSynced = customersSynced + invoicesSynced + paymentsSynced;
    
    if (syncLogId) {
      await supabaseAdmin
        .from('quickbooks_sync_log')
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
          records_synced: recordsSynced,
          records_failed: errors.length,
          errors: errors.length > 0 ? errors : null
        })
        .eq('id', syncLogId);
    }

    // Update last sync time on profile
    await supabaseAdmin
      .from('profiles')
      .update({ quickbooks_last_sync_at: new Date().toISOString() })
      .eq('id', user.id);

    console.log(`Sync complete: ${customersSynced} customers, ${invoicesSynced} invoices, ${paymentsSynced} payments`);

    return new Response(JSON.stringify({
      success: true,
      customers_synced: customersSynced,
      invoices_synced: invoicesSynced,
      payments_synced: paymentsSynced,
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
 */
async function qbQueryAll(
  apiBase: string,
  realmId: string,
  baseQuery: string,
  tokenContext: TokenContext
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
    const url = `${apiBase}/v3/company/${realmId}/query?minorversion=${QB_MINOR_VERSION}&query=${encodedQuery}`;
    
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
