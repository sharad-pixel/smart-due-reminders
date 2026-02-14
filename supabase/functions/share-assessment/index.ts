import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { EMAIL_CONFIG } from "../_shared/emailConfig.ts";
import { wrapEnterpriseEmail, BRAND } from "../_shared/enterpriseEmailTemplate.ts";

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

    const riskColorMap: Record<string, string> = {
      Low: BRAND.accent,
      Medium: BRAND.warning,
      High: "#f97316",
      Critical: BRAND.destructive,
    };
    const tierColor = riskColorMap[gptResult?.risk_tier] || BRAND.warning;

    const isLeadAlert = share_type === "new_lead_alert";
    const isTeam = share_type === "team";
    const isSelf = share_type === "self";

    // Subject line
    let subjectLine: string;
    if (isLeadAlert) {
      subjectLine = `🔔 New Assessment Lead: ${lead_info?.name || "Unknown"} (${lead_info?.email || "no email"})`;
    } else if (isTeam) {
      subjectLine = `${sender_name || "A team member"} shared a Collections Assessment with you`;
    } else if (share_type === "boss") {
      subjectLine = `${sender_name || "A colleague"} shared a Collections Assessment with you`;
    } else {
      subjectLine = "Your Collections Risk & ROI Assessment — Recouply.ai";
    }

    // Intro paragraph
    let introHtml: string;
    if (isLeadAlert) {
      introHtml = `
        <div style="background:${BRAND.surfaceLight};border:1px solid ${BRAND.border};border-radius:10px;padding:16px;margin-bottom:20px;">
          <p style="color:${BRAND.foreground};font-size:14px;font-weight:600;margin:0 0 8px;">📋 New Lead Details</p>
          <table style="font-size:13px;color:${BRAND.muted};"><tbody>
            <tr><td style="padding:2px 12px 2px 0;font-weight:600;">Name</td><td>${lead_info?.name || "N/A"}</td></tr>
            <tr><td style="padding:2px 12px 2px 0;font-weight:600;">Email</td><td><a href="mailto:${lead_info?.email}" style="color:${BRAND.primary};">${lead_info?.email || "N/A"}</a></td></tr>
            <tr><td style="padding:2px 12px 2px 0;font-weight:600;">Company</td><td>${lead_info?.company || "N/A"}</td></tr>
          </tbody></table>
        </div>`;
    } else if (isTeam || share_type === "boss") {
      introHtml = `<p style="color:${BRAND.muted};font-size:14px;line-height:1.6;">${sender_name || "A team member"} shared this collections risk &amp; ROI assessment with you. Review the findings below to understand the financial impact of overdue invoices.</p>`;
    } else {
      introHtml = `<p style="color:${BRAND.muted};font-size:14px;line-height:1.6;">Here's a copy of your collections assessment results. We've saved this for your records.</p>`;
    }

    // Recommended actions
    const actionsHtml = (gptResult?.recommended_actions || [])
      .map((a: any) => `<li style="margin-bottom:8px;color:${BRAND.foreground};font-size:13px;"><strong>${a.title}</strong> — ${a.why} <em style="color:${BRAND.muted};">(${a.time_to_do})</em></li>`)
      .join("");

    // Build body content (inside enterprise wrapper)
    const bodyContent = `
      <!-- Risk Badge -->
      <div style="text-align:center;margin-bottom:20px;">
        <span style="display:inline-block;padding:5px 18px;border-radius:99px;font-size:13px;font-weight:600;color:${tierColor};background:${tierColor}12;border:1px solid ${tierColor}30;">${gptResult?.risk_tier || "Medium"} Risk</span>
      </div>

      ${introHtml}

      <!-- Metric Cards -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
        <tr>
          <td width="50%" style="padding:6px;">
            <div style="background:${BRAND.cardBg};border:1px solid ${BRAND.border};border-radius:10px;padding:14px;">
              <p style="color:${BRAND.primary};font-size:11px;font-weight:700;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Recouply Cost</p>
              <p style="font-size:22px;font-weight:700;color:${BRAND.foreground};margin:0;">${formatCurrency(results.recouply_cost)}</p>
              <p style="color:${BRAND.muted};font-size:11px;margin:4px 0 0;">${inputs.overdue_count} invoices × $1.99</p>
            </div>
          </td>
          <td width="50%" style="padding:6px;">
            <div style="background:${BRAND.cardBg};border:1px solid ${BRAND.border};border-radius:10px;padding:14px;">
              <p style="color:#f97316;font-size:11px;font-weight:700;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Cost of Delay</p>
              <p style="font-size:22px;font-weight:700;color:${BRAND.foreground};margin:0;">${formatCurrency(results.delay_cost)}</p>
              <p style="color:${BRAND.muted};font-size:11px;margin:4px 0 0;">${inputs.annual_rate}% APR × ~${results.delay_months} mo</p>
            </div>
          </td>
        </tr>
        <tr>
          <td width="50%" style="padding:6px;">
            <div style="background:${BRAND.cardBg};border:1px solid ${BRAND.border};border-radius:10px;padding:14px;">
              <p style="color:${BRAND.destructive};font-size:11px;font-weight:700;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">At-Risk Amount</p>
              <p style="font-size:22px;font-weight:700;color:${BRAND.foreground};margin:0;">${formatCurrency(results.loss_risk_cost)}</p>
              <p style="color:${BRAND.muted};font-size:11px;margin:4px 0 0;">Based on write-off estimate</p>
            </div>
          </td>
          <td width="50%" style="padding:6px;">
            <div style="background:${BRAND.cardBg};border:1px solid ${BRAND.border};border-radius:10px;padding:14px;">
              <p style="color:${BRAND.accent};font-size:11px;font-weight:700;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Breakeven</p>
              <p style="font-size:22px;font-weight:700;color:${BRAND.foreground};margin:0;">${formatCurrency(results.breakeven_recovery)}</p>
              <p style="color:${BRAND.muted};font-size:11px;margin:4px 0 0;">≈ ${formatPercent(results.breakeven_pct)} of overdue</p>
            </div>
          </td>
        </tr>
      </table>

      <!-- ROI Highlight -->
      <div style="background:linear-gradient(135deg,${BRAND.primary}08,${BRAND.accent}08);border:1px solid ${BRAND.primary}25;border-radius:10px;padding:18px;text-align:center;margin-bottom:20px;">
        <p style="color:${BRAND.muted};font-size:12px;margin:0 0 2px;">Estimated ROI</p>
        <p style="font-size:32px;font-weight:700;color:${BRAND.primary};margin:0;">${formatROI(results.roi_multiple)}</p>
        <p style="color:${BRAND.muted};font-size:12px;margin:4px 0 0;">Total impact: ${formatCurrency(results.total_impact)} vs cost of ${formatCurrency(results.recouply_cost)}</p>
      </div>

      <!-- Risk & Value Summary -->
      ${gptResult?.risk_summary ? `
      <div style="margin-bottom:18px;">
        <h3 style="color:${BRAND.foreground};font-size:15px;font-weight:600;margin:0 0 6px;">Risk Summary</h3>
        <p style="color:${BRAND.muted};font-size:13px;line-height:1.6;margin:0 0 6px;">${gptResult.risk_summary}</p>
        ${gptResult.value_summary ? `<p style="color:${BRAND.muted};font-size:13px;line-height:1.6;margin:0;">${gptResult.value_summary}</p>` : ''}
      </div>` : ''}

      <!-- Recommended Actions -->
      ${actionsHtml ? `
      <div style="margin-bottom:18px;">
        <h3 style="color:${BRAND.foreground};font-size:15px;font-weight:600;margin:0 0 8px;">Recommended Next Steps</h3>
        <ul style="padding-left:18px;margin:0;">${actionsHtml}</ul>
      </div>` : ''}

      <!-- CTA -->
      <div style="text-align:center;margin:28px 0 8px;">
        <a href="https://calendly.com/sharad-recouply/30min" style="display:inline-block;padding:14px 36px;background:${BRAND.primary};color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">Book a Demo & Start Collecting Your Money</a>
      </div>

      <p style="color:${BRAND.muted};font-size:11px;text-align:center;margin:16px 0 0;">
        Estimates are directional and depend on your business and customer behavior.
      </p>
    `;

    // Wrap in enterprise branded template
    const html = wrapEnterpriseEmail(bodyContent, {
      headerStyle: 'gradient',
      title: 'Collections Risk & ROI Assessment',
      subtitle: isLeadAlert ? '🔔 New Lead Alert' : undefined,
    });

    // Send via Resend using verified domain
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_CONFIG.FROM_NOTIFICATIONS,
        to: [to_email],
        subject: subjectLine,
        html,
        reply_to: EMAIL_CONFIG.DEFAULT_REPLY_TO,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("Resend error:", errText);
      return new Response(JSON.stringify({ error: "Failed to send email", details: errText }), {
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
