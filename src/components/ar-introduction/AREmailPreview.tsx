import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye } from "lucide-react";

interface AREmailPreviewProps {
  businessName: string;
  customMessage: string;
  logoUrl?: string | null;
  primaryColor?: string;
  accentColor?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyWebsite?: string;
}

// HTML-encode untrusted strings before interpolating into the email template.
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Validate hex color (#rgb / #rgba / #rrggbb / #rrggbbaa); fall back to provided default.
const safeColor = (value: string | undefined, fallback: string): string =>
  value && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : fallback;

// Allow only http(s) URLs; otherwise drop the value.
const safeUrl = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch {
    /* ignore */
  }
  return null;
};

const AREmailPreview = ({
  businessName,
  customMessage,
  logoUrl,
  primaryColor,
  accentColor,
  companyAddress,
  companyPhone,
  companyWebsite,
}: AREmailPreviewProps) => {
  const previewHtml = useMemo(() => {
    const name = escapeHtml(businessName || "Your Company");
    const primary = safeColor(primaryColor, "#6366f1");
    const accent = safeColor(accentColor, "#f59e0b");
    const safeLogoUrl = safeUrl(logoUrl ?? undefined);
    const safeWebsiteUrl = safeUrl(companyWebsite);

    const logoHtml = safeLogoUrl
      ? `<div style="text-align:center;margin:0 0 24px;"><img src="${escapeHtml(safeLogoUrl)}" alt="${name}" style="max-height:60px;max-width:200px;" /></div>`
      : "";

    const addressHtml = companyAddress
      ? `<p style="margin:4px 0 0;color:#94a3b8;font-size:12px;white-space:pre-line;">${escapeHtml(companyAddress)}</p>`
      : "";
    const phoneHtml = companyPhone
      ? `<p style="margin:2px 0 0;color:#94a3b8;font-size:12px;">📞 ${escapeHtml(companyPhone)}</p>`
      : "";
    const websiteHtml = safeWebsiteUrl
      ? `<p style="margin:2px 0 0;color:#94a3b8;font-size:12px;">🌐 <a href="${escapeHtml(safeWebsiteUrl)}" style="color:${primary};text-decoration:none;">${escapeHtml(safeWebsiteUrl)}</a></p>`
      : "";

    const customBlock = customMessage.trim()
      ? `<div style="background:#f8fafc;border-left:4px solid ${primary};border-radius:4px;padding:16px;margin:24px 0;">
           <p style="margin:0 0 8px;color:#0f172a;font-size:13px;font-weight:600;">A message from ${name}:</p>
           <p style="margin:0;color:#475569;font-size:14px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(customMessage)}</p>
         </div>`
      : "";

    const body = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:100%;background:#ffffff;color:#0f172a;padding:16px;">
        ${logoHtml}
        <h2 style="margin:0 0 24px;color:#0f172a;font-size:20px;font-weight:700;">Enhanced Accounts Receivable Communication</h2>
        <p style="margin:0 0 20px;color:#475569;font-size:13px;line-height:1.7;">Dear Valued Client,</p>
        <p style="margin:0 0 20px;color:#475569;font-size:13px;line-height:1.7;">
          We are writing to inform you that <strong>${name}</strong> has implemented an enhanced accounts receivable management system powered by <strong>Recouply.ai</strong> — a Revenue Intelligence Platform designed to improve client communication, transparency, and efficiency.
        </p>
        <div style="background-color:${primary};border-radius:8px;padding:20px;margin:24px 0;text-align:center;">
          <p style="margin:0;color:#ffffff;font-size:16px;font-weight:700;">What This Means for You</p>
          <p style="margin:10px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Streamlined communication · Secure payment portal · Real-time account visibility</p>
        </div>
        <p style="margin:0 0 20px;color:#475569;font-size:13px;line-height:1.7;">
          As part of our commitment to delivering an exceptional client experience, we have adopted a co-pilot approach to accounts receivable management. You may receive communications from Recouply.ai on behalf of <strong>${name}</strong>. These communications are legitimate, authorized, and designed to serve as a single source of record for all receivables-related correspondence.
        </p>
        <div style="background-color:#f0fdf4;border-radius:8px;padding:16px;margin:24px 0;border:1px solid #86efac;">
          <h3 style="margin:0 0 12px;color:#166534;font-size:14px;font-weight:600;">✅ Please Trust Communications From Recouply.ai</h3>
          <ul style="margin:0;padding:0 0 0 18px;color:#15803d;font-size:13px;line-height:2;">
            <li>Emails from verified <strong>@recouply.ai</strong> addresses</li>
            <li>All messages authorized by <strong>${name}</strong></li>
            <li><strong>256-bit encryption</strong> for all communications</li>
            <li>Your data privacy and security are our top priorities</li>
          </ul>
        </div>
        ${customBlock}
        <h3 style="margin:24px 0 14px;color:#0f172a;font-size:14px;font-weight:600;">🔒 Your Secure Payment Portal</h3>
        <p style="margin:0 0 20px;color:#475569;font-size:13px;line-height:1.7;">
          You now have access to a secure, encrypted portal where you can view outstanding balances, review invoice details, and communicate directly with our team.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a style="display:inline-block;background-color:${accent};color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:13px;font-weight:600;pointer-events:none;">
            Access Your Payment Portal →
          </a>
          <p style="margin:10px 0 0;color:#94a3b8;font-size:11px;">🔐 256-bit encrypted · Powered by Recouply.ai</p>
        </div>
        <p style="margin:24px 0 0;color:#475569;font-size:13px;line-height:1.7;">Thank you for your continued partnership.</p>
        <div style="margin:24px 0 0;padding-top:18px;border-top:1px solid #e2e8f0;">
          ${safeLogoUrl ? `<img src="${escapeHtml(safeLogoUrl)}" alt="${name}" style="max-height:36px;max-width:140px;margin-bottom:8px;" />` : ""}
          <p style="margin:0;color:#0f172a;font-size:14px;font-weight:600;">${name}</p>
          <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">Accounts Receivable Department</p>
          ${addressHtml}${phoneHtml}${websiteHtml}
          <p style="margin:8px 0 0;color:${primary};font-size:11px;font-style:italic;">Powered by Recouply.ai — Revenue Intelligence</p>
        </div>
      </div>
    `;

    // Wrap in a full document; rendered via sandboxed iframe to isolate from parent page.
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"></head><body style="margin:0;">${body}</body></html>`;
  }, [businessName, customMessage, logoUrl, primaryColor, accentColor, companyAddress, companyPhone, companyWebsite]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          Email Preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden bg-white">
          <div className="bg-muted/50 px-4 py-2 border-b flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">Subject:</span>
            <span>Important: {businessName || "Your Company"} — Enhanced Accounts Receivable Communication</span>
          </div>
          <iframe
            title="AR Email Preview"
            sandbox=""
            srcDoc={previewHtml}
            className="w-full h-[500px] border-0 bg-white"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default AREmailPreview;
