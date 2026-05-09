import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PORTAL_BASE = "https://recouply.ai/clm-portal";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const action = body.action as "invite" | "renew" | "revoke";

    if (action === "invite") {
      const { instance_id, email, name, role, expires_in_days, expires_in_hours } = body;
      const trimmed = (email || "").trim().toLowerCase();
      if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return json({ error: "Valid email required" }, 400);
      if (!instance_id) return json({ error: "instance_id required" }, 400);

      // load instance to get account_id and verify
      const { data: inst } = await admin
        .from("clm_template_instances")
        .select("id, name, account_id")
        .eq("id", instance_id)
        .maybeSingle();
      if (!inst) return json({ error: "Workspace not found" }, 404);

      // permission check: caller must be able to write as that account
      const { data: canWrite } = await admin.rpc("can_write_as_account", {
        p_user_id: userId,
        p_account_id: inst.account_id,
      });
      if (!canWrite) return json({ error: "Forbidden" }, 403);

      // attached debtor (optional)
      const { data: linked } = await admin
        .from("clm_instance_debtors")
        .select("debtor_id")
        .eq("instance_id", instance_id)
        .limit(1)
        .maybeSingle();

      const expiresAt = computeExpiresAt(expires_in_hours, expires_in_days);

      const { data: row, error: insErr } = await admin
        .from("clm_external_access")
        .insert({
          instance_id,
          account_id: inst.account_id,
          debtor_id: linked?.debtor_id ?? null,
          email: trimmed,
          name: name || null,
          role: role || "reviewer",
          expires_at: expiresAt,
          created_by: userId,
        })
        .select()
        .single();
      if (insErr) return json({ error: insErr.message }, 500);

      await sendPortalEmail(admin, { email: trimmed, token: row.token, workspaceName: inst.name, role: row.role });
      return json({ success: true, access: row });
    }

    if (action === "renew") {
      const { id, expires_in_days } = body;
      if (!id) return json({ error: "id required" }, 400);
      const { data: existing } = await admin
        .from("clm_external_access")
        .select("*, clm_template_instances(name)")
        .eq("id", id)
        .maybeSingle();
      if (!existing) return json({ error: "Not found" }, 404);
      const { data: canWrite } = await admin.rpc("can_write_as_account", {
        p_user_id: userId,
        p_account_id: existing.account_id,
      });
      if (!canWrite) return json({ error: "Forbidden" }, 403);

      const days = Math.min(Math.max(parseInt(String(expires_in_days || "30"), 10) || 30, 1), 365);
      const newToken = crypto.randomUUID();
      const { data: updated, error: updErr } = await admin
        .from("clm_external_access")
        .update({
          token: newToken,
          expires_at: new Date(Date.now() + days * 86400_000).toISOString(),
          revoked_at: null,
          last_used_at: null,
        })
        .eq("id", id)
        .select()
        .single();
      if (updErr) return json({ error: updErr.message }, 500);

      await sendPortalEmail(admin, {
        email: existing.email,
        token: newToken,
        workspaceName: (existing as any).clm_template_instances?.name || "your workspace",
        role: existing.role,
      });
      return json({ success: true, access: updated });
    }

    if (action === "revoke") {
      const { id } = body;
      if (!id) return json({ error: "id required" }, 400);
      const { data: existing } = await admin
        .from("clm_external_access")
        .select("account_id")
        .eq("id", id)
        .maybeSingle();
      if (!existing) return json({ error: "Not found" }, 404);
      const { data: canWrite } = await admin.rpc("can_write_as_account", {
        p_user_id: userId,
        p_account_id: existing.account_id,
      });
      if (!canWrite) return json({ error: "Forbidden" }, 403);

      await admin.from("clm_external_access").update({ revoked_at: new Date().toISOString() }).eq("id", id);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    console.error("[clm-invite-external] error", e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendPortalEmail(
  admin: ReturnType<typeof createClient>,
  opts: { email: string; token: string; workspaceName: string; role: string },
) {
  const url = `${PORTAL_BASE}?token=${opts.token}`;
  const html = `
  <!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8fafc;margin:0;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#1e293b;color:#fff;padding:24px;">
        <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.7;">Recouply CLM</div>
        <div style="font-size:20px;font-weight:600;margin-top:4px;">You've been invited to collaborate</div>
      </div>
      <div style="padding:28px;color:#1e293b;line-height:1.6;font-size:15px;">
        <p style="margin:0 0 12px;">You've been added as a <strong>${escapeHtml(opts.role)}</strong> on the contract workspace <strong>${escapeHtml(opts.workspaceName)}</strong>.</p>
        <p style="margin:0 0 24px;color:#475569;">Use the secure link below to view assigned sections, comment, and approve changes. The link is unique to you and expires automatically.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${url}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;">Open CLM Portal</a>
        </div>
        <div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:12px;font-size:12px;color:#64748b;">
          🔒 Secure single-purpose link. If you didn't expect this, ignore the email.
        </div>
      </div>
      <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px;text-align:center;font-size:11px;color:#94a3b8;">Powered by Recouply.ai</div>
    </div>
  </body></html>`;

  const { error } = await admin.functions.invoke("send-email", {
    body: {
      to: opts.email,
      from: "Recouply CLM <notifications@send.inbound.services.recouply.ai>",
      subject: `Contract collaboration invite — ${opts.workspaceName}`,
      html,
    },
  });
  if (error) console.error("[clm-invite-external] email send error", error);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
