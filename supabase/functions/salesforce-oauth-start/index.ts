import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SALESFORCE-OAUTH-START] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
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

    const clientId = Deno.env.get('SALESFORCE_CLIENT_ID');
    const redirectUri = Deno.env.get('SALESFORCE_REDIRECT_URI') ||
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/salesforce-oauth-callback`;

    if (!clientId) {
      logStep('Missing SALESFORCE_CLIENT_ID');
      return new Response(JSON.stringify({ error: 'Salesforce integration not configured. Contact support.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate opaque state token
    const state = crypto.randomUUID();

    // Store state server-side
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error: stateErr } = await supabaseAdmin
      .from('oauth_states')
      .insert({
        user_id: user.id,
        provider: 'salesforce',
        state,
        expires_at: expiresAt
      });

    if (stateErr) {
      logStep('Failed to store oauth state', { error: stateErr.message });
      return new Response(JSON.stringify({ error: 'Failed to start OAuth' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Build Salesforce OAuth URL (production login)
    const loginUrl = Deno.env.get('SALESFORCE_LOGIN_URL') || 'https://login.salesforce.com';
    const authUrl = `${loginUrl}/services/oauth2/authorize?` + new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'api refresh_token',
      state: state,
    }).toString();

    logStep('OAuth started', { userId: user.id });

    return new Response(JSON.stringify({ authUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    logStep('Error', { error: String(error) });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
