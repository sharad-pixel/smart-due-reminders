import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { grant_id } = await req.json();
    if (!grant_id) throw new Error("grant_id required");

    const { data: grant } = await supabase
      .from("support_access_grants")
      .select("*")
      .eq("id", grant_id)
      .maybeSingle();
    if (!grant) throw new Error("Grant not found");

    // Authorization: owner of the account, account manager, or recouply admin
    const isOwner = grant.account_id === user.id;
    const { data: isMgr } = await supabase.rpc("is_account_manager", {
      _user_id: user.id,
      _account_id: grant.account_id,
    });
    const { data: isAdmin } = await supabase.rpc("is_recouply_admin", { _user_id: user.id });

    if (!isOwner && !isMgr && !isAdmin) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await supabase
      .from("support_access_grants")
      .update({ revoked_at: new Date().toISOString(), revoked_by: user.id })
      .eq("id", grant_id);
    if (error) throw error;

    await supabase.from("admin_user_actions").insert({
      admin_id: user.id,
      target_user_id: grant.account_id,
      action: "support_access_revoked",
      action_type: "support_access",
      details: { grant_id },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("revoke-support-access error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
