import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Check if token is expired and refresh if needed
    if (profile.quickbooks_token_expires_at) {
      const expiresAt = new Date(profile.quickbooks_token_expires_at);
      if (expiresAt <= new Date()) {
        console.log('Token expired, refreshing...');
        accessToken = await refreshToken(supabaseAdmin, user.id, profile.quickbooks_refresh_token);
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
      // Sync Customers
      console.log('Fetching customers from QuickBooks...');
      const customersResponse = await fetch(
        `${apiBase}/v3/company/${realmId}/query?query=SELECT * FROM Customer MAXRESULTS 1000`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      if (customersResponse.ok) {
        const customersData = await customersResponse.json();
        const customers = customersData.QueryResponse?.Customer || [];
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
      } else {
        const errText = await customersResponse.text();
        console.error('Failed to fetch customers:', errText);
        errors.push(`Customers fetch failed: ${customersResponse.status}`);
      }

      // Sync Invoices
      console.log('Fetching invoices from QuickBooks...');
      const invoicesResponse = await fetch(
        `${apiBase}/v3/company/${realmId}/query?query=SELECT * FROM Invoice MAXRESULTS 1000`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      if (invoicesResponse.ok) {
        const invoicesData = await invoicesResponse.json();
        const invoices = invoicesData.QueryResponse?.Invoice || [];
        console.log(`Found ${invoices.length} invoices`);

        for (const invoice of invoices) {
          try {
            // Find linked debtor
            const { data: debtor } = await supabaseAdmin
              .from('debtors')
              .select('id')
              .eq('user_id', user.id)
              .eq('quickbooks_customer_id', invoice.CustomerRef?.value)
              .single();

            if (!debtor) {
              errors.push(`Invoice ${invoice.DocNumber}: No matching customer`);
              continue;
            }

            const dueDate = invoice.DueDate || invoice.TxnDate;
            const status = invoice.Balance === 0 ? 'Paid' : 'Open';

            const { error: upsertError } = await supabaseAdmin
              .from('invoices')
              .upsert({
                user_id: user.id,
                debtor_id: debtor.id,
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
      } else {
        const errText = await invoicesResponse.text();
        console.error('Failed to fetch invoices:', errText);
        errors.push(`Invoices fetch failed: ${invoicesResponse.status}`);
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

async function refreshToken(supabaseAdmin: any, userId: string, refreshToken: string): Promise<string | null> {
  try {
    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');

    const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`)
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text());
      return null;
    }

    const tokens = await response.json();
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

    await supabaseAdmin
      .from('profiles')
      .update({
        quickbooks_access_token: tokens.access_token,
        quickbooks_refresh_token: tokens.refresh_token,
        quickbooks_token_expires_at: expiresAt.toISOString()
      })
      .eq('id', userId);

    return tokens.access_token;
  } catch (e) {
    console.error('Refresh token error:', e);
    return null;
  }
}
