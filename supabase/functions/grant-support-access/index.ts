import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const body = await req.json();
    const durationHours = Math.min(Math.max(Number(body.durationHours) || 168, 1), 720); // 1h–30d
    const scope = body.scope === "write" ? "write" : "read";
    const reason: string | null = (body.reason || "").toString().slice(0, 500) || null;

    // Determine account: owner = self, admins/members will scope to their parent account
    const { data: membership } = await supabase
      .from("account_users")
      .select("account_id, role, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("is_owner", { ascending: false })
      .limit(1)
      .maybeSingle();

    const accountId = membership?.account_id || user.id;

    // Permission check (owner/admin only)
    if (accountId !== user.id) {
      if (!membership || !["owner", "admin"].includes(membership.role)) {
        return new Response(
          JSON.stringify({ error: "Only owners or admins can grant support access" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();

    const { data: grant, error: grantErr } = await supabase
      .from("support_access_grants")
      .insert({
        account_id: accountId,
        granted_by: user.id,
        scope,
        reason,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (grantErr) throw grantErr;

    // Get owner profile for email context
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email, company_name, business_name")
      .eq("id", accountId)
      .maybeSingle();

    // Email support team
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      try {
        const resend = new Resend(resendKey);
        const company = profile?.business_name || profile?.company_name || profile?.name || "Customer";
        const supportPath = `/admin/support-access?account=${accountId}&open=1`;
        const supportUrl = `https://recouply.ai/support/login?next=${encodeURIComponent(supportPath)}`;
        await resend.emails.send({
          from: "Recouply.ai <notifications@send.inbound.services.recouply.ai>",
          to: ["support@recouply.ai"],
          subject: `Support access granted: ${company}`,
          html: `
            <div style="font-family: system-ui, -apple-system, sans-serif; max-width:600px; margin:0 auto; color:#1e293b;">
              <h2 style="color:#3b82f6; border-bottom:1px solid #e2e8f0; padding-bottom:12px;">Support Access Granted</h2>
              <p><strong>${company}</strong> has authorized the Recouply support team to access their workspace.</p>
              <table style="width:100%; border-collapse:collapse; margin:20px 0;">
                <tr><td style="padding:8px; border-bottom:1px solid #e2e8f0;"><strong>Account</strong></td><td style="padding:8px; border-bottom:1px solid #e2e8f0;">${profile?.email || accountId}</td></tr>
                <tr><td style="padding:8px; border-bottom:1px solid #e2e8f0;"><strong>Granted by</strong></td><td style="padding:8px; border-bottom:1px solid #e2e8f0;">${user.email || user.id}</td></tr>
                <tr><td style="padding:8px; border-bottom:1px solid #e2e8f0;"><strong>Scope</strong></td><td style="padding:8px; border-bottom:1px solid #e2e8f0;">${scope === "write" ? "Full access (read + write)" : "View only"}</td></tr>
                <tr><td style="padding:8px; border-bottom:1px solid #e2e8f0;"><strong>Expires</strong></td><td style="padding:8px; border-bottom:1px solid #e2e8f0;">${new Date(expiresAt).toUTCString()}</td></tr>
                ${reason ? `<tr><td style="padding:8px; border-bottom:1px solid #e2e8f0;"><strong>Reason</strong></td><td style="padding:8px; border-bottom:1px solid #e2e8f0;">${reason}</td></tr>` : ""}
              </table>
              <a href="${supportUrl}" style="display:inline-block; background:#3b82f6; color:#fff; padding:10px 18px; border-radius:6px; text-decoration:none;">Open Customer Workspace</a>
              <p style="margin-top:12px; font-size:12px; color:#64748b;">Clicking the button signs you into the customer's workspace as Recouply Support. All actions are logged.</p>
            </div>`,
        });
      } catch (e) {
        console.error("Email failed", e);
      }
    }

    // Audit log
    await supabase.from("admin_user_actions").insert({
      admin_id: user.id,
      target_user_id: accountId,
      action: "support_access_granted",
      action_type: "support_access",
      details: { grant_id: grant.id, scope, expires_at: expiresAt, reason },
    });

    return new Response(JSON.stringify({ success: true, grant }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("grant-support-access error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
