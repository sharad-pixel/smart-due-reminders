import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: accountId } = await supabase.rpc("get_effective_account_id", { p_user_id: user.id });
    if (!accountId) throw new Error("No account");

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const importId = String(form.get("import_id") || "");
    if (!file) throw new Error("file required");
    if (!importId) throw new Error("import_id required");
    if (file.size > 25 * 1024 * 1024) throw new Error("File too large (25MB max)");

    const { data: imp, error: impErr } = await supabase
      .from("live_contract_imports")
      .select("id, account_id, storage_path")
      .eq("id", importId)
      .maybeSingle();
    if (impErr) throw impErr;
    if (!imp || imp.account_id !== accountId) throw new Error("Contract not found");

    const path = `${accountId}/${crypto.randomUUID()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("live-contracts").upload(path, file, {
      contentType: file.type, upsert: false,
    });
    if (upErr) throw new Error(`Upload: ${upErr.message}`);

    // Best-effort remove old file
    if (imp.storage_path) {
      await supabase.storage.from("live-contracts").remove([imp.storage_path]).catch(() => {});
    }

    const { error: updErr } = await supabase
      .from("live_contract_imports")
      .update({
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        status: "queued",
      })
      .eq("id", importId);
    if (updErr) throw updErr;

    await supabase.from("live_contract_audit_log").insert({
      account_id: accountId, user_id: user.id, import_id: importId,
      event_type: "file_replaced", event_details: { file_name: file.name, size: file.size },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
