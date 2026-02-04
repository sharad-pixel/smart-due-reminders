/**
 * Email Signature Generator
 * 
 * Generates clean, professional email signatures with organization branding
 * and minimal platform attribution.
 */

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
 * Generate minimal platform attribution footer
 */
function generateMinimalFooter(): string {
  return `
    <!-- Minimal Platform Footer -->
    <tr>
      <td style="padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 11px; color: #94a3b8;">
          Powered by <a href="https://recouply.ai" style="color: #64748b; text-decoration: none;">Recouply.ai</a>
        </p>
      </td>
    </tr>
  `.trim();
}

/**
 * Generate clean email wrapper with organization branding only
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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; line-height: 1.6; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <!-- Header with organization branding -->
          <tr>
            <td style="padding: 24px 32px; background-color: ${primaryColor};">
              ${branding.logo_url 
                ? `<img src="${escapeHtml(branding.logo_url)}" alt="${escapeHtml(businessName)}" style="max-height: 48px; max-width: 180px; height: auto;" />`
                : `<span style="color: #ffffff; font-size: 20px; font-weight: 600;">${escapeHtml(businessName)}</span>`
              }
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 32px; color: #1e293b; font-size: 15px; line-height: 1.7;">
              ${body}
            </td>
          </tr>
          
          ${generateMinimalFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * Generate payment link button for emails
 */
export function generatePaymentButton(options: PaymentLinkOptions): string {
  if (!options.paymentUrl) return "";
  
  const amountText = options.amount 
    ? ` $${options.amount.toLocaleString()}`
    : "";
  
  return `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${escapeHtml(options.paymentUrl)}" 
         style="display: inline-block; background-color: #059669; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 15px; font-weight: 600;">
        Pay Now${amountText}
      </a>
    </div>
    <p style="text-align: center; margin: 8px 0 0; color: #64748b; font-size: 12px;">
      Secure payment powered by Stripe
    </p>
  `.trim();
}

/**
 * Generate clean email signature with organization branding
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
        style="max-width: 120px; height: auto; display: block; margin-bottom: 12px;"
      />`
    : "";

  return `
    ${paymentButton}
    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
      ${customSignature}
      ${logoSection}
      ${customFooter}
    </div>
  `.trim();
}

/**
 * Generate plain text email signature
 */
export function generatePlainTextSignature(
  branding: BrandingSettings,
  paymentOptions?: PaymentLinkOptions
): string {
  let signature = "\n\n";
  
  // Payment link
  if (paymentOptions?.paymentUrl) {
    const amountText = paymentOptions.amount ? ` ($${paymentOptions.amount.toLocaleString()})` : "";
    signature += `Pay Now${amountText}: ${paymentOptions.paymentUrl}\n\n`;
  }
  
  signature += "---\n\n";
  
  if (branding.email_signature) {
    signature += branding.email_signature + "\n\n";
  }
  
  if (branding.email_footer) {
    signature += branding.email_footer + "\n\n";
  }
  
  signature += "Powered by Recouply.ai\n";
  
  return signature;
}

/**
 * Generate a full branded email with content and signature
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

// Export empty company info for backwards compatibility
export const COMPANY_INFO = {
  legalName: "RecouplyAI Inc.",
  displayName: "Recouply.ai",
  website: "https://recouply.ai",
} as const;
