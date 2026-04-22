import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyTokenRequest {
  token: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json() as VerifyTokenRequest;

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the secret with this token, then load the corresponding profile
    const { data: secretRow, error: secretError } = await supabase
      .from("user_secrets")
      .select("user_id")
      .eq("email_verification_token", token)
      .maybeSingle();

    if (secretError || !secretRow) {
      console.error("Token not found:", secretError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired verification token" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: profile, error: findError } = await supabase
      .from("profiles")
      .select("id, email_verification_token_expires_at")
      .eq("id", secretRow.user_id)
      .single();

    if (findError || !profile) {
      console.error("Profile not found for verification token:", findError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired verification token" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if token has expired
    const expiresAt = new Date(profile.email_verification_token_expires_at);
    if (expiresAt < new Date()) {
      return new Response(
        JSON.stringify({ error: "Verification token has expired. Please request a new one." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Mark email as verified and clear the token
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        email_verified: true,
        email_verification_token_expires_at: null,
      })
      .eq("id", profile.id);

    const { error: updateError } = profileUpdateError
      ? { error: profileUpdateError }
      : await supabase
          .from("user_secrets")
          .update({ email_verification_token: null })
          .eq("user_id", profile.id);

    if (updateError) {
      console.error("Error updating profile:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to verify email" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email verified for profile:", profile.id);

    return new Response(
      JSON.stringify({ success: true, message: "Email verified successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error verifying email token:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
