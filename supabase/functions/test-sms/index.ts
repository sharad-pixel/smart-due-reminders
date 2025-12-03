import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Decrypt a value using AES-GCM
async function decryptValue(encryptedValue: string): Promise<string> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  
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
    ['decrypt']
  );

  // Decode from base64
  const encryptedData = Uint8Array.from(atob(encryptedValue), c => c.charCodeAt(0));
  
  // Extract IV (first 12 bytes) and ciphertext
  const iv = encryptedData.slice(0, 12);
  const ciphertext = encryptedData.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return decoder.decode(decrypted);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { to } = await req.json();

    if (!to) {
      throw new Error("Phone number is required");
    }

    // Get user's Twilio credentials from profile (encrypted)
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("twilio_account_sid, twilio_auth_token, twilio_from_number, business_name")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile?.twilio_account_sid ||
      !profile?.twilio_auth_token ||
      !profile?.twilio_from_number
    ) {
      throw new Error("Twilio credentials not configured");
    }

    // Decrypt credentials
    let accountSid: string;
    let authToken: string;
    
    try {
      accountSid = await decryptValue(profile.twilio_account_sid);
      authToken = await decryptValue(profile.twilio_auth_token);
    } catch (decryptError) {
      console.error("Decryption error:", decryptError);
      throw new Error("Failed to decrypt Twilio credentials. Please reconfigure your Twilio settings.");
    }

    // Send test SMS using Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const authHeader = `Basic ${btoa(`${accountSid}:${authToken}`)}`;

    const formData = new URLSearchParams();
    formData.append("To", to);
    formData.append("From", profile.twilio_from_number);
    formData.append(
      "Body",
      `Test SMS from ${profile.business_name || "Recouply.ai"}: Your Twilio integration is working correctly!`
    );

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      console.error("Twilio error:", errorText);
      throw new Error(`Twilio API error: ${twilioResponse.status}`);
    }

    const twilioData = await twilioResponse.json();
    console.log("Test SMS sent successfully to:", to, "SID:", twilioData.sid);

    return new Response(
      JSON.stringify({ success: true, message: "Test SMS sent successfully", sid: twilioData.sid }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in test-sms function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send test SMS" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
