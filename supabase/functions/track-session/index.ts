import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { UAParser } from "https://esm.sh/ua-parser-js@1.0.35";

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
      throw new Error('No authorization header');
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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const userAgent = req.headers.get('user-agent') || '';
    const parser = new UAParser(userAgent);
    const deviceInfo = parser.getResult();

    // Get IP address from headers
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() 
      || req.headers.get('x-real-ip')
      || 'unknown';

    // Mark all other sessions as not current
    await supabaseClient
      .from('user_sessions')
      .update({ is_current: false })
      .eq('user_id', user.id);

    // Create new session record
    const { error: insertError } = await supabaseClient
      .from('user_sessions')
      .insert({
        user_id: user.id,
        device_name: `${deviceInfo.browser.name} on ${deviceInfo.os.name}`,
        device_type: deviceInfo.device.type || 'desktop',
        browser: deviceInfo.browser.name,
        os: deviceInfo.os.name,
        ip_address: ipAddress,
        user_agent: userAgent,
        is_current: true,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
