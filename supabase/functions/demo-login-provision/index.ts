// Provisions (or refreshes) the shared demo auth user and returns credentials
// so the client can sign in. The demo user is granted admin privileges so it
// can call demo-workspace-seed to reset data.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEMO_EMAIL = "demo@recouply.ai";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const password = Deno.env.get("DEMO_USER_PASSWORD");
    if (!password) {
      return new Response(JSON.stringify({ error: "DEMO_USER_PASSWORD not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Find existing user by email
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === DEMO_EMAIL);
    if (existing) {
      userId = existing.id;
      // Ensure password + confirmed
      await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      });
    } else {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password,
        email_confirm: true,
        user_metadata: { full_name: "Demo User", is_demo_account: true },
      });
      if (cErr || !created?.user) {
        return new Response(JSON.stringify({ error: cErr?.message || "create failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = created.user.id;
    }

    // Ensure profile w/ admin so demo can reset seed data
    await admin.from("profiles").upsert(
      { id: userId, email: DEMO_EMAIL, full_name: "Demo User", is_admin: true },
      { onConflict: "id" }
    );

    return new Response(JSON.stringify({ email: DEMO_EMAIL, password }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
