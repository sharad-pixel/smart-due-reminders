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

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const normalizedEmail = email.toLowerCase().trim();

    // Check ONLY the whitelist table. The sync_auth_user_to_whitelist trigger
    // automatically inserts any Cloud-UI-invited user into this table, so it is
    // the single source of truth. We deliberately DO NOT call auth.admin.listUsers()
    // here, which would enable unauthenticated account enumeration of all users.
    const { data: whitelistEntry, error: whitelistError } = await supabase
      .from("early_access_whitelist")
      .select("id, used_at")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (whitelistError) {
      console.error("Whitelist check error:", whitelistError);
      // Fail closed — return generic negative response, do not leak DB errors.
      return new Response(
        JSON.stringify({ isWhitelisted: false, alreadyUsed: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        isWhitelisted: !!whitelistEntry,
        alreadyUsed: whitelistEntry?.used_at ? true : false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    // Generic response to avoid distinguishing failure modes.
    return new Response(
      JSON.stringify({ isWhitelisted: false, alreadyUsed: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
