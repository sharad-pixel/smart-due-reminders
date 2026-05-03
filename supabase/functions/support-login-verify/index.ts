// Step 2 of 2: support user submits email + 6-digit code.
// On success, mint a magic-link via Supabase admin and return action_link
// for the client to consume with supabase.auth.exchangeCodeForSession or by
// navigating to it (we use generateLink which returns an embedded token).
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

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "Invalid body" }, 400); }
  const email = String(body.email ?? "").trim().toLowerCase();
  const code = String(body.code ?? "").trim();
  const redirectTo = String(body.redirectTo ?? "https://recouply.ai/admin/support-access");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Invalid email" }, 400);
  if (!/^\d{6}$/.test(code)) return json({ error: "Invalid code format" }, 400);

  // Confirm support user OR Recouply admin
  const { data: su } = await admin
    .from("support_users")
    .select("id, auth_user_id, is_active")
    .ilike("email", email)
    .maybeSingle();

  let authUserId: string | null = su?.is_active ? su.auth_user_id : null;
  let supportUserRow: any = su?.is_active ? su : null;

  if (!supportUserRow) {
    const { data: prof } = await admin
      .from("profiles")
      .select("id, is_admin")
      .ilike("email", email)
      .maybeSingle();
    if (prof?.is_admin) {
      authUserId = prof.id;
    } else {
      return json({ error: "Invalid email or code" }, 401);
    }
  }

  // Latest unused, non-expired code for this email
  const { data: row } = await admin
    .from("support_login_codes")
    .select("id, code_hash, expires_at, used_at, attempts")
    .ilike("email", email)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return json({ error: "Code expired or not found. Request a new one." }, 401);

  if (row.attempts >= 5) {
    await admin.from("support_login_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
    return json({ error: "Too many attempts. Request a new code." }, 429);
  }

  const submitted = await sha256Hex(code);
  if (submitted !== row.code_hash) {
    await admin.from("support_login_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
    return json({ error: "Invalid code" }, 401);
  }

  // Burn the code
  await admin.from("support_login_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);

  // Generate a magic link the client can use to establish a session
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });
  if (linkErr || !link?.properties?.action_link) {
    console.error("generateLink error", linkErr);
    return json({ error: "Could not issue session link" }, 500);
  }

  await admin.from("support_users").update({ last_login_at: new Date().toISOString() }).eq("id", su.id);

  // Audit
  try {
    await admin.from("audit_logs").insert({
      user_id: su.auth_user_id,
      action_type: "login",
      resource_type: "settings",
      metadata: { kind: "support_user_login", email },
    });
  } catch { /* ignore */ }

  return json({
    success: true,
    action_link: link.properties.action_link,
  });
});
