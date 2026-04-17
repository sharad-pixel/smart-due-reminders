import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DebtorRow {
  id: string;
  reference_id: string | null;
  company_name: string | null;
  name: string | null;
  current_balance: number | null;
  open_invoices_count: number | null;
  payment_score: number | null;
  payment_risk_tier: string | null;
  user_id: string;
  sales_rep_user_id: string | null;
  sales_rep_name: string | null;
  sales_rep_email: string | null;
}

interface ProfileRow {
  id: string;
  name: string | null;
  email: string | null;
  business_name: string | null;
}

function fmtCurrency(n: number | null): string {
  const v = Number(n || 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function tierColor(tier: string | null): string {
  switch ((tier || "").toLowerCase()) {
    case "low": return "#22c55e";
    case "medium": return "#f59e0b";
    case "high": return "#ef4444";
    case "critical": return "#dc2626";
    default: return "#64748b";
  }
}

function buildEmailHtml(args: {
  repName: string;
  fromBusinessName: string;
  accounts: DebtorRow[];
  mode?: "weekly" | "on_demand";
}): { subject: string; html: string; text: string } {
  const { repName, fromBusinessName, accounts, mode = "weekly" } = args;
  const isOnDemand = mode === "on_demand";
  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const totalInvoices = accounts.reduce((s, a) => s + (a.open_invoices_count || 0), 0);

  const rows = accounts
    .slice()
    .sort((a, b) => Number(b.current_balance || 0) - Number(a.current_balance || 0))
    .map((a) => {
      const name = a.company_name || a.name || "Unnamed Account";
      const tier = a.payment_risk_tier || "—";
      const color = tierColor(a.payment_risk_tier);
      const score = a.payment_score != null ? Math.round(Number(a.payment_score)) : "—";
      return `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#1e293b;">
            <div style="font-weight:600;">${name}</div>
            <div style="font-size:12px;color:#64748b;">${a.reference_id || ""}</div>
          </td>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#1e293b;text-align:right;font-variant-numeric:tabular-nums;">
            ${fmtCurrency(a.current_balance)}
          </td>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#1e293b;text-align:center;">
            ${a.open_invoices_count || 0}
          </td>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;font-size:14px;text-align:center;">
            <span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:${color}20;color:${color};font-weight:600;font-size:12px;">${tier}</span>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">Score ${score}</div>
          </td>
        </tr>`;
    })
    .join("");

  const subjectPrefix = isOnDemand ? "Account Notice" : "Weekly Account Summary";
  const subject = `${subjectPrefix} — ${accounts.length} account${accounts.length === 1 ? "" : "s"}, ${fmtCurrency(totalBalance)} outstanding`;

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:24px 28px;border-bottom:1px solid #e2e8f0;">
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Weekly Account Summary</div>
          <div style="font-size:20px;color:#1e293b;font-weight:600;margin-top:4px;">Hi ${repName},</div>
          <div style="font-size:14px;color:#475569;margin-top:8px;line-height:1.5;">
            Here is your weekly snapshot of accounts you own at <strong>${fromBusinessName}</strong>.
          </div>
        </td></tr>

        <tr><td style="padding:20px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:14px;background:#f1f5f9;border-radius:6px;text-align:center;width:33%;">
                <div style="font-size:11px;color:#64748b;text-transform:uppercase;">Accounts</div>
                <div style="font-size:22px;color:#1e293b;font-weight:700;margin-top:4px;">${accounts.length}</div>
              </td>
              <td style="width:8px;"></td>
              <td style="padding:14px;background:#f1f5f9;border-radius:6px;text-align:center;width:33%;">
                <div style="font-size:11px;color:#64748b;text-transform:uppercase;">Outstanding</div>
                <div style="font-size:22px;color:#3b82f6;font-weight:700;margin-top:4px;">${fmtCurrency(totalBalance)}</div>
              </td>
              <td style="width:8px;"></td>
              <td style="padding:14px;background:#f1f5f9;border-radius:6px;text-align:center;width:33%;">
                <div style="font-size:11px;color:#64748b;text-transform:uppercase;">Open Invoices</div>
                <div style="font-size:22px;color:#1e293b;font-weight:700;margin-top:4px;">${totalInvoices}</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:0 28px 20px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Account</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Balance</th>
                <th style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Open Inv.</th>
                <th style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Health</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </td></tr>

        <tr><td style="padding:0 28px 24px 28px;">
          <a href="https://recouply.ai/debtors" style="display:inline-block;padding:10px 18px;background:#3b82f6;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Open Recouply.ai</a>
        </td></tr>

        <tr><td style="padding:16px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;">
          <div style="font-size:11px;color:#94a3b8;line-height:1.5;">
            You're receiving this weekly summary because you've been listed as the internal account owner on one or more accounts in ${fromBusinessName}'s Recouply.ai workspace. To stop these emails, ask your admin to disable weekly alerts on each account.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = `Hi ${repName},

Weekly snapshot of accounts you own at ${fromBusinessName}:
- ${accounts.length} account(s)
- ${fmtCurrency(totalBalance)} outstanding
- ${totalInvoices} open invoice(s)

${accounts.map((a) => `• ${a.company_name || a.name} — ${fmtCurrency(a.current_balance)} (${a.payment_risk_tier || "—"} risk)`).join("\n")}
`;

  return { subject, html, text };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Optional payload: { debtorId } to send an immediate notice for a single account
    let debtorId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body && typeof body.debtorId === "string") debtorId = body.debtorId;
      } catch (_) {
        // no body, fall back to scheduled mode
      }
    }

    let query = supabase
      .from("debtors")
      .select("id, reference_id, company_name, name, current_balance, open_invoices_count, payment_score, payment_risk_tier, user_id, sales_rep_user_id, sales_rep_name, sales_rep_email");

    if (debtorId) {
      // Immediate single-account notice — require sales_rep_email but ignore alerts toggle
      query = query.eq("id", debtorId).not("sales_rep_email", "is", null);
    } else {
      // Scheduled weekly run — only opted-in accounts
      query = query.eq("sales_rep_alerts_enabled", true).not("sales_rep_email", "is", null);
    }

    const { data: debtors, error } = await query;

    if (error) throw error;

    const all = (debtors || []) as DebtorRow[];
    if (all.length === 0) {
      return new Response(JSON.stringify({ status: "ok", reps_emailed: 0, accounts: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by (user_id of owner, sales_rep_email)
    const groups = new Map<string, DebtorRow[]>();
    for (const d of all) {
      if (!d.sales_rep_email) continue;
      const key = `${d.user_id}::${d.sales_rep_email.toLowerCase().trim()}`;
      const arr = groups.get(key) || [];
      arr.push(d);
      groups.set(key, arr);
    }

    // Fetch business names for the owner profiles
    const ownerIds = Array.from(new Set(all.map((d) => d.user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, email, business_name")
      .in("id", ownerIds);
    const profileMap = new Map<string, ProfileRow>();
    (profiles || []).forEach((p: any) => profileMap.set(p.id, p));

    let emailsSent = 0;
    const errors: string[] = [];

    for (const [key, accounts] of groups.entries()) {
      const [ownerId] = key.split("::");
      const repEmail = accounts[0].sales_rep_email!;
      const repName = accounts[0].sales_rep_name || repEmail.split("@")[0];
      const ownerProfile = profileMap.get(ownerId);
      const fromBusinessName = ownerProfile?.business_name || ownerProfile?.name || "Recouply.ai";

      const { subject, html, text } = buildEmailHtml({
        repName,
        fromBusinessName,
        accounts,
      });

      try {
        const { error: sendErr } = await supabase.functions.invoke("send-email", {
          body: {
            to: repEmail,
            from: "Recouply.ai <notifications@send.inbound.services.recouply.ai>",
            subject,
            html,
            text,
          },
        });
        if (sendErr) throw sendErr;
        emailsSent += 1;
      } catch (err: any) {
        console.error(`Failed to send weekly summary to ${repEmail}:`, err);
        errors.push(`${repEmail}: ${err.message || err}`);
      }
    }

    return new Response(JSON.stringify({
      status: "ok",
      reps_emailed: emailsSent,
      total_groups: groups.size,
      total_accounts: all.length,
      errors,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-rep-weekly-summary error", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
