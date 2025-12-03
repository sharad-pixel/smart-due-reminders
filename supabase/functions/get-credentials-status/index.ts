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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized: No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized: Invalid session');
    }

    // Fetch profile to check which credentials are configured
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('sendgrid_api_key, twilio_account_sid, twilio_auth_token, twilio_from_number')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new Error('Failed to fetch profile');
    }

    // Return status (configured or not) without actual values
    return new Response(
      JSON.stringify({
        sendgrid_configured: !!profile?.sendgrid_api_key,
        twilio_configured: !!(profile?.twilio_account_sid && profile?.twilio_auth_token),
        twilio_from_number: profile?.twilio_from_number || null, // This one is not encrypted
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get credentials status error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
