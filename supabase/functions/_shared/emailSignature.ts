/**
 * Email Signature Generator for Edge Functions
 * 
 * Generates consistent email signatures with organization branding,
 * custom signatures, payment links, and Recouply.ai branding.
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
 * Generate Recouply.ai branded footer section
 */
function generateRecouplyFooter(): string {
  return `
    <!-- Recouply.ai Branded Footer -->
    <tr>
      <td style="padding: 24px 32px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 0 0 12px 12px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="text-align: center;">
              <!-- Recouply Logo -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 16px;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 10px;">
                    <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 8px; text-align: center; line-height: 36px;">
                      <span style="color: #ffffff; font-weight: bold; font-size: 18px;">R</span>
                    </div>
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">Recouply</span><span style="color: #3b82f6; font-size: 20px; font-weight: 700;">.ai</span>
                  </td>
                </tr>
              </table>
              
              <!-- Tagline -->
              <p style="margin: 0 0 16px; font-size: 14px; color: #94a3b8; font-weight: 500;">
                AI-Powered CashOps Platform
              </p>
              
              <!-- Feature badges -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 16px;">
                <tr>
                  <td style="padding: 0 6px;">
                    <span style="display: inline-block; background: rgba(59, 130, 246, 0.2); color: #60a5fa; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 12px;">🤖 6 AI Agents</span>
                  </td>
                  <td style="padding: 0 6px;">
                    <span style="display: inline-block; background: rgba(139, 92, 246, 0.2); color: #a78bfa; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 12px;">⚡ 24/7 Collections</span>
                  </td>
                  <td style="padding: 0 6px;">
                    <span style="display: inline-block; background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 12px;">📈 Smart Recovery</span>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Link -->
              <p style="margin: 0 0 12px;">
                <a href="https://recouply.ai" style="color: #3b82f6; text-decoration: none; font-size: 13px; font-weight: 600;">
                  Learn more at recouply.ai →
                </a>
              </p>
              
              <!-- Copyright -->
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                © ${new Date().getFullYear()} Recouply.ai • Transforming how businesses recover revenue
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `.trim();
}

/**
 * Generate styled email wrapper with Recouply.ai branding
 */
export function wrapEmailContent(body: string, branding: BrandingSettings = {}): string {
  const businessName = branding.business_name || branding.from_name || "Your Business";
  const primaryColor = branding.primary_color || "#1e3a5f";
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; line-height: 1.6;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc;">
    <tr>
      <td style="padding: 32px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Header with branding -->
          <tr>
            <td style="padding: 24px 32px; background: linear-gradient(135deg, ${primaryColor} 0%, #2d5a87 100%); border-radius: 12px 12px 0 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    ${branding.logo_url 
                      ? `<img src="${escapeHtml(branding.logo_url)}" alt="${escapeHtml(businessName)}" style="max-height: 48px; max-width: 180px; height: auto;" />`
                      : `<span style="color: #ffffff; font-size: 20px; font-weight: 700;">${escapeHtml(businessName)}</span>`
                    }
                  </td>
                  <td style="text-align: right;">
                    <span style="display: inline-block; background: rgba(255, 255, 255, 0.15); color: #ffffff; font-size: 10px; font-weight: 600; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                      via Recouply.ai
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 32px; color: #1e293b; font-size: 15px;">
              ${body}
            </td>
          </tr>
          
          ${generateRecouplyFooter()}
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
         style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.3);">
        💳 Pay Now${amountText}
      </a>
    </div>
    <p style="text-align: center; margin: 8px 0 0; color: #64748b; font-size: 13px;">
      Secure payment powered by Stripe
    </p>
  `.trim();
}

/**
 * Generate HTML email signature with logo, custom signature, and Recouply.ai branding
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
    ? `<p style="font-size: 12px; color: #64748b; margin: 12px 0 0 0;">${escapeHtml(branding.email_footer)}</p>`
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
        style="max-width: 140px; height: auto; display: block; margin-bottom: 12px;"
      />`
    : "";

  return `
    ${paymentButton}
    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
      ${customSignature}
      ${logoSection}
      
      <!-- Sent on behalf notice -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top: 16px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 8px; padding: 16px; width: 100%;">
        <tr>
          <td style="padding: 16px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="vertical-align: top; padding-right: 14px;">
                  <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 10px; text-align: center; line-height: 44px;">
                    <span style="color: #ffffff; font-weight: bold; font-size: 20px;">R</span>
                  </div>
                </td>
                <td style="vertical-align: top;">
                  <p style="margin: 0 0 4px; font-size: 14px; color: #1e293b; font-weight: 600;">
                    Sent on behalf of ${escapeHtml(businessName)}
                  </p>
                  <p style="margin: 0; font-size: 13px; color: #64748b;">
                    Powered by <a href="https://recouply.ai" style="color: #3b82f6; text-decoration: none; font-weight: 600;">Recouply.ai</a> • AI-Powered CashOps Platform
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
 * Generate plain text email signature
 */
export function generatePlainTextSignature(
  branding: BrandingSettings,
  paymentOptions?: PaymentLinkOptions
): string {
  const businessName = branding.business_name || branding.from_name || "Your Business";
  
  let signature = "\n\n";
  
  // Payment link
  if (paymentOptions?.paymentUrl) {
    const amountText = paymentOptions.amount ? ` ($${paymentOptions.amount.toLocaleString()})` : "";
    signature += `💳 Pay Now${amountText}: ${paymentOptions.paymentUrl}\n\n`;
  }
  
  signature += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
  
  if (branding.email_signature) {
    signature += branding.email_signature + "\n\n";
  }
  
  signature += `Sent on behalf of ${businessName}\n\n`;
  signature += `🤖 Powered by Recouply.ai\n`;
  signature += `   AI-Powered CashOps Platform\n`;
  signature += `   6 AI Agents • 24/7 Collections • Smart Recovery\n`;
  signature += `   https://recouply.ai\n`;
  
  if (branding.email_footer) {
    signature += "\n" + branding.email_footer;
  }
  
  return signature;
}

/**
 * Generate a full branded email with content, signature, and optional payment link
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
