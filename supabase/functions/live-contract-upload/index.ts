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
    const debtorIdRaw = form.get("debtor_id");
    const debtorId = typeof debtorIdRaw === "string" && debtorIdRaw.length > 0 ? debtorIdRaw : null;
    const contractTypeRaw = form.get("contract_type");
    const contractType = typeof contractTypeRaw === "string" && contractTypeRaw.trim().length > 0 ? contractTypeRaw.trim() : null;
    if (!file) throw new Error("file required");
    if (!contractType) throw new Error("contract_type required");
    if (file.size > 25 * 1024 * 1024) throw new Error("File too large (25MB max)");

    // Verify debtor belongs to this account if provided
    if (debtorId) {
      const { data: d } = await supabase.from("debtors").select("id, account_id").eq("id", debtorId).maybeSingle();
      if (!d || d.account_id !== accountId) throw new Error("Invalid debtor");
    }

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
      debtor_id: debtorId,
      contract_type: contractType,
    }).select().single();
    if (insErr) throw insErr;

    await supabase.from("live_contract_audit_log").insert({
      account_id: accountId, user_id: user.id, import_id: imp.id,
      event_type: "file_uploaded", event_details: { file_name: file.name, size: file.size },
    });

    const extraction = fetch(`${supabaseUrl}/functions/v1/live-contract-extract`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ importId: imp.id }),
    }).then(async (res) => {
      if (!res.ok) console.error(`[LC-UPLOAD] extraction trigger failed ${res.status}: ${await res.text()}`);
    }).catch((e) => console.error("[LC-UPLOAD] extraction trigger error", e));

    const edgeRuntime = (globalThis as any).EdgeRuntime;
    if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(extraction);

    return new Response(JSON.stringify({ success: true, import: imp }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
