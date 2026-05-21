import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
    
    if (!clientId) {
      return new Response(JSON.stringify({ error: 'Google Drive Client ID not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const redirectUri = `${supabaseUrl}/functions/v1/google-drive-callback`;
    // Contract and invoice folder scans need read access to files inside a selected folder.
    const body = await req.json().catch(() => ({}));
    // Base scopes: drive.file for Picker selections plus drive.readonly for folder discovery/download.
    const scopes = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.readonly'];
    if (body.include_docs_scope) scopes.push('https://www.googleapis.com/auth/documents');
    const scope = scopes.join(' ');
    const origin = body.origin || supabaseUrl;
    const state = btoa(JSON.stringify({ userId: user.id, origin }));

    // If user signed in with Google, use their email as login_hint for seamless auth
    const isGoogleUser = user.app_metadata?.provider === 'google' || 
                         user.app_metadata?.providers?.includes('google');
    const loginHint = isGoogleUser ? user.email : '';

    let authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${encodeURIComponent(state)}`;

    // Add login_hint for Google OAuth users so they don't need to pick an account
    if (loginHint) {
      authUrl += `&login_hint=${encodeURIComponent(loginHint)}`;
    }

    return new Response(JSON.stringify({ authUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('google-drive-auth error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
