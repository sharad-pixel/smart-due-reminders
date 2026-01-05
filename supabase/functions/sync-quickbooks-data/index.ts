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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Get user's QuickBooks connection
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('quickbooks_realm_id, quickbooks_access_token, quickbooks_refresh_token, quickbooks_token_expires_at')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.quickbooks_realm_id) {
      return new Response(JSON.stringify({ error: 'QuickBooks not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let accessToken = profile.quickbooks_access_token;
    const realmId = profile.quickbooks_realm_id;

    // Check if token is expired (with 2-minute buffer) and refresh if needed
    if (profile.quickbooks_token_expires_at) {
      const expiresAt = new Date(profile.quickbooks_token_expires_at);
      const refreshThreshold = new Date(Date.now() + TOKEN_REFRESH_BUFFER_MS);
      
      if (expiresAt <= refreshThreshold) {
        console.log('Token expired or expiring soon, refreshing with CAS...');
        accessToken = await refreshTokenCAS(supabaseAdmin, user.id, profile.quickbooks_refresh_token);
        if (!accessToken) {
          return new Response(JSON.stringify({ error: 'Failed to refresh token. Please reconnect QuickBooks.' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    const environment = Deno.env.get('QUICKBOOKS_ENVIRONMENT') || 'sandbox';
    const apiBase = environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    // Create sync log
    const { data: syncLog } = await supabaseAdmin
      .from('quickbooks_sync_log')
      .insert({
        user_id: user.id,
        sync_type: 'full',
        status: 'running'
      })
      .select()
      .single();

    let customersSynced = 0;
    let invoicesSynced = 0;
    const errors: string[] = [];

    try {
      // Sync Customers with pagination
      console.log('Fetching customers from QuickBooks...');
      const customers = await qbQueryAll(
        apiBase,
        realmId,
        accessToken,
        'SELECT * FROM Customer'
      );
      console.log(`Found ${customers.length} customers`);

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
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          errors.push(`Customer ${customer.Id}: ${msg}`);
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

      // Sync Invoices with pagination
      console.log('Fetching invoices from QuickBooks...');
      const invoices = await qbQueryAll(
        apiBase,
        realmId,
        accessToken,
        'SELECT * FROM Invoice'
      );
      console.log(`Found ${invoices.length} invoices`);

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
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          errors.push(`Invoice ${invoice.DocNumber || invoice.Id}: ${msg}`);
        }
      }

    } catch (syncError: unknown) {
      console.error('Sync error:', syncError);
      const msg = syncError instanceof Error ? syncError.message : 'Unknown sync error';
      errors.push(msg);
    }

    // Update sync log
    if (syncLog?.id) {
      await supabaseAdmin
        .from('quickbooks_sync_log')
        .update({
          status: errors.length > 0 ? 'partial' : 'success',
          completed_at: new Date().toISOString(),
          records_synced: customersSynced + invoicesSynced,
          records_failed: errors.length,
          errors: errors.length > 0 ? errors : null
        })
        .eq('id', syncLog.id);
    }

    // Update last sync time on profile
    await supabaseAdmin
      .from('profiles')
      .update({ quickbooks_last_sync_at: new Date().toISOString() })
      .eq('id', user.id);

    console.log(`Sync complete: ${customersSynced} customers, ${invoicesSynced} invoices`);

    return new Response(JSON.stringify({
      success: true,
      customers_synced: customersSynced,
      invoices_synced: invoicesSynced,
      errors: errors.length > 0 ? errors : undefined
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

/**
 * Paginated QuickBooks query helper.
 * Fetches all records using STARTPOSITION/MAXRESULTS pagination.
 */
async function qbQueryAll(
  apiBase: string,
  realmId: string,
  accessToken: string,
  baseQuery: string
): Promise<any[]> {
  const results: any[] = [];
  let startPosition = 1;
  
  // Extract entity name from query (e.g., "SELECT * FROM Customer" -> "Customer")
  const entityMatch = baseQuery.match(/FROM\s+(\w+)/i);
  const entityName = entityMatch ? entityMatch[1] : null;
  
  if (!entityName) {
    throw new Error(`Could not extract entity name from query: ${baseQuery}`);
  }

  while (true) {
    const paginatedQuery = `${baseQuery} STARTPOSITION ${startPosition} MAXRESULTS ${QB_PAGE_SIZE}`;
    const encodedQuery = encodeURIComponent(paginatedQuery);
    const url = `${apiBase}/v3/company/${realmId}/query?query=${encodedQuery}&minorversion=${QB_MINOR_VERSION}`;
    
    console.log(`Fetching ${entityName} from position ${startPosition}...`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
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

/**
 * Refresh QuickBooks token with Compare-And-Swap (CAS) to prevent race conditions.
 * Uses .maybeSingle() for proper CAS semantics:
 * - If updateError => real error, return null
 * - If updated row exists => return new token
 * - If no row updated => another process refreshed, fetch latest and validate
 */
async function refreshTokenCAS(
  supabaseAdmin: any,
  userId: string,
  oldRefreshToken: string
): Promise<string | null> {
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
    const { data: updateResult, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        quickbooks_access_token: tokens.access_token,
        quickbooks_refresh_token: tokens.refresh_token,
        quickbooks_token_expires_at: expiresAt.toISOString()
      })
      .eq('id', userId)
      .eq('quickbooks_refresh_token', oldRefreshToken)
      .select('quickbooks_access_token')
      .maybeSingle();

    // Real database error
    if (updateError) {
      console.error('Database error during CAS update:', updateError);
      return null;
    }

    // CAS succeeded - we updated the row
    if (updateResult?.quickbooks_access_token) {
      console.log('Token refreshed successfully with CAS');
      return updateResult.quickbooks_access_token;
    }

    // No row updated - another process already refreshed the token
    // Re-fetch the profile to get the current access token and validate it's not expired
    console.log('CAS: no row matched, another process may have refreshed. Fetching current token...');
    
    const { data: currentProfile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('quickbooks_access_token, quickbooks_token_expires_at')
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
    return currentProfile.quickbooks_access_token;

  } catch (e: unknown) {
    console.error('Token refresh error:', e);
    return null;
  }
}
