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

const AREmailPreview = ({
  businessName,
  customMessage,
  logoUrl,
  primaryColor = "#6366f1",
  accentColor = "#f59e0b",
  companyAddress,
  companyPhone,
  companyWebsite,
}: AREmailPreviewProps) => {
  const previewHtml = useMemo(() => {
    const name = businessName || "Your Company";
    const logoHtml = logoUrl
      ? `<div style="text-align:center;margin:0 0 24px;"><img src="${logoUrl}" alt="${name}" style="max-height:60px;max-width:200px;" /></div>`
      : "";

    const addressHtml = companyAddress
      ? `<p style="margin:4px 0 0;color:#94a3b8;font-size:12px;white-space:pre-line;">${companyAddress}</p>`
      : "";
    const phoneHtml = companyPhone
      ? `<p style="margin:2px 0 0;color:#94a3b8;font-size:12px;">📞 ${companyPhone}</p>`
      : "";
    const websiteHtml = companyWebsite
      ? `<p style="margin:2px 0 0;color:#94a3b8;font-size:12px;">🌐 <a href="${companyWebsite}" style="color:${primaryColor};text-decoration:none;">${companyWebsite}</a></p>`
      : "";

    const customBlock = customMessage.trim()
      ? `<div style="background:#f8fafc;border-left:4px solid ${primaryColor};border-radius:4px;padding:16px;margin:24px 0;">
           <p style="margin:0 0 8px;color:#0f172a;font-size:13px;font-weight:600;">A message from ${name}:</p>
           <p style="margin:0;color:#475569;font-size:14px;line-height:1.7;">${customMessage}</p>
         </div>`
      : "";

    return `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:100%;background:#ffffff;color:#0f172a;">
        ${logoHtml}
        <h2 style="margin:0 0 24px;color:#0f172a;font-size:20px;font-weight:700;">Enhanced Accounts Receivable Communication</h2>
        <p style="margin:0 0 20px;color:#475569;font-size:13px;line-height:1.7;">Dear Valued Client,</p>
        <p style="margin:0 0 20px;color:#475569;font-size:13px;line-height:1.7;">
          We are writing to inform you that <strong>${name}</strong> has implemented an enhanced accounts receivable management system powered by <strong>Recouply.ai</strong> — a Collections &amp; Risk Intelligence Platform designed to improve client communication, transparency, and efficiency.
        </p>
        <div style="background-color:${primaryColor};border-radius:8px;padding:20px;margin:24px 0;text-align:center;">
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
          <a style="display:inline-block;background-color:${accentColor};color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:13px;font-weight:600;pointer-events:none;">
            Access Your Payment Portal →
          </a>
          <p style="margin:10px 0 0;color:#94a3b8;font-size:11px;">🔐 256-bit encrypted · Powered by Recouply.ai</p>
        </div>
        <p style="margin:24px 0 0;color:#475569;font-size:13px;line-height:1.7;">Thank you for your continued partnership.</p>
        <div style="margin:24px 0 0;padding-top:18px;border-top:1px solid #e2e8f0;">
          ${logoUrl ? `<img src="${logoUrl}" alt="${name}" style="max-height:36px;max-width:140px;margin-bottom:8px;" />` : ""}
          <p style="margin:0;color:#0f172a;font-size:14px;font-weight:600;">${name}</p>
          <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">Accounts Receivable Department</p>
          ${addressHtml}${phoneHtml}${websiteHtml}
          <p style="margin:8px 0 0;color:${primaryColor};font-size:11px;font-style:italic;">Powered by Recouply.ai — Collections &amp; Risk Intelligence</p>
        </div>
      </div>
    `;
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
          <div
            className="p-4 sm:p-6 overflow-auto max-h-[500px]"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default AREmailPreview;
