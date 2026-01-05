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
    // Get current user
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

    // Get platform credentials (Recouply's app credentials)
    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const redirectUri = Deno.env.get('QUICKBOOKS_REDIRECT_URI');
    
    if (!clientId || !redirectUri) {
      console.error('Missing QuickBooks config:', { clientId: !!clientId, redirectUri: !!redirectUri });
      return new Response(JSON.stringify({ error: 'QuickBooks integration not configured. Contact support.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create state with user ID (so callback knows which account to update)
    const state = btoa(JSON.stringify({ 
      userId: user.id,
      timestamp: Date.now(),
      nonce: crypto.randomUUID()
    }));

    // Build OAuth URL
    const authUrl = 'https://appcenter.intuit.com/connect/oauth2?' + new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'com.intuit.quickbooks.accounting',
      state: state
    }).toString();

    console.log(`QuickBooks OAuth started for user ${user.id}`);

    return new Response(JSON.stringify({ authUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('OAuth start error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
