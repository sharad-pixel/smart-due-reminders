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

    const { stripe_secret_key } = await req.json();

    if (!stripe_secret_key) {
      throw new Error('Stripe secret key is required');
    }

    // Validate the key format
    if (!stripe_secret_key.startsWith('sk_')) {
      throw new Error('Invalid Stripe secret key format. Key should start with sk_');
    }

    console.log('Saving encrypted Stripe credentials for user:', user.id);

    // Encrypt the key
    const encryptedKey = await encryptValue(stripe_secret_key);

    // Use service role to update
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get effective account ID
    const { data: effectiveAccountId } = await supabaseAdmin.rpc('get_effective_account_id', { p_user_id: user.id });
    const accountId = effectiveAccountId || user.id;

    // Upsert stripe integration with encrypted key
    const { error: upsertError } = await supabaseAdmin
      .from('stripe_integrations')
      .upsert({
        user_id: accountId,
        stripe_secret_key_encrypted: encryptedKey,
        is_connected: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      throw new Error('Failed to save Stripe credentials');
    }

    console.log('Stripe credentials saved successfully for account:', accountId);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Save Stripe credentials error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
