// Verifies an authenticated user is on the support access list (or admin)
// AND that their email is on the recouply.ai domain. Returns { allowed, redirectTo }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Missing auth" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);

  const email = (userData.user.email ?? "").toLowerCase();
  if (!email.endsWith("@recouply.ai")) {
    return json({ allowed: false, reason: "domain_not_allowed" }, 403);
  }

  const admin = createClient(SUPABASE_URL, SERVICE);

  // Must be in support_users (active) OR an admin profile
  const { data: su } = await admin
    .from("support_users")
    .select("id, is_active")
    .ilike("email", email)
    .maybeSingle();

  let allowed = !!su?.is_active;
  let kind = "support_user";
  if (!allowed) {
    const { data: prof } = await admin
      .from("profiles")
      .select("id, is_admin")
      .ilike("email", email)
      .maybeSingle();
    if (prof?.is_admin) { allowed = true; kind = "admin"; }
  }

  if (!allowed) {
    return json({ allowed: false, reason: "not_on_support_list" }, 403);
  }

  // Update last login + audit
  if (kind === "support_user" && su) {
    await admin.from("support_users").update({ last_login_at: new Date().toISOString() }).eq("id", su.id);
  }
  try {
    await admin.from("audit_logs").insert({
      user_id: userData.user.id,
      action_type: "login",
      resource_type: "settings",
      metadata: { kind: kind === "admin" ? "admin_login" : "support_user_login", method: "google_oauth", email },
    });
  } catch { /* ignore */ }

  return json({ allowed: true, kind });
});
