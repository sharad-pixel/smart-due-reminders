import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);
  const baseRedirect = Deno.env.get('SITE_URL') || 'https://recouply.ai';
  
  try {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const realmId = url.searchParams.get('realmId');
    const error = url.searchParams.get('error');

    console.log('QuickBooks OAuth callback received:', { code: !!code, state: !!state, realmId, error });

    // Handle errors from Intuit
    if (error) {
      console.error('OAuth error from Intuit:', error);
      return Response.redirect(`${baseRedirect}/data-center?qb_error=${encodeURIComponent(error)}`);
    }

    if (!code || !state || !realmId) {
      console.error('Missing parameters:', { code: !!code, state: !!state, realmId: !!realmId });
      return Response.redirect(`${baseRedirect}/data-center?qb_error=missing_parameters`);
    }

    // Decode state to get user ID
    let stateData;
    try {
      stateData = JSON.parse(atob(state));
    } catch (e) {
      console.error('Failed to decode state:', e);
      return Response.redirect(`${baseRedirect}/data-center?qb_error=invalid_state`);
    }

    const userId = stateData.userId;
    if (!userId) {
      console.error('No user ID in state');
      return Response.redirect(`${baseRedirect}/data-center?qb_error=no_user_id`);
    }

    // Exchange code for tokens using PLATFORM credentials
    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
    const redirectUri = Deno.env.get('QUICKBOOKS_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('Missing QuickBooks credentials');
      return Response.redirect(`${baseRedirect}/data-center?qb_error=config_error`);
    }

    console.log('Exchanging code for tokens...');
    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`)
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorText);
      return Response.redirect(`${baseRedirect}/data-center?qb_error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();
    console.log('Tokens received successfully');

    // Get company info from QuickBooks
    const environment = Deno.env.get('QUICKBOOKS_ENVIRONMENT') || 'sandbox';
    const apiBase = environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    let companyName = 'QuickBooks Company';
    try {
      const companyResponse = await fetch(
        `${apiBase}/v3/company/${realmId}/companyinfo/${realmId}`,
        {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
            'Accept': 'application/json'
          }
        }
      );
      if (companyResponse.ok) {
        const companyData = await companyResponse.json();
        companyName = companyData.CompanyInfo?.CompanyName || companyName;
        console.log('Company name fetched:', companyName);
      } else {
        console.warn('Could not fetch company info:', companyResponse.status);
      }
    } catch (e) {
      console.warn('Error fetching company name:', e);
    }

    // Store tokens in THIS USER's profile
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        quickbooks_realm_id: realmId,
        quickbooks_access_token: tokens.access_token,
        quickbooks_refresh_token: tokens.refresh_token,
        quickbooks_token_expires_at: expiresAt.toISOString(),
        quickbooks_company_name: companyName,
        quickbooks_connected_at: new Date().toISOString(),
        quickbooks_sync_enabled: true
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to store tokens:', updateError);
      return Response.redirect(`${baseRedirect}/data-center?qb_error=storage_failed`);
    }

    console.log(`QuickBooks connected for user ${userId}: ${companyName} (${realmId})`);

    // Success! Redirect to Data Center
    return Response.redirect(`${baseRedirect}/data-center?qb_connected=true&company=${encodeURIComponent(companyName)}`);

  } catch (error) {
    console.error('OAuth callback error:', error);
    return Response.redirect(`${baseRedirect}/data-center?qb_error=unknown_error`);
  }
});
