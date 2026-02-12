import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to_email, to_name, sender_name, inputs, results, gptResult, share_type, lead_info } = await req.json();

    if (!to_email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formatCurrency = (v: number) => `$${Math.round(v).toLocaleString()}`;
    const formatPercent = (v: number) => `${(v * 100).toFixed(1)}%`;
    const formatROI = (v: number) => (v > 10 ? "10x+" : `${v.toFixed(1)}x`);

    const riskColor: Record<string, string> = {
      Low: "#22c55e",
      Medium: "#eab308",
      High: "#f97316",
      Critical: "#ef4444",
    };

    const tierColor = riskColor[gptResult.risk_tier] || "#eab308";

    const isLeadAlert = share_type === "new_lead_alert";
    const isShareWithBoss = share_type === "boss";

    let subjectLine: string;
    let introText: string;

    if (isLeadAlert) {
      subjectLine = `🔔 New Assessment Lead: ${lead_info?.name || "Unknown"} (${lead_info?.email || "no email"})`;
      introText = `<p style="color:#64748b;font-size:15px;"><strong>New lead from Collections Assessment:</strong><br/>Name: ${lead_info?.name || "N/A"}<br/>Email: ${lead_info?.email || "N/A"}<br/>Company: ${lead_info?.company || "N/A"}</p>`;
    } else if (isShareWithBoss) {
      subjectLine = `${sender_name || "A colleague"} shared a Collections Assessment with you`;
      introText = `<p style="color:#64748b;font-size:15px;">${sender_name || "A colleague"} thought you'd find this assessment valuable. It estimates the cost of overdue invoices and the potential ROI of automating collections.</p>`;
    } else if (share_type === "team") {
      subjectLine = `${sender_name || "A team member"} shared a Collections Assessment with you`;
      introText = `<p style="color:#64748b;font-size:15px;">${sender_name || "A team member"} shared this collections risk and ROI assessment with you. Review the findings below to understand the financial impact of overdue invoices.</p>`;
    } else {
      subjectLine = "Your Collections Risk & ROI Assessment — Recouply.ai";
      introText = `<p style="color:#64748b;font-size:15px;">Here's a summary of your collections assessment results. We've saved a copy for your records.</p>`;
    }
    const actionsHtml = (gptResult.recommended_actions || [])
      .map((a: any) => `<li style="margin-bottom:8px;"><strong>${a.title}</strong> — ${a.why} <em>(${a.time_to_do})</em></li>`)
      .join("");

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="color:#1e293b;font-size:22px;margin:0 0 8px;">Collections Risk & ROI Assessment</h1>
      <span style="display:inline-block;padding:4px 16px;border-radius:99px;font-size:13px;font-weight:600;color:${tierColor};background:${tierColor}15;border:1px solid ${tierColor}40;">${gptResult.risk_tier} Risk</span>
    </div>

    ${introText}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td width="50%" style="padding:8px;">
          <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
            <p style="color:#3b82f6;font-size:12px;font-weight:600;margin:0 0 4px;">RECOUPLY COST</p>
            <p style="font-size:24px;font-weight:700;color:#1e293b;margin:0;">${formatCurrency(results.recouply_cost)}</p>
            <p style="color:#94a3b8;font-size:12px;margin:4px 0 0;">${inputs.overdue_count} invoices × $1.99</p>
          </div>
        </td>
        <td width="50%" style="padding:8px;">
          <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
            <p style="color:#f97316;font-size:12px;font-weight:600;margin:0 0 4px;">COST OF DELAY</p>
            <p style="font-size:24px;font-weight:700;color:#1e293b;margin:0;">${formatCurrency(results.delay_cost)}</p>
            <p style="color:#94a3b8;font-size:12px;margin:4px 0 0;">${inputs.annual_rate}% APR × ~${results.delay_months} months</p>
          </div>
        </td>
      </tr>
      <tr>
        <td width="50%" style="padding:8px;">
          <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
            <p style="color:#ef4444;font-size:12px;font-weight:600;margin:0 0 4px;">AT-RISK AMOUNT</p>
            <p style="font-size:24px;font-weight:700;color:#1e293b;margin:0;">${formatCurrency(results.loss_risk_cost)}</p>
            <p style="color:#94a3b8;font-size:12px;margin:4px 0 0;">Based on write-off estimate</p>
          </div>
        </td>
        <td width="50%" style="padding:8px;">
          <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
            <p style="color:#22c55e;font-size:12px;font-weight:600;margin:0 0 4px;">BREAKEVEN</p>
            <p style="font-size:24px;font-weight:700;color:#1e293b;margin:0;">${formatCurrency(results.breakeven_recovery)}</p>
            <p style="color:#94a3b8;font-size:12px;margin:4px 0 0;">≈ ${formatPercent(results.breakeven_pct)} of overdue balance</p>
          </div>
        </td>
      </tr>
    </table>

    <div style="background:linear-gradient(135deg,#3b82f610,#22c55e10);border:1px solid #3b82f630;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <p style="color:#64748b;font-size:13px;margin:0 0 4px;">Estimated ROI</p>
      <p style="font-size:36px;font-weight:700;color:#3b82f6;margin:0;">${formatROI(results.roi_multiple)}</p>
      <p style="color:#64748b;font-size:13px;margin:4px 0 0;">Total impact: ${formatCurrency(results.total_impact)} vs cost of ${formatCurrency(results.recouply_cost)}</p>
    </div>

    <div style="margin-bottom:24px;">
      <h3 style="color:#1e293b;font-size:16px;margin:0 0 8px;">Risk Summary</h3>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 8px;">${gptResult.risk_summary}</p>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0;">${gptResult.value_summary}</p>
    </div>

    ${actionsHtml ? `
    <div style="margin-bottom:24px;">
      <h3 style="color:#1e293b;font-size:16px;margin:0 0 8px;">Recommended Next Steps</h3>
      <ul style="color:#475569;font-size:14px;line-height:1.6;padding-left:20px;margin:0;">${actionsHtml}</ul>
    </div>` : ""}

    <div style="text-align:center;margin:32px 0 16px;">
      <a href="https://recouply.ai/collections-assessment" style="display:inline-block;padding:12px 32px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">Run Your Own Assessment</a>
    </div>

    <p style="color:#94a3b8;font-size:11px;text-align:center;margin:24px 0 0;">
      Estimates are directional and depend on your business and customer behavior.<br/>
      Powered by <a href="https://recouply.ai" style="color:#3b82f6;text-decoration:none;">Recouply.ai</a> — Collection Intelligence Platform
    </p>
  </div>
</body>
</html>`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Recouply.ai <noreply@recouply.ai>",
        to: [to_email],
        subject: subjectLine,
        html,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("Resend error:", errText);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("share-assessment error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
