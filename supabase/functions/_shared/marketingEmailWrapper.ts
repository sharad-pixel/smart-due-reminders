/**
 * Recouply.ai branded wrapper for marketing/lead outreach emails.
 * Matches the visual identity of transactional emails:
 * - System font stack
 * - Primary #3b82f6, Accent #22c55e
 * - White card on light gray background, 1px borders
 */

const FONT_STACK = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;

const BRAND = {
  name: "Recouply.ai",
  legalName: "RecouplyAI Inc.",
  tagline: "Collections & Risk Intelligence Platform",
  website: "https://recouply.ai",
  address: "Delaware, USA",
  primary: "#3b82f6",
  accent: "#22c55e",
  text: "#1e293b",
  muted: "#64748b",
  border: "#e2e8f0",
  bg: "#f8fafc",
};

export interface MarketingWrapperInput {
  subject: string;
  bodyHtml: string;
  unsubscribeUrl: string;
  preheader?: string;
  recipientName?: string | null;
  company?: string | null;
}

/** Hydrate {{first_name}}, {{name}}, {{company}}, {{user_name}} */
export function hydrateMarketingTokens(
  text: string,
  vars: { name?: string | null; company?: string | null }
): string {
  if (!text) return "";
  const name = (vars.name || "").trim();
  const first = name.split(/\s+/)[0] || "";
  const company = (vars.company || "").trim();
  return text
    .replace(/\{\{\s*first_name\s*\}\}/gi, first || "there")
    .replace(/\{\{\s*name\s*\}\}/gi, name || "there")
    .replace(/\{\{\s*user_name\s*\}\}/gi, name || "there")
    .replace(/\{\{\s*company\s*\}\}/gi, company || "your company");
}

export function wrapMarketingEmailHtml(input: MarketingWrapperInput): string {
  const { subject, bodyHtml, unsubscribeUrl, preheader } = input;
  const preview = preheader || subject;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:${FONT_STACK};color:${BRAND.text};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.bg};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">
      <!-- Header -->
      <tr><td style="padding:0 0 20px 0;">
        <table role="presentation" width="100%"><tr>
          <td style="vertical-align:middle;">
            <a href="${BRAND.website}" style="text-decoration:none;color:${BRAND.text};font-size:20px;font-weight:700;letter-spacing:-0.01em;">
              <span style="color:${BRAND.primary};">●</span> ${BRAND.name}
            </a>
            <div style="font-size:12px;color:${BRAND.muted};margin-top:4px;">${BRAND.tagline}</div>
          </td>
        </tr></table>
      </td></tr>
      <!-- Card -->
      <tr><td style="background:#ffffff;border:1px solid ${BRAND.border};border-radius:8px;padding:32px;">
        <div style="font-size:15px;line-height:1.6;color:${BRAND.text};">
          ${bodyHtml}
        </div>
      </td></tr>
      <!-- Footer -->
      <tr><td style="padding:24px 8px;text-align:center;">
        <p style="margin:0 0 8px;font-size:12px;color:${BRAND.muted};">
          <a href="${BRAND.website}" style="color:${BRAND.muted};text-decoration:none;">${BRAND.website}</a>
        </p>
        <p style="margin:0 0 8px;font-size:12px;color:${BRAND.muted};">
          ${BRAND.legalName} • ${BRAND.address}
        </p>
        <p style="margin:0;font-size:12px;">
          <a href="${unsubscribeUrl}" style="color:${BRAND.primary};text-decoration:underline;">Unsubscribe</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function wrapMarketingEmailText(input: { bodyText: string; unsubscribeUrl: string }): string {
  return `${input.bodyText}

—
${BRAND.name} • ${BRAND.tagline}
${BRAND.website}
${BRAND.legalName} • ${BRAND.address}
Unsubscribe: ${input.unsubscribeUrl}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
