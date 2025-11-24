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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { email, success, ipAddress } = await req.json();

    if (!email || typeof success !== 'boolean') {
      throw new Error('Missing required fields');
    }

    // Check rate limit before recording attempt
    const { data: rateLimitCheck, error: rateLimitError } = await supabaseClient
      .rpc('check_rate_limit', {
        p_email: email,
        p_ip_address: ipAddress || 'unknown'
      });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
    }

    const isLocked = rateLimitCheck?.[0]?.is_locked;
    const attemptsCount = rateLimitCheck?.[0]?.attempts_count || 0;
    const lockExpiry = rateLimitCheck?.[0]?.locked_until;

    if (isLocked) {
      return new Response(
        JSON.stringify({
          locked: true,
          lockedUntil: lockExpiry,
          message: `Account locked due to too many failed attempts. Try again after ${new Date(lockExpiry).toLocaleTimeString()}`
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Record the login attempt
    const newLockExpiry = !success && attemptsCount >= 4 
      ? new Date(Date.now() + 15 * 60 * 1000).toISOString() // Lock for 15 minutes after 5 failed attempts
      : null;

    const { error: insertError } = await supabaseClient
      .from('login_attempts')
      .insert({
        email,
        ip_address: ipAddress || 'unknown',
        success,
        locked_until: newLockExpiry
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        locked: false,
        attemptsRemaining: Math.max(0, 4 - attemptsCount),
        willLock: !success && attemptsCount >= 4
      }),
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
