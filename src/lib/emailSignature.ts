/**
 * Email Signature Generator
 * 
 * Generates consistent enterprise-grade email signatures with organization branding,
 * custom signatures, payment links, and RecouplyAI Inc. branding.
 */

// Company Information
const COMPANY_INFO = {
  legalName: "RecouplyAI Inc.",
  displayName: "Recouply.ai",
  tagline: "AI-Powered CashOps Platform",
  website: "https://recouply.ai",
  emails: {
    collections: "collections@recouply.ai",
    support: "support@recouply.ai",
    notifications: "notifications@recouply.ai",
  },
  address: "Delaware, USA",
} as const;

export interface BrandingSettings {
  logo_url?: string | null;
  business_name?: string;
  from_name?: string;
  email_signature?: string;
  email_footer?: string;
  primary_color?: string;
}

export interface PaymentLinkOptions {
  invoiceId?: string;
  amount?: number;
  paymentUrl?: string;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

/**
 * Generate RecouplyAI Inc. enterprise branded footer section
 */
function generateRecouplyFooter(): string {
  const currentYear = new Date().getFullYear();
  
  return `
    <!-- RecouplyAI Inc. Enterprise Footer -->
    <tr>
      <td style="padding: 32px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 0 0 12px 12px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="text-align: center;">
              <!-- Recouply Logo -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 20px;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 12px;">
                    <div style="width: 42px; height: 42px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 10px; text-align: center; line-height: 42px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
                      <span style="color: #ffffff; font-weight: bold; font-size: 20px;">R</span>
                    </div>
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Recouply</span><span style="color: #3b82f6; font-size: 22px; font-weight: 700;">.ai</span>
                  </td>
                </tr>
              </table>
              
              <!-- Tagline -->
              <p style="margin: 0 0 20px; font-size: 15px; color: #94a3b8; font-weight: 500;">
                ${COMPANY_INFO.tagline}
              </p>
              
              <!-- Feature badges -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 24px;">
                <tr>
                  <td style="padding: 0 8px;">
                    <span style="display: inline-block; background: rgba(59, 130, 246, 0.15); color: #60a5fa; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 16px; border: 1px solid rgba(59, 130, 246, 0.2);">🤖 6 AI Agents</span>
                  </td>
                  <td style="padding: 0 8px;">
                    <span style="display: inline-block; background: rgba(139, 92, 246, 0.15); color: #a78bfa; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 16px; border: 1px solid rgba(139, 92, 246, 0.2);">⚡ 24/7 Collections</span>
                  </td>
                  <td style="padding: 0 8px;">
                    <span style="display: inline-block; background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 16px; border: 1px solid rgba(16, 185, 129, 0.2);">📈 Smart Recovery</span>
                  </td>
                </tr>
              </table>
              
              <!-- Contact Links -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 20px;">
                <tr>
                  <td style="padding: 0 16px; text-align: center;">
                    <a href="mailto:${COMPANY_INFO.emails.support}" style="color: #94a3b8; text-decoration: none; font-size: 13px; font-weight: 500;">
                      Support
                    </a>
                  </td>
                  <td style="color: #475569;">|</td>
                  <td style="padding: 0 16px; text-align: center;">
                    <a href="mailto:${COMPANY_INFO.emails.collections}" style="color: #94a3b8; text-decoration: none; font-size: 13px; font-weight: 500;">
                      Collections
                    </a>
                  </td>
                  <td style="color: #475569;">|</td>
                  <td style="padding: 0 16px; text-align: center;">
                    <a href="${COMPANY_INFO.website}" style="color: #3b82f6; text-decoration: none; font-size: 13px; font-weight: 600;">
                      Visit Website →
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Divider -->
              <div style="width: 100%; height: 1px; background: linear-gradient(90deg, transparent, #334155, transparent); margin: 20px 0;"></div>
              
              <!-- Legal Footer -->
              <p style="margin: 0 0 8px; font-size: 12px; color: #64748b;">
                © ${currentYear} ${COMPANY_INFO.legalName}. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                ${COMPANY_INFO.address} • AI-powered software, not a collection agency
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `.trim();
}

/**
 * Generate enterprise-grade styled email wrapper with RecouplyAI Inc. branding
 */
export function wrapEmailContent(body: string, branding: BrandingSettings = {}): string {
  const businessName = branding.business_name || branding.from_name || "Your Business";
  const primaryColor = branding.primary_color || "#1e3a5f";
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>Message from ${escapeHtml(businessName)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9; line-height: 1.6; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f1f5f9;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05); overflow: hidden;">
          <!-- Header with branding -->
          <tr>
            <td style="padding: 28px 36px; background: linear-gradient(135deg, ${primaryColor} 0%, #2d5a87 100%);">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    ${branding.logo_url 
                      ? `<img src="${escapeHtml(branding.logo_url)}" alt="${escapeHtml(businessName)}" style="max-height: 52px; max-width: 200px; height: auto;" />`
                      : `<span style="color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">${escapeHtml(businessName)}</span>`
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 36px; color: #1e293b; font-size: 15px; line-height: 1.7;">
              ${body}
            </td>
          </tr>
          
          ${generateRecouplyFooter()}
        </table>
        
        <!-- Unsubscribe and Legal Links -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 16px auto 0;">
          <tr>
            <td style="text-align: center; padding: 0 20px;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                This email was sent by ${COMPANY_INFO.legalName} on behalf of ${escapeHtml(businessName)}.
                <br>
                Questions? Contact us at <a href="mailto:${COMPANY_INFO.emails.support}" style="color: #64748b;">${COMPANY_INFO.emails.support}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * Generate enterprise payment link button for emails
 */
export function generatePaymentButton(options: PaymentLinkOptions): string {
  if (!options.paymentUrl) return "";
  
  const amountText = options.amount 
    ? ` $${options.amount.toLocaleString()}`
    : "";
  
  return `
    <div style="text-align: center; margin: 28px 0;">
      <a href="${escapeHtml(options.paymentUrl)}" 
         style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px -2px rgba(5, 150, 105, 0.4); letter-spacing: 0.3px;">
        💳 Pay Now${amountText}
      </a>
    </div>
    <p style="text-align: center; margin: 12px 0 0; color: #64748b; font-size: 13px;">
      🔒 Secure payment powered by Stripe
    </p>
  `.trim();
}

/**
 * Generate enterprise HTML email signature with logo, custom signature, and RecouplyAI Inc. branding
 */
export function generateEmailSignature(
  branding: BrandingSettings, 
  paymentOptions?: PaymentLinkOptions
): string {
  const businessName = branding.business_name || branding.from_name || "Your Business";
  
  // Custom signature takes precedence if provided
  const customSignature = branding.email_signature 
    ? `<p style="font-size: 14px; color: #374151; margin: 0 0 16px 0; white-space: pre-line;">${escapeHtml(branding.email_signature)}</p>`
    : "";

  // Custom footer
  const customFooter = branding.email_footer
    ? `<p style="font-size: 12px; color: #64748b; margin: 16px 0 0 0;">${escapeHtml(branding.email_footer)}</p>`
    : "";

  // Payment button if provided
  const paymentButton = paymentOptions?.paymentUrl 
    ? generatePaymentButton(paymentOptions) 
    : "";

  // Logo section
  const logoSection = branding.logo_url 
    ? `<img 
        src="${escapeHtml(branding.logo_url)}" 
        alt="${escapeHtml(businessName)} logo" 
        style="max-width: 140px; height: auto; display: block; margin-bottom: 16px;"
      />`
    : "";

  return `
    ${paymentButton}
    <div style="margin-top: 36px; padding-top: 28px; border-top: 2px solid #e2e8f0;">
      ${customSignature}
      ${logoSection}
      
      <!-- Enterprise Sent on behalf notice -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top: 20px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; width: 100%; border: 1px solid #e2e8f0;">
        <tr>
          <td style="padding: 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="vertical-align: top; padding-right: 16px; width: 52px;">
                  <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 12px; text-align: center; line-height: 48px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);">
                    <span style="color: #ffffff; font-weight: bold; font-size: 22px;">R</span>
                  </div>
                </td>
                <td style="vertical-align: top;">
                  <p style="margin: 0 0 6px; font-size: 15px; color: #1e293b; font-weight: 600;">
                    Sent on behalf of ${escapeHtml(businessName)}
                  </p>
                  <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;">
                    Powered by <a href="${COMPANY_INFO.website}" style="color: #3b82f6; text-decoration: none; font-weight: 600;">${COMPANY_INFO.displayName}</a> • ${COMPANY_INFO.tagline}
                  </p>
                  <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                    ${COMPANY_INFO.legalName} • <a href="mailto:${COMPANY_INFO.emails.support}" style="color: #64748b; text-decoration: none;">${COMPANY_INFO.emails.support}</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      ${customFooter}
    </div>
  `.trim();
}

/**
 * Generate enterprise plain text email signature
 */
export function generatePlainTextSignature(
  branding: BrandingSettings,
  paymentOptions?: PaymentLinkOptions
): string {
  const businessName = branding.business_name || branding.from_name || "Your Business";
  const currentYear = new Date().getFullYear();
  
  let signature = "\n\n";
  
  // Payment link
  if (paymentOptions?.paymentUrl) {
    const amountText = paymentOptions.amount ? ` ($${paymentOptions.amount.toLocaleString()})` : "";
    signature += `💳 Pay Now${amountText}: ${paymentOptions.paymentUrl}\n`;
    signature += `🔒 Secure payment powered by Stripe\n\n`;
  }
  
  signature += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
  
  if (branding.email_signature) {
    signature += branding.email_signature + "\n\n";
  }
  
  signature += `Sent on behalf of ${businessName}\n\n`;
  signature += `🤖 Powered by ${COMPANY_INFO.displayName}\n`;
  signature += `   ${COMPANY_INFO.tagline}\n`;
  signature += `   6 AI Agents • 24/7 Collections • Smart Recovery\n`;
  signature += `   ${COMPANY_INFO.website}\n\n`;
  signature += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  signature += `${COMPANY_INFO.legalName}\n`;
  signature += `Support: ${COMPANY_INFO.emails.support}\n`;
  signature += `Collections: ${COMPANY_INFO.emails.collections}\n`;
  signature += `© ${currentYear} All rights reserved.\n`;
  
  if (branding.email_footer) {
    signature += "\n" + branding.email_footer;
  }
  
  return signature;
}

/**
 * Generate a full enterprise branded email with content, signature, and optional payment link
 */
export function generateBrandedEmail(
  content: string,
  branding: BrandingSettings,
  paymentOptions?: PaymentLinkOptions
): string {
  const signature = generateEmailSignature(branding, paymentOptions);
  const emailBody = content + signature;
  return wrapEmailContent(emailBody, branding);
}

// Export company info for use in other modules
export { COMPANY_INFO };
