import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Encrypt a value using AES-GCM
async function encryptValue(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
  if (!encryptionKey) {
    throw new Error('Encryption key not configured');
  }

  const keyMaterial = encoder.encode(encryptionKey);
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial.slice(0, 32),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...result));
}

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

    const { 
      sendgrid_api_key, 
      twilio_account_sid, 
      twilio_auth_token, 
      twilio_from_number 
    } = await req.json();

    console.log('Saving encrypted credentials for user:', user.id);

    // Build update object with encrypted values
    const updateData: Record<string, string | null> = {};

    // Only update fields that were provided (not undefined)
    if (sendgrid_api_key !== undefined) {
      updateData.sendgrid_api_key = sendgrid_api_key 
        ? await encryptValue(sendgrid_api_key) 
        : null;
    }

    if (twilio_account_sid !== undefined) {
      updateData.twilio_account_sid = twilio_account_sid 
        ? await encryptValue(twilio_account_sid) 
        : null;
    }

    if (twilio_auth_token !== undefined) {
      updateData.twilio_auth_token = twilio_auth_token 
        ? await encryptValue(twilio_auth_token) 
        : null;
    }

    // Twilio from number doesn't need encryption (it's not a secret)
    if (twilio_from_number !== undefined) {
      updateData.twilio_from_number = twilio_from_number || null;
    }

    // Use service role to update (bypasses RLS for encrypted storage)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      console.error('Update error:', updateError);
      throw new Error('Failed to save credentials');
    }

    console.log('Credentials saved successfully for user:', user.id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Save credentials error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
