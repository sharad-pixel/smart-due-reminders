import { useMemo } from "react";

interface EmailPreviewFrameProps {
  subject: string;
  bodyHtml: string;
  logoUrl?: string;
  businessName?: string;
  primaryColor?: string;
  arPageLink?: string;
}

const FONT_STACK = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;

export function EmailPreviewFrame({
  subject,
  bodyHtml,
  logoUrl,
  businessName = "Recouply.ai",
  primaryColor = "#3b82f6",
  arPageLink,
}: EmailPreviewFrameProps) {
  const fullEmailHtml = useMemo(() => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: ${FONT_STACK};
      line-height: 1.6;
      color: #1e293b;
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
    }
    .email-header {
      background-color: ${primaryColor};
      padding: 24px 32px;
    }
    .email-header img {
      max-width: 140px;
      max-height: 44px;
    }
    .email-header h2 {
      color: #ffffff;
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    .email-body {
      padding: 32px;
    }
    .email-body h1 {
      color: ${primaryColor};
      font-size: 22px;
      margin-top: 0;
      font-weight: 700;
    }
    .email-body h2 {
      color: ${primaryColor};
      font-size: 18px;
      font-weight: 600;
    }
    .email-body h3 {
      color: ${primaryColor};
      font-size: 15px;
      font-weight: 600;
    }
    .email-body a {
      color: ${primaryColor};
    }
    .email-body ul, .email-body ol {
      padding-left: 20px;
    }
    .email-body li {
      margin-bottom: 6px;
    }
    .cta-button {
      display: inline-block;
      background-color: ${primaryColor};
      color: #ffffff !important;
      padding: 10px 24px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      margin: 16px 0;
    }
    .email-footer {
      background-color: #1e293b;
      padding: 24px;
      text-align: center;
    }
    .footer-wordmark {
      color: rgba(255,255,255,0.9);
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    .footer-wordmark .accent {
      color: #22c55e;
    }
    .footer-text {
      color: #94a3b8;
      font-size: 11px;
      margin: 4px 0;
    }
    .footer-legal {
      color: #475569;
      font-size: 10px;
      margin: 12px 0 0;
    }
    .ar-page-link {
      display: inline-block;
      background-color: #3b82f6;
      color: #ffffff !important;
      padding: 10px 24px;
      text-decoration: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
    }
    .portal-link {
      display: inline-block;
      font-size: 11px;
      color: #64748b;
      text-decoration: none;
      font-weight: 500;
      margin-bottom: 4px;
    }
    .powered-by {
      font-size: 10px;
      color: #94a3b8;
    }
    .powered-by a {
      color: #94a3b8;
      text-decoration: none;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      ${logoUrl ? `<img src="${logoUrl}" alt="${businessName}" />` : `<h2>${businessName}</h2>`}
    </div>
    <div class="email-body">
      ${bodyHtml}
    </div>
    ${arPageLink ? `
    <div style="padding: 0 32px 16px; text-align: center;">
      <div style="padding: 20px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
        <p style="margin: 0 0 12px; font-size: 14px; color: #1e293b; font-weight: 600;">Accounts Receivable Portal</p>
        <a href="${arPageLink}" class="ar-page-link">Visit AR Portal →</a>
      </div>
    </div>
    ` : ""}
    <div style="padding: 12px 32px 16px; text-align: center; border-top: 1px solid #e2e8f0;">
      <a href="#" class="portal-link">🔒 Access Payment Portal</a>
      <br/>
      <span class="powered-by">Powered by <a href="https://recouply.ai">recouply.ai</a></span>
    </div>
    <div class="email-footer">
      <p class="footer-wordmark">Recouply<span class="accent">.ai</span></p>
      <p class="footer-text">Collection Intelligence Platform</p>
      <p class="footer-legal">© ${new Date().getFullYear()} RecouplyAI Inc. · Delaware, USA</p>
    </div>
  </div>
</body>
</html>
    `;
  }, [subject, bodyHtml, logoUrl, businessName, primaryColor, arPageLink]);

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* Email client header simulation */}
      <div className="bg-muted/50 border-b p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground font-medium w-16">From:</span>
          <span className="text-foreground">{businessName} &lt;notifications@send.inbound.services.recouply.ai&gt;</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground font-medium w-16">To:</span>
          <span className="text-foreground">recipient@example.com</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground font-medium w-16">Subject:</span>
          <span className="text-foreground font-medium">{subject}</span>
        </div>
      </div>
      
      {/* Email content iframe */}
      <iframe
        srcDoc={fullEmailHtml}
        className="w-full h-[600px] border-0"
        title="Email Preview"
      />
    </div>
  );
}
