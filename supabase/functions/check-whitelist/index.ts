import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email is in manual whitelist table
    const { data: whitelistEntry, error: whitelistError } = await supabase
      .from("early_access_whitelist")
      .select("id, email, used_at")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (whitelistError) {
      console.error("Whitelist check error:", whitelistError);
      return new Response(
        JSON.stringify({ error: "Failed to check whitelist" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also check if user was invited via Supabase Auth (Cloud UI invites)
    const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();
    
    let invitedViaAuth = false;
    if (!authError && authUser?.users) {
      // Check if user exists in auth.users (invited via Cloud UI)
      invitedViaAuth = authUser.users.some(
        (u) => u.email?.toLowerCase() === normalizedEmail
      );
    }

    const isWhitelisted = !!whitelistEntry || invitedViaAuth;

    return new Response(
      JSON.stringify({ 
        isWhitelisted,
        alreadyUsed: whitelistEntry?.used_at ? true : false
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});