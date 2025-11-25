import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Not authenticated');
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
      throw new Error('Not authenticated');
    }

    const {
      email_address,
      provider,
      display_name,
      smtp_host,
      smtp_port,
      smtp_username,
      smtp_password,
      imap_host,
      imap_port,
      imap_username,
      imap_password
    } = await req.json();

    console.log('Saving email account for user:', user.id, 'provider:', provider);

    // Encrypt passwords server-side
    const encryptedSmtpPassword = await encryptValue(smtp_password);
    let encryptedImapPassword = null;
    if (imap_password) {
      encryptedImapPassword = await encryptValue(imap_password);
    }

    // Save to database
    const { data, error } = await supabaseClient.from("email_accounts").insert({
      user_id: user.id,
      email_address,
      provider: provider || "smtp",
      display_name,
      auth_method: "smtp",
      smtp_host,
      smtp_port,
      smtp_username,
      smtp_password_encrypted: encryptedSmtpPassword,
      smtp_use_tls: true,
      imap_host,
      imap_port,
      imap_username,
      imap_password_encrypted: encryptedImapPassword,
      connection_status: "pending",
      is_active: true,
    }).select().single();

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log('Email account saved successfully:', data.id);

    return new Response(
      JSON.stringify({ success: true, account: data }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in save-email-account:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
