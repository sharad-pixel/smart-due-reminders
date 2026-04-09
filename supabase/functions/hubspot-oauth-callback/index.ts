import { createClient } from "npm:@supabase/supabase-js@2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[HUBSPOT-OAUTH-CALLBACK] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDesc = url.searchParams.get('error_description');

    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://smart-due-reminders.lovable.app';

    if (error) {
      logStep('OAuth error from HubSpot', { error, errorDesc });
      return Response.redirect(
        `${frontendUrl}/data-center?hs_status=error&hs_message=${encodeURIComponent(errorDesc || error)}`,
        302
      );
    }

    if (!code || !state) {
      return Response.redirect(
        `${frontendUrl}/data-center?hs_status=error&hs_message=${encodeURIComponent('Missing code or state')}`,
        302
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate state
    const { data: oauthState, error: stateErr } = await supabaseAdmin
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .eq('provider', 'hubspot')
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (stateErr || !oauthState) {
      logStep('Invalid or expired state', { stateErr: stateErr?.message });
      return Response.redirect(
        `${frontendUrl}/data-center?hs_status=error&hs_message=${encodeURIComponent('Invalid or expired state. Please try again.')}`,
        302
      );
    }

    // Mark state as used
    await supabaseAdmin.from('oauth_states').update({ used_at: new Date().toISOString() }).eq('id', oauthState.id);

    const userId = oauthState.user_id;
    const clientId = Deno.env.get('HUBSPOT_CLIENT_ID')!;
    const clientSecret = Deno.env.get('HUBSPOT_CLIENT_SECRET')!;
    const redirectUri = Deno.env.get('HUBSPOT_REDIRECT_URI') ||
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/hubspot-oauth-callback`;

    // Exchange code for tokens
    const tokenRes = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      logStep('Token exchange failed', { status: tokenRes.status, error: tokenData.message });
      return Response.redirect(
        `${frontendUrl}/data-center?hs_status=error&hs_message=${encodeURIComponent('Failed to get HubSpot tokens')}`,
        302
      );
    }

    logStep('Token exchange successful');

    // Get HubSpot portal ID for instance URL
    const portalId = tokenData.hub_id ? `https://app.hubspot.com/contacts/${tokenData.hub_id}` : null;

    // Upsert CRM connection
    const { error: upsertErr } = await supabaseAdmin
      .from('crm_connections')
      .upsert({
        user_id: userId,
        crm_type: 'hubspot',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        instance_url: portalId,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,crm_type',
      });

    if (upsertErr) {
      logStep('Failed to store connection', { error: upsertErr.message });
      // Try insert if upsert fails
      const { error: insertErr } = await supabaseAdmin
        .from('crm_connections')
        .insert({
          user_id: userId,
          crm_type: 'hubspot',
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          instance_url: portalId,
          connected_at: new Date().toISOString(),
        });

      if (insertErr) {
        logStep('Insert also failed', { error: insertErr.message });
        return Response.redirect(
          `${frontendUrl}/data-center?hs_status=error&hs_message=${encodeURIComponent('Failed to save connection')}`,
          302
        );
      }
    }

    logStep('HubSpot connected successfully', { userId });

    return Response.redirect(
      `${frontendUrl}/data-center?hs_status=success&hs_message=${encodeURIComponent('HubSpot connected successfully!')}`,
      302
    );

  } catch (err) {
    logStep('Fatal error', { error: String(err) });
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://smart-due-reminders.lovable.app';
    return Response.redirect(
      `${frontendUrl}/data-center?hs_status=error&hs_message=${encodeURIComponent('An unexpected error occurred')}`,
      302
    );
  }
});
