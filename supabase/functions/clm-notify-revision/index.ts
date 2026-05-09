import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_BASE = "https://recouply.ai";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Drain up to 25 pending notifications
    const { data: queue } = await admin
      .from("clm_notification_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(25);

    let processed = 0;
    for (const job of queue ?? []) {
      try {
        await processJob(admin, job);
        await admin.from("clm_notification_queue").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts: (job.attempts ?? 0) + 1,
        }).eq("id", job.id);
        processed++;
      } catch (e: any) {
        console.error("[clm-notify-revision] job failed", job.id, e?.message);
        await admin.from("clm_notification_queue").update({
          status: (job.attempts ?? 0) + 1 >= 3 ? "failed" : "pending",
          attempts: (job.attempts ?? 0) + 1,
          last_error: String(e?.message ?? e).slice(0, 500),
        }).eq("id", job.id);
      }
    }

    return new Response(JSON.stringify({ success: true, processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[clm-notify-revision] error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processJob(admin: any, job: any) {
  // Lookup workspace name + account_id
  const { data: inst } = await admin
    .from("clm_template_instances")
    .select("id, name, account_id")
    .eq("id", job.instance_id)
    .maybeSingle();
  const workspaceName = inst?.name || "your contract workspace";

  // Determine if recipient is an internal user (profile exists for that email & is on the account)
  // Otherwise, treat as external — fetch or mint a portal token.
  const recipientEmail = String(job.recipient_email).toLowerCase();
  let link = `${APP_BASE}/contracts/${job.instance_id}`;
  let internal = false;
  try {
    const { data: prof } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", recipientEmail)
      .maybeSingle();
    if (prof?.id) {
      const { data: link1 } = await admin
        .from("account_users")
        .select("id")
        .eq("user_id", prof.id)
        .eq("status", "active")
        .maybeSingle();
      if (link1 || prof.id === inst?.account_id) internal = true;
    }
  } catch (_) { /* ignore */ }

  if (!internal) {
    // Find or create portal access for this email + instance
    let { data: access } = await admin
      .from("clm_external_access")
      .select("token")
      .ilike("email", recipientEmail)
      .eq("instance_id", job.instance_id)
      .is("revoked_at", null)
      .gte("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!access?.token && inst) {
      const { data: created } = await admin
        .from("clm_external_access")
        .insert({
          instance_id: job.instance_id,
          account_id: inst.account_id,
          email: recipientEmail,
          name: job.recipient_name || null,
          role: (job.event_type === "assigned" || job.event_type === "batch_assigned") ? "approver" : "reviewer",
          expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
        })
        .select("token")
        .single();
      access = created;
    }
    if (access?.token) link = `${APP_BASE}/clm-portal?token=${access.token}`;
  }

  const { subject, html } = buildEmail(job, workspaceName, link);

  const { error } = await admin.functions.invoke("send-email", {
    body: {
      to: recipientEmail,
      from: "Recouply CLM <notifications@send.inbound.services.recouply.ai>",
      subject,
      html,
    },
  });
  if (error) throw new Error(error.message || "send-email failed");

  // Mark notified_at on the revision (assignment only)
  if (job.event_type === "assigned") {
    await admin.from("clm_section_revisions")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", job.revision_id);
  }
}

function buildEmail(job: any, workspaceName: string, link: string) {
  const p = job.payload || {};
  const sectionTitle = p.section_title || p.section_key || "a section";
  const cta = (label: string) => `
    <div style="text-align:center;margin:24px 0;">
      <a href="${link}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;">${label}</a>
    </div>`;

  if (job.event_type === "assigned") {
    return {
      subject: `Review requested: ${sectionTitle} — ${workspaceName}`,
      html: wrap(`
        <p style="margin:0 0 12px;">${esc(p.edited_by_name || "A collaborator")} proposed changes to <strong>${esc(sectionTitle)}</strong> in <strong>${esc(workspaceName)}</strong> and assigned you as the approver.</p>
        ${p.change_summary ? `<p style="margin:0 0 12px;color:#475569;font-style:italic;">"${esc(p.change_summary)}"</p>` : ""}
        <p style="margin:0 0 12px;color:#475569;">Open the workspace to review the diff and approve or request changes.</p>
        ${cta("Review amendment")}`,
        "Amendment ready for your review"),
    };
  }

  if (job.event_type === "batch_assigned") {
    const sections = Array.isArray(p.sections) ? p.sections : [];
    const list = sections.slice(0, 12).map((s: any) =>
      `<li style="margin:4px 0;"><strong>${esc(s.section_title || s.section_key || "Section")}</strong>${s.change_summary ? ` — <span style="color:#475569;">${esc(s.change_summary)}</span>` : ""} <span style="color:#94a3b8;font-family:monospace;font-size:11px;">v${s.version_number ?? ""}</span></li>`
    ).join("");
    const more = sections.length > 12 ? `<p style="margin:4px 0;color:#64748b;font-size:12px;">+ ${sections.length - 12} more change${sections.length - 12 === 1 ? "" : "s"}…</p>` : "";
    return {
      subject: `Review requested: ${p.revision_count} change${p.revision_count === 1 ? "" : "s"} — ${workspaceName}`,
      html: wrap(`
        <p style="margin:0 0 12px;"><strong>${esc(p.submitted_by_name || p.submitted_by_email || "A collaborator")}</strong> finished an editing session in <strong>${esc(workspaceName)}</strong> and submitted <strong>${p.revision_count}</strong> change${p.revision_count === 1 ? "" : "s"} for your review.</p>
        ${p.message ? `<div style="margin:0 0 12px;padding:10px 12px;background:#f1f5f9;border-left:3px solid #3b82f6;color:#334155;font-style:italic;">"${esc(p.message)}"</div>` : ""}
        <p style="margin:12px 0 6px;color:#0f172a;font-weight:600;">Sections changed:</p>
        <ul style="margin:0 0 12px;padding-left:20px;color:#0f172a;font-size:13px;">${list}</ul>
        ${more}
        ${cta("Review all changes")}`,
        "Amendments ready for your review"),
    };
  }

  if (job.event_type === "approved") {
    return {
      subject: `Approved: ${sectionTitle} — ${workspaceName}`,
      html: wrap(`
        <p style="margin:0 0 12px;"><strong>${esc(p.reviewer_name || "The reviewer")}</strong> approved your changes to <strong>${esc(sectionTitle)}</strong> in <strong>${esc(workspaceName)}</strong>.</p>
        <p style="margin:0 0 12px;color:#475569;">The new version is now live.</p>
        ${cta("Open workspace")}`,
        "Your amendment was approved"),
    };
  }

  // rejected
  return {
    subject: `Changes requested: ${sectionTitle} — ${workspaceName}`,
    html: wrap(`
      <p style="margin:0 0 12px;"><strong>${esc(p.reviewer_name || "The reviewer")}</strong> requested changes to <strong>${esc(sectionTitle)}</strong> in <strong>${esc(workspaceName)}</strong>.</p>
      ${p.review_note ? `<p style="margin:0 0 12px;color:#475569;font-style:italic;">"${esc(p.review_note)}"</p>` : ""}
      <p style="margin:0 0 12px;color:#475569;">Open the workspace to revise and resubmit.</p>
      ${cta("Revise & resubmit")}`,
      "Changes requested on your amendment"),
  };
}

function wrap(inner: string, header: string) {
  return `
  <!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#ffffff;margin:0;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#1e293b;color:#fff;padding:24px;">
        <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.7;">Recouply CLM</div>
        <div style="font-size:20px;font-weight:600;margin-top:4px;">${esc(header)}</div>
      </div>
      <div style="padding:28px;color:#1e293b;line-height:1.6;font-size:15px;">${inner}</div>
      <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px;text-align:center;font-size:11px;color:#94a3b8;">Powered by Recouply.ai</div>
    </div>
  </body></html>`;
}

function esc(s: any) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
