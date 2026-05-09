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
    if (!file) throw new Error("file required");
    if (file.size > 25 * 1024 * 1024) throw new Error("File too large (25MB max)");

    const path = `${accountId}/${crypto.randomUUID()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("live-contracts").upload(path, file, {
      contentType: file.type, upsert: false,
    });
    if (upErr) throw new Error(`Upload: ${upErr.message}`);

    const { data: imp, error: insErr } = await supabase.from("live_contract_imports").insert({
      account_id: accountId,
      user_id: user.id,
      source: "upload",
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      status: "queued",
    }).select().single();
    if (insErr) throw insErr;

    await supabase.from("live_contract_audit_log").insert({
      account_id: accountId, user_id: user.id, import_id: imp.id,
      event_type: "file_uploaded", event_details: { file_name: file.name, size: file.size },
    });

    return new Response(JSON.stringify({ success: true, import: imp }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
