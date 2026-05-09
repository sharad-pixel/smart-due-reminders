import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PORTAL_BASE = "https://recouply.ai/clm-portal";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const action = body.action as "request_link" | "access" | "act";

    // ----- 1. Email-driven magic link discovery -----
    if (action === "request_link") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: "Valid email required" }, 400);
      }

      // Rate limit: 5 requests / 15 min
      await admin.rpc("check_action_rate_limit", {
        p_identifier: email,
        p_action_type: "clm_portal_link",
        p_max_requests: 5,
        p_window_minutes: 15,
        p_block_duration_minutes: 30,
      });

      const { data: rows } = await admin
        .from("clm_external_access")
        .select("token, instance_id, role, expires_at, revoked_at, clm_template_instances(name)")
        .ilike("email", email)
        .is("revoked_at", null)
        .gte("expires_at", new Date().toISOString());

      // Always return success regardless to prevent enumeration
      if (rows && rows.length > 0) {
        // Send one consolidated email listing all accessible workspaces with one token (the most recent)
        const newest = rows[0];
        const list = rows
          .map((r: any) => `<li style="margin:6px 0;"><strong>${escapeHtml(r.clm_template_instances?.name || "Workspace")}</strong> &mdash; ${escapeHtml(r.role)}</li>`)
          .join("");
        const url = `${PORTAL_BASE}?token=${newest.token}`;
        const html = `
        <!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8fafc;margin:0;padding:24px;">
          <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <div style="background:#1e293b;color:#fff;padding:24px;">
              <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.7;">Recouply CLM</div>
              <div style="font-size:20px;font-weight:600;margin-top:4px;">Your secure portal access</div>
            </div>
            <div style="padding:28px;color:#1e293b;line-height:1.6;font-size:15px;">
              <p style="margin:0 0 8px;">You requested access to your contract workspaces:</p>
              <ul style="margin:0 0 20px 18px;padding:0;color:#334155;">${list}</ul>
              <div style="text-align:center;margin:24px 0;">
                <a href="${url}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;">Open CLM Portal</a>
              </div>
              <div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:12px;font-size:12px;color:#64748b;">
                🔒 Secure single-purpose link. Expires automatically. If you didn't request this, ignore the email.
              </div>
            </div>
          </div>
        </body></html>`;

        await admin.functions.invoke("send-email", {
          body: {
            to: email,
            from: "Recouply CLM <notifications@send.inbound.services.recouply.ai>",
            subject: "Your Recouply CLM portal link",
            html,
          },
        });
      }

      return json({ success: true, message: "If this email has access, a link is on the way." });
    }

    // ----- 2. Token → workspaces & tasks -----
    if (action === "access") {
      const token = String(body.token || "");
      if (!token) return json({ error: "Token required" }, 400);

      const { data: access } = await admin
        .from("clm_external_access")
        .select("*")
        .eq("token", token)
        .is("revoked_at", null)
        .gte("expires_at", new Date().toISOString())
        .maybeSingle();
      if (!access) return json({ error: "Invalid or expired token" }, 401);

      // Get all workspaces this email has access to (across multiple invites)
      const { data: allAccess } = await admin
        .from("clm_external_access")
        .select("id, instance_id, role, expires_at")
        .ilike("email", access.email)
        .is("revoked_at", null)
        .gte("expires_at", new Date().toISOString());

      const ids = (allAccess ?? []).map((a) => a.instance_id);
      const { data: instances } = ids.length
        ? await admin
            .from("clm_template_instances")
            .select("id, name, status, created_at, account_id, template_name_snapshot")
            .in("id", ids)
        : { data: [] as any[] };

      const { data: sections } = ids.length
        ? await admin
            .from("clm_instance_sections")
            .select("id, instance_id, section_key, title, body, ai_summary, order_index")
            .in("instance_id", ids)
            .order("order_index")
        : { data: [] as any[] };

      const { data: revisions } = ids.length
        ? await admin
            .from("clm_section_revisions")
            .select("*")
            .in("instance_id", ids)
            .order("created_at", { ascending: false })
        : { data: [] as any[] };

      const { data: comments } = ids.length
        ? await admin
            .from("clm_section_comments")
            .select("*")
            .in("instance_id", ids)
            .order("created_at")
        : { data: [] as any[] };

      // Mark this token used
      await admin.from("clm_external_access").update({ last_used_at: new Date().toISOString() }).eq("id", access.id);

      // Tasks = pending revisions assigned to this email
      const myEmail = access.email.toLowerCase();
      const tasks = (revisions ?? []).filter(
        (r: any) =>
          r.approval_status === "pending" &&
          (r.assigned_approver_email || "").toLowerCase() === myEmail,
      );

      return json({
        success: true,
        identity: { email: access.email, name: access.name, role: access.role, expires_at: access.expires_at },
        workspaces: instances ?? [],
        accessByInstance: allAccess ?? [],
        sections: sections ?? [],
        revisions: revisions ?? [],
        comments: comments ?? [],
        tasks,
      });
    }

    // ----- 3. Portal-side actions -----
    if (action === "act") {
      const { token, kind } = body;
      if (!token) return json({ error: "Token required" }, 400);
      const { data: access } = await admin
        .from("clm_external_access")
        .select("*")
        .eq("token", token)
        .is("revoked_at", null)
        .gte("expires_at", new Date().toISOString())
        .maybeSingle();
      if (!access) return json({ error: "Invalid or expired token" }, 401);

      if (kind === "comment") {
        const { instance_id, section_key, message } = body;
        if (!instance_id || !section_key || !message?.trim()) return json({ error: "Missing fields" }, 400);
        // verify access for this instance/email
        const { data: hasAccess } = await admin
          .from("clm_external_access")
          .select("id")
          .ilike("email", access.email)
          .eq("instance_id", instance_id)
          .is("revoked_at", null)
          .gte("expires_at", new Date().toISOString())
          .maybeSingle();
        if (!hasAccess) return json({ error: "No access to this workspace" }, 403);

        const { error } = await admin.from("clm_section_comments").insert({
          instance_id,
          section_key,
          body: `[${access.name || access.email}] ${message.trim()}`,
        });
        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
      }

      if (kind === "review") {
        const { revision_id, decision, note } = body;
        if (!["approved", "rejected"].includes(decision)) return json({ error: "Invalid decision" }, 400);
        const { data: rev } = await admin
          .from("clm_section_revisions")
          .select("*")
          .eq("id", revision_id)
          .maybeSingle();
        if (!rev) return json({ error: "Revision not found" }, 404);
        if ((rev.assigned_approver_email || "").toLowerCase() !== access.email.toLowerCase()) {
          return json({ error: "Not assigned to you" }, 403);
        }
        if (access.role !== "approver" && access.role !== "signer") {
          return json({ error: "Approver role required" }, 403);
        }
        await admin
          .from("clm_section_revisions")
          .update({
            approval_status: decision,
            reviewed_by_name: access.name || access.email,
            reviewed_at: new Date().toISOString(),
            review_note: note || null,
          })
          .eq("id", revision_id);

        if (decision === "rejected" && rev.section_id) {
          await admin
            .from("clm_instance_sections")
            .update({ body: rev.previous_body })
            .eq("id", rev.section_id);
        }
        return json({ success: true });
      }

      return json({ error: "Unknown kind" }, 400);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    console.error("[clm-external-portal] error", e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
