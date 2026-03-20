/**
 * Revenue Risk PDF & CSV export utilities.
 * Uses browser print-to-PDF for the report and generates CSV for risk data.
 */
import type { RevenueRiskData, TopRiskAccount, InvoiceScore } from "@/hooks/useRevenueRisk";

// ===== CSV EXPORT =====

function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportTopRiskAccountsCsv(accounts: TopRiskAccount[]) {
  const headers = [
    "Account Name",
    "Balance",
    "Collectability Score",
    "Collectability Tier",
    "Engagement Score",
    "Engagement Level",
    "ECL",
    "Engagement-Adjusted ECL",
    "Invoice Count",
    "Conversation State",
    "Recommended Action",
  ];

  const rows = accounts.map((a) => [
    escapeCsv(a.debtor_name),
    a.balance.toFixed(2),
    a.collectability_score,
    a.collectability_score >= 80 ? "High" : a.collectability_score >= 60 ? "Moderate" : a.collectability_score >= 40 ? "At Risk" : "High Risk",
    a.engagement_score,
    a.engagement_level,
    a.ecl.toFixed(2),
    a.engagement_adjusted_ecl.toFixed(2),
    a.invoice_count,
    escapeCsv(a.conversation_state),
    escapeCsv(a.recommended_action),
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const date = new Date().toISOString().split("T")[0];
  downloadCsv(`revenue-risk-accounts-${date}.csv`, csv);
}

export function exportInvoiceRiskScoresCsv(scores: InvoiceScore[]) {
  const headers = [
    "Invoice ID",
    "Debtor ID",
    "Amount",
    "Days Past Due",
    "Collectability Score",
    "Collectability Tier",
    "Aging Penalty",
    "Behavioral Penalty",
    "Status Penalty",
    "Engagement Boost",
    "Probability of Default",
    "ECL",
    "Engagement-Adjusted PD",
    "Engagement-Adjusted ECL",
    "Payment Likelihood",
    "Risk Factors",
    "Recommended Action",
  ];

  const rows = scores.map((s) => [
    s.invoice_id,
    s.debtor_id,
    s.amount.toFixed(2),
    s.days_past_due,
    s.collectability_score,
    s.collectability_tier,
    s.aging_penalty.toFixed(2),
    s.behavioral_penalty.toFixed(2),
    s.status_penalty.toFixed(2),
    s.engagement_boost.toFixed(2),
    (s.probability_of_default * 100).toFixed(2) + "%",
    s.expected_credit_loss.toFixed(2),
    (s.engagement_adjusted_pd * 100).toFixed(2) + "%",
    s.engagement_adjusted_ecl.toFixed(2),
    s.payment_likelihood,
    escapeCsv(s.risk_factors.join("; ")),
    escapeCsv(s.recommended_action),
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const date = new Date().toISOString().split("T")[0];
  downloadCsv(`invoice-risk-scores-${date}.csv`, csv);
}

// ===== PDF / PRINT EXPORT =====

export function printRevenueRiskReport(data: RevenueRiskData) {
  const agg = data.aggregate;
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const time = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const tierLabel = (score: number) =>
    score >= 80 ? "High" : score >= 60 ? "Moderate" : score >= 40 ? "At Risk" : "High Risk";

  const engLabel = (level: string) =>
    level === "high" ? "Active" : level === "medium" ? "Moderate" : "No Response";

  const topAccounts = data.top_risk_accounts.slice(0, 15);
  const accountRows = topAccounts
    .map(
      (a) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;">${a.debtor_name}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:11px;">${fmt(a.balance)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:11px;">${a.collectability_score}%</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;">${tierLabel(a.collectability_score)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;">${engLabel(a.engagement_level)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:11px;">${fmt(a.ecl)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:11px;">${fmt(a.engagement_adjusted_ecl)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;">${a.recommended_action}</td>
    </tr>`
    )
    .join("");

  const aiSection = data.ai_insights
    ? `
    <div style="page-break-before:always;"></div>
    <h2 style="font-size:16px;margin:24px 0 12px;color:#1a1a2e;">AI Intelligence Summary</h2>
    <div style="background:#f8fafc;padding:14px;border-radius:6px;margin-bottom:12px;">
      <h3 style="font-size:13px;margin:0 0 6px;color:#b45309;">Risk Summary</h3>
      <p style="font-size:11px;color:#555;margin:0;">${data.ai_insights.risk_summary}</p>
    </div>
    <div style="background:#f8fafc;padding:14px;border-radius:6px;margin-bottom:12px;">
      <h3 style="font-size:13px;margin:0 0 6px;color:#ca8a04;">Engagement Insight</h3>
      <p style="font-size:11px;color:#555;margin:0;">${data.ai_insights.engagement_insight}</p>
    </div>
    <div style="display:flex;gap:20px;">
      <div style="flex:1;">
        <h3 style="font-size:13px;margin:0 0 8px;color:#dc2626;">Key Risk Drivers</h3>
        <ul style="font-size:11px;color:#555;margin:0;padding-left:18px;">
          ${data.ai_insights.key_drivers.map((d) => `<li style="margin-bottom:3px;">${d}</li>`).join("")}
        </ul>
      </div>
      <div style="flex:1;">
        <h3 style="font-size:13px;margin:0 0 8px;color:#16a34a;">Recommendations</h3>
        <ul style="font-size:11px;color:#555;margin:0;padding-left:18px;">
          ${data.ai_insights.recommendations.map((r) => `<li style="margin-bottom:3px;">${r}</li>`).join("")}
        </ul>
      </div>
    </div>
  `
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Revenue Risk & Collectability Report — ${date}</title>
  <style>
    @page { margin: 0.6in; size: letter landscape; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; margin: 0; padding: 0; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #1a1a2e;">
    <div>
      <h1 style="font-size:20px;margin:0;">Revenue Risk & Collectability Report</h1>
      <p style="font-size:11px;color:#888;margin:4px 0 0;">Multi-Signal AR Risk Analysis with Engagement-Adjusted ECL</p>
    </div>
    <div style="text-align:right;">
      <p style="font-size:11px;color:#888;margin:0;">Generated: ${date} at ${time}</p>
      <p style="font-size:10px;color:#b45309;margin:4px 0 0;font-style:italic;">For internal decision-making only. Not GAAP-certified.</p>
    </div>
  </div>

  <!-- KPI Cards -->
  <div style="display:flex;gap:10px;margin-bottom:20px;">
    <div style="flex:1;background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:12px;">
      <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Total AR</div>
      <div style="font-size:20px;font-weight:700;margin-top:2px;">${fmt(agg.total_ar)}</div>
      <div style="font-size:10px;color:#888;">${agg.invoice_count} invoices · ${agg.debtor_count} accounts</div>
    </div>
    <div style="flex:1;background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:12px;">
      <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Overdue AR</div>
      <div style="font-size:20px;font-weight:700;color:#ea580c;margin-top:2px;">${fmt(agg.overdue_ar)}</div>
      <div style="font-size:10px;color:#888;">${agg.pct_overdue}% of total</div>
    </div>
    <div style="flex:1;background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:12px;">
      <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Avg Collectability</div>
      <div style="font-size:20px;font-weight:700;color:${agg.avg_collectability >= 80 ? '#16a34a' : agg.avg_collectability >= 60 ? '#ca8a04' : agg.avg_collectability >= 40 ? '#ea580c' : '#dc2626'};margin-top:2px;">${agg.avg_collectability}%</div>
    </div>
    <div style="flex:1;background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:12px;">
      <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Expected Credit Loss</div>
      <div style="font-size:20px;font-weight:700;color:#dc2626;margin-top:2px;">${fmt(agg.total_ecl)}</div>
      <div style="font-size:10px;color:#888;">${agg.pct_at_risk}% of AR</div>
    </div>
    <div style="flex:1;background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:12px;">
      <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Engagement-Adj ECL</div>
      <div style="font-size:20px;font-weight:700;color:#d97706;margin-top:2px;">${fmt(agg.engagement_adjusted_ecl)}</div>
    </div>
  </div>

  <!-- Distribution & Engagement Summary -->
  <div style="display:flex;gap:16px;margin-bottom:20px;">
    <div style="flex:1;border:1px solid #e5e7eb;border-radius:6px;padding:14px;">
      <h3 style="font-size:13px;margin:0 0 10px;">Collectability Distribution</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;font-size:11px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#22c55e;margin-right:6px;"></span>High (80–100)</td>
          <td style="text-align:right;font-weight:600;font-size:11px;">${agg.collectability_distribution.high}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:11px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#eab308;margin-right:6px;"></span>Moderate (60–79)</td>
          <td style="text-align:right;font-weight:600;font-size:11px;">${agg.collectability_distribution.moderate}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:11px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#f97316;margin-right:6px;"></span>At Risk (40–59)</td>
          <td style="text-align:right;font-weight:600;font-size:11px;">${agg.collectability_distribution.at_risk}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:11px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ef4444;margin-right:6px;"></span>High Risk (<40)</td>
          <td style="text-align:right;font-weight:600;font-size:11px;">${agg.collectability_distribution.high_risk}</td>
        </tr>
      </table>
    </div>
    <div style="flex:1;border:1px solid #e5e7eb;border-radius:6px;padding:14px;">
      <h3 style="font-size:13px;margin:0 0 10px;">Engagement vs Risk</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:#f8fafc;">
          <th style="padding:6px;text-align:left;font-size:10px;text-transform:uppercase;color:#888;">Level</th>
          <th style="padding:6px;text-align:right;font-size:10px;text-transform:uppercase;color:#888;">Accounts</th>
          <th style="padding:6px;text-align:right;font-size:10px;text-transform:uppercase;color:#888;">AR Value</th>
        </tr>
        <tr>
          <td style="padding:6px;font-size:11px;color:#16a34a;">Active</td>
          <td style="padding:6px;text-align:right;font-size:11px;">${agg.engagement_breakdown.active.count}</td>
          <td style="padding:6px;text-align:right;font-size:11px;">${fmt(agg.engagement_breakdown.active.ar_value)}</td>
        </tr>
        <tr>
          <td style="padding:6px;font-size:11px;color:#ca8a04;">Moderate</td>
          <td style="padding:6px;text-align:right;font-size:11px;">${agg.engagement_breakdown.moderate.count}</td>
          <td style="padding:6px;text-align:right;font-size:11px;">${fmt(agg.engagement_breakdown.moderate.ar_value)}</td>
        </tr>
        <tr>
          <td style="padding:6px;font-size:11px;color:#dc2626;">No Response</td>
          <td style="padding:6px;text-align:right;font-size:11px;">${agg.engagement_breakdown.no_response.count}</td>
          <td style="padding:6px;text-align:right;font-size:11px;">${fmt(agg.engagement_breakdown.no_response.ar_value)}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- Top Risk Accounts -->
  <h2 style="font-size:16px;margin:0 0 10px;color:#1a1a2e;">Top Risk Accounts</h2>
  <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
    <thead>
      <tr style="background:#f1f5f9;">
        <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;color:#888;letter-spacing:0.5px;">Account</th>
        <th style="padding:8px 10px;text-align:right;font-size:10px;text-transform:uppercase;color:#888;letter-spacing:0.5px;">Balance</th>
        <th style="padding:8px 10px;text-align:center;font-size:10px;text-transform:uppercase;color:#888;letter-spacing:0.5px;">Score</th>
        <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;color:#888;letter-spacing:0.5px;">Tier</th>
        <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;color:#888;letter-spacing:0.5px;">Engagement</th>
        <th style="padding:8px 10px;text-align:right;font-size:10px;text-transform:uppercase;color:#888;letter-spacing:0.5px;">ECL</th>
        <th style="padding:8px 10px;text-align:right;font-size:10px;text-transform:uppercase;color:#888;letter-spacing:0.5px;">Adj. ECL</th>
        <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;color:#888;letter-spacing:0.5px;">Action</th>
      </tr>
    </thead>
    <tbody>
      ${accountRows}
    </tbody>
  </table>

  ${aiSection}

  <!-- Footer -->
  <div style="margin-top:30px;padding-top:10px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;">
    <p style="font-size:9px;color:#aaa;margin:0;">Recouply.ai — Revenue Risk & Collectability Intelligence</p>
    <p style="font-size:9px;color:#b45309;margin:0;font-style:italic;">${data.disclaimer}</p>
  </div>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };
}
