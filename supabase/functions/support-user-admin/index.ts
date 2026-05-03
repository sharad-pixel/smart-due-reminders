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
        .update({ is_admin: true, is_support_user: true, name: name ?? undefined })
        .eq("id", authUserId);

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

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    console.error("support-user-admin error", e);
    return json({ error: e.message ?? "Server error" }, 500);
  }
});
