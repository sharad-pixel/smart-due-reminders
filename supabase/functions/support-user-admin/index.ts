// Admin-only CRUD for support users.
// Requires the caller to be an authenticated Recouply admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SERVICE);

  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data: isAdmin } = await admin.rpc("is_recouply_admin", {
    _user_id: user.id,
  });
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  let body: any = {};
  try {
    if (req.method !== "GET") body = await req.json();
  } catch {
    body = {};
  }
  const action = body.action ?? new URL(req.url).searchParams.get("action") ?? "list";

  try {
    if (action === "list") {
      const { data, error } = await admin
        .from("support_users")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ users: data });
    }

    if (action === "create") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const name = body.name ? String(body.name).trim() : null;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: "Invalid email" }, 400);
      }

      // Provision a hidden Supabase auth user (random password, confirmed)
      const password = crypto.randomUUID() + crypto.randomUUID();
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, support_user: true },
      });
      let authUserId = created?.user?.id ?? null;

      if (cErr && !/already/i.test(cErr.message)) throw cErr;
      if (!authUserId) {
        // user already existed — find them
        const { data: list } = await admin.auth.admin.listUsers();
        authUserId = list.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
      }
      if (!authUserId) return json({ error: "Could not provision auth user" }, 500);

      // Mark profile as admin + support_user
      await admin
        .from("profiles")
        .upsert({
          id: authUserId,
          email,
          name,
          is_admin: true,
          is_support_user: true,
        }, { onConflict: "id" });

      const { data: row, error: insErr } = await admin
        .from("support_users")
        .upsert(
          {
            email,
            name,
            is_active: true,
            auth_user_id: authUserId,
            created_by: user.id,
          },
          { onConflict: "email" },
        )
        .select()
        .single();
      if (insErr && (insErr as any).code !== "23505") throw insErr;

      return json({ success: true, user: row });
    }

    if (action === "toggle") {
      const id = String(body.id);
      const isActive = Boolean(body.is_active);
      const { error } = await admin
        .from("support_users")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "delete") {
      const id = String(body.id);
      const { data: row } = await admin
        .from("support_users")
        .select("auth_user_id")
        .eq("id", id)
        .maybeSingle();
      if (row?.auth_user_id) {
        await admin
          .from("profiles")
          .update({ is_support_user: false, is_admin: false })
          .eq("id", row.auth_user_id);
      }
      const { error } = await admin.from("support_users").delete().eq("id", id);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "list_assignments") {
      const grantId = String(body.grant_id ?? "");
      if (!grantId) return json({ error: "grant_id required" }, 400);
      const { data, error } = await admin
        .from("support_access_assignments")
        .select("id, support_user_id, assigned_at, notes, support_users(email, name)")
        .eq("grant_id", grantId);
      if (error) throw error;
      return json({ assignments: data });
    }

    if (action === "assign") {
      const grantId = String(body.grant_id ?? "");
      const supportUserId = String(body.support_user_id ?? "");
      const notes = body.notes ? String(body.notes) : null;
      if (!grantId || !supportUserId) return json({ error: "grant_id and support_user_id required" }, 400);
      const { data, error } = await admin
        .from("support_access_assignments")
        .upsert({ grant_id: grantId, support_user_id: supportUserId, assigned_by: user.id, notes },
          { onConflict: "grant_id,support_user_id" })
        .select()
        .single();
      if (error && (error as any).code !== "23505") throw error;

      // Notify the assigned support user with a 6-digit access code + login link
      try {
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        const { data: su } = await admin
          .from("support_users")
          .select("email, name")
          .eq("id", supportUserId)
          .maybeSingle();
        const { data: grant } = await admin
          .from("support_access_grants")
          .select("account_id, scope, expires_at")
          .eq("id", grantId)
          .maybeSingle();

        let companyLabel = "a customer account";
        if (grant?.account_id) {
          const { data: ownerInfo } = await admin.rpc("get_owner_account_info", {
            p_account_id: grant.account_id,
          });
          const p = Array.isArray(ownerInfo) ? ownerInfo[0] : null;
          companyLabel = p?.business_name || p?.company_name || p?.name || p?.email || companyLabel;
        }

        if (su?.email && RESEND_API_KEY) {
          // Generate a 6-digit access code valid 30 minutes
          const code = String(Math.floor(100000 + Math.random() * 900000));
          const enc = new TextEncoder().encode(code);
          const buf = await crypto.subtle.digest("SHA-256", enc);
          const codeHash = Array.from(new Uint8Array(buf))
            .map((b) => b.toString(16).padStart(2, "0")).join("");
          await admin.from("support_login_codes").insert({
            email: su.email.toLowerCase(),
            code_hash: codeHash,
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          });

          const loginUrl = `https://recouply.ai/support/login`;
          const html = `
            <div style="font-family:-apple-system,Segoe UI,Inter,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
              <h2 style="color:#1e293b;margin:0 0 8px">New Support Assignment</h2>
              <p style="color:#475569;margin:0 0 12px">Hi ${su.name || "there"}, you've been assigned to support <strong>${companyLabel}</strong> (${grant?.scope || "read"} access).</p>
              <p style="color:#475569;margin:0 0 8px">Use this access code to sign in (valid 30 minutes):</p>
              <div style="font-size:30px;letter-spacing:6px;font-weight:700;color:#3B82F6;background:#f1f5f9;padding:14px;text-align:center;border-radius:6px">${code}</div>
              <p style="margin:16px 0 0">
                <a href="${loginUrl}" style="background:#3B82F6;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;display:inline-block">Open Support Login</a>
              </p>
              <p style="color:#94a3b8;font-size:12px;margin-top:16px">Grant expires ${grant?.expires_at ? new Date(grant.expires_at).toUTCString() : "soon"}.</p>
            </div>`;
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Recouply Support <notifications@send.inbound.services.recouply.ai>",
              to: [su.email],
              reply_to: "support@recouply.ai",
              subject: `You've been assigned to ${companyLabel} — Code ${code}`,
              html,
            }),
          });
          if (!r.ok) console.error("Assignment email failed", await r.text());
        }
      } catch (e) {
        console.error("Assignment notification error", e);
      }

      return json({ success: true, assignment: data });
    }

    if (action === "unassign") {
      const id = String(body.id ?? "");
      if (!id) return json({ error: "id required" }, 400);
      const { error } = await admin.from("support_access_assignments").delete().eq("id", id);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    console.error("support-user-admin error", e);
    return json({ error: e.message ?? "Server error" }, 500);
  }
});
