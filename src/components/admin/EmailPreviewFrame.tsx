import { useMemo } from "react";

interface EmailPreviewFrameProps {
  subject: string;
  bodyHtml: string;
  logoUrl?: string;
  businessName?: string;
  primaryColor?: string;
  arPageLink?: string;
}

export function EmailPreviewFrame({
  subject,
  bodyHtml,
  logoUrl,
  businessName = "Recouply.ai",
  primaryColor = "#1e3a5f",
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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .email-header {
      background-color: ${primaryColor};
      padding: 24px;
      text-align: center;
    }
    .email-header img {
      max-width: 140px;
      max-height: 50px;
    }
    .email-header h2 {
      color: #ffffff;
      margin: 12px 0 0 0;
      font-size: 18px;
    }
    .email-body {
      padding: 32px 24px;
    }
    .email-body h1 {
      color: ${primaryColor};
      font-size: 24px;
      margin-top: 0;
    }
    .email-body h2 {
      color: ${primaryColor};
      font-size: 20px;
    }
    .email-body h3 {
      color: ${primaryColor};
      font-size: 16px;
    }
    .email-body a {
      color: ${primaryColor};
    }
    .email-body ul, .email-body ol {
      padding-left: 24px;
    }
    .email-body li {
      margin-bottom: 8px;
    }
    .cta-button {
      display: inline-block;
      background-color: ${primaryColor};
      color: #ffffff !important;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 16px 0;
    }
    .email-footer {
      background-color: #f8f9fa;
      padding: 24px;
      text-align: center;
      border-top: 1px solid #e9ecef;
    }
    .footer-logo {
      max-width: 100px;
      margin-bottom: 12px;
    }
    .footer-text {
      color: #6c757d;
      font-size: 12px;
      margin: 8px 0;
    }
    .ar-page-link {
      display: inline-block;
      background-color: ${primaryColor};
      color: #ffffff !important;
      padding: 10px 20px;
      text-decoration: none;
      border-radius: 4px;
      font-size: 13px;
      margin: 12px 0;
    }
    .divider {
      height: 1px;
      background-color: #e9ecef;
      margin: 16px 0;
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
    <div class="email-footer">
      ${logoUrl ? `<img src="${logoUrl}" alt="${businessName}" class="footer-logo" />` : ""}
      <p class="footer-text"><strong>${businessName}</strong></p>
      ${arPageLink ? `
        <a href="${arPageLink}" class="ar-page-link">Visit Our AR Information Page</a>
      ` : ""}
      <div class="divider"></div>
      <p class="footer-text">
        This email was sent by ${businessName} via Recouply.ai<br>
        Collection Intelligence Platform
      </p>
      <p class="footer-text" style="color: #999;">
        © ${new Date().getFullYear()} RecouplyAI Inc. All rights reserved.
      </p>
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
