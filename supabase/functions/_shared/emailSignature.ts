// ⚠️ EMAIL DOMAIN WARNING ⚠️
// This module generates FROM addresses for outbound emails.
// The FROM email MUST use verified domain: send.inbound.services.recouply.ai
// DO NOT change to @recouply.ai - it will fail!
// See: supabase/functions/_shared/emailConfig.ts

/**
 * Email Signature Generator for Edge Functions
 * 
 * Clean, modern design matching recouply.ai/collection-intelligence page:
 * - System font stack
 * - Blue primary (#3b82f6), Green accent (#22c55e)
 * - Clean white cards, subtle borders
 * - Professional minimal layout
 */

import { VERIFIED_EMAIL_DOMAIN } from "./emailConfig.ts";
import { INBOUND_EMAIL_DOMAIN } from "./emailConfig.ts";

const FONT_STACK = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;

const COMPANY_INFO = {
  legalName: "RecouplyAI Inc.",
  displayName: "Recouply.ai",
  tagline: "Collections and Risk Intelligence Platform",
  website: "https://recouply.ai",
  emails: {
    collections: `collections@${INBOUND_EMAIL_DOMAIN}`,
    support: `support@${INBOUND_EMAIL_DOMAIN}`,
    notifications: `notifications@${INBOUND_EMAIL_DOMAIN}`,
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
  ar_page_public_token?: string | null;
  ar_page_enabled?: boolean;
  stripe_payment_link?: string | null;
}

export interface PaymentLinkOptions {
  invoiceId?: string;
  amount?: number;
  paymentUrl?: string;
  secureInvoiceUrl?: string;
}

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

function getPublicARPageUrl(token: string | null | undefined): string | null {
  if (!token) return null;
  return `https://recouply.ai/ar/${token}`;
}

export function getEmailFromName(branding: BrandingSettings): string {
  return branding.business_name || branding.from_name || "Recouply.ai";
}

export function getEmailFromAddress(branding: BrandingSettings): string {
  const fromName = getEmailFromName(branding);
  return `${fromName} <collections@${VERIFIED_EMAIL_DOMAIN}>`;
}

/**
 * Generate Public AR Page CTA – clean card style matching site
 */
function generatePublicARPageCTA(branding: BrandingSettings): string {
  const arPageUrl = getPublicARPageUrl(branding.ar_page_public_token);
  if (!arPageUrl || !branding.ar_page_enabled) return "";

  const businessName = branding.business_name || branding.from_name || "Our Company";

  return `
    <div style="text-align: center; margin: 24px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
      <p style="margin: 0 0 6px; font-size: 14px; color: #1e293b; font-weight: 600; font-family: ${FONT_STACK};">
        ${escapeHtml(businessName)} Accounts Receivable Portal
      </p>
      <p style="margin: 0 0 14px; font-size: 13px; color: #64748b; font-family: ${FONT_STACK};">
        View payment options, download invoices, and access documents
      </p>
      <a href="${escapeHtml(arPageUrl)}" 
         style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 13px; font-weight: 600; font-family: ${FONT_STACK};">
        Visit AR Portal →
      </a>
    </div>
  `.trim();
}

/**
 * Clean footer matching site design – minimal, professional
 */
function generateRecouplyFooter(branding: BrandingSettings): string {
  const currentYear = new Date().getFullYear();
  const arPageCTA = generatePublicARPageCTA(branding);
  
  return `
    <!-- Public AR Page CTA -->
    ${arPageCTA ? `<tr><td style="padding: 0 32px;">${arPageCTA}</td></tr>` : ""}
    
    <!-- Clean Footer -->
    <tr>
      <td style="padding: 24px 32px; background-color: #1e293b; border-radius: 0 0 12px 12px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="text-align: center;">
              <!-- Recouply Wordmark -->
              <p style="margin: 0 0 4px; font-size: 16px; font-weight: 700; letter-spacing: -0.3px; font-family: ${FONT_STACK};">
                <span style="color: #ffffff;">Recouply</span><span style="color: #22c55e;">.ai</span>
              </p>
              <p style="margin: 0 0 16px; font-size: 12px; color: #94a3b8; font-family: ${FONT_STACK};">
                ${COMPANY_INFO.tagline}
              </p>
              
              <!-- Nav Links -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 16px;">
                <tr>
                  <td style="padding: 0 10px;">
                    <a href="mailto:${COMPANY_INFO.emails.support}" style="color: #94a3b8; text-decoration: none; font-size: 12px; font-family: ${FONT_STACK};">
                      Support
                    </a>
                  </td>
                  <td style="color: #475569; font-size: 12px;">·</td>
                  <td style="padding: 0 10px;">
                    <a href="${COMPANY_INFO.website}" style="color: #60a5fa; text-decoration: none; font-size: 12px; font-weight: 500; font-family: ${FONT_STACK};">
                      Website
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Legal -->
              <p style="margin: 0 0 8px; font-size: 11px; color: #475569; font-family: ${FONT_STACK};">
                © ${currentYear} ${COMPANY_INFO.legalName} · ${COMPANY_INFO.address}
              </p>
              <!-- Reply-To Tracking Notice -->
              <p style="margin: 0; font-size: 9px; color: #64748b; font-family: ${FONT_STACK}; line-height: 1.4;">
                ⚠️ Please reply directly to this email without changing the "To" or "Reply-To" address. Modifying the reply address may prevent your response from being received and processed.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `.trim();
}

/**
 * Clean email wrapper matching collection-intelligence page design
 */
export function wrapEmailContent(body: string, branding: BrandingSettings = {}, personaName?: string): string {
  const businessName = branding.business_name || branding.from_name || personaName || "Recouply.ai";
  const primaryColor = branding.primary_color || "#3b82f6";
  
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
<body style="margin: 0; padding: 0; font-family: ${FONT_STACK}; background-color: #f8fafc; line-height: 1.6; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc;">
    <tr>
      <td style="padding: 32px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
          <!-- Clean Header -->
          <tr>
            <td style="padding: 24px 32px; background-color: ${primaryColor};">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    ${branding.logo_url 
                      ? `<img src="${escapeHtml(branding.logo_url)}" alt="${escapeHtml(businessName)}" style="max-height: 72px; max-width: 280px; height: auto;" />`
                      : `<span style="color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.3px; font-family: ${FONT_STACK};">${escapeHtml(businessName)}</span>`
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 32px; color: #1e293b; font-size: 14px; line-height: 1.7; font-family: ${FONT_STACK};">
              ${body}
            </td>
          </tr>
          
          ${generateRecouplyFooter(branding)}
        </table>
        
        <!-- Bottom Legal -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 12px auto 0;">
          <tr>
            <td style="text-align: center; padding: 0 16px;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8; font-family: ${FONT_STACK};">
                This email was sent by ${COMPANY_INFO.legalName} on behalf of ${escapeHtml(businessName)}.
                <br>
                Questions? <a href="mailto:${COMPANY_INFO.emails.support}" style="color: #64748b; text-decoration: none;">${COMPANY_INFO.emails.support}</a>
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

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

/**
 * Clean payment button
 */
export function generatePaymentButton(options: PaymentLinkOptions): string {
  let html = "";
  
  // Always show secure invoice view button if available
  if (options.secureInvoiceUrl) {
    html += `
    <div style="text-align: center; margin: 24px 0; padding: 20px; background-color: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
      <p style="margin: 0 0 6px; font-size: 14px; color: #1e293b; font-weight: 600; font-family: ${FONT_STACK};">
        🔒 Secure Invoice View
      </p>
      <p style="margin: 0 0 14px; font-size: 13px; color: #64748b; font-family: ${FONT_STACK};">
        View this invoice on a secure, encrypted page with payment options
      </p>
      <a href="${escapeHtml(options.secureInvoiceUrl)}" 
         style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 13px; font-weight: 600; font-family: ${FONT_STACK};">
        View Invoice &amp; Pay Securely →
      </a>
      <p style="margin: 10px 0 0; font-size: 11px; color: #64748b; font-family: ${FONT_STACK};">
        256-bit encrypted · Powered by Recouply.ai
      </p>
    </div>
    `.trim();
  }
  
  // Also show pay now button if a separate payment URL exists
  if (options.paymentUrl) {
    const amountText = options.amount 
      ? ` $${options.amount.toLocaleString()}`
      : "";
    
    html += `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${escapeHtml(options.paymentUrl)}" 
         style="display: inline-block; background-color: #22c55e; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 14px; font-weight: 600; font-family: ${FONT_STACK};">
        Pay Now${amountText}
      </a>
    </div>
    <p style="text-align: center; margin: 8px 0 0; color: #64748b; font-size: 12px; font-family: ${FONT_STACK};">
      🔒 Secure payment powered by Stripe
    </p>
    `.trim();
  }
  
  return html;
}

/**
 * Clean email signature matching site design
 */
export function generateEmailSignature(
  branding: BrandingSettings, 
  paymentOptions?: PaymentLinkOptions,
  personaName?: string
): string {
  const businessName = branding.business_name || branding.from_name || personaName || "Recouply.ai";
  
  const customSignature = branding.email_signature 
    ? `<p style="font-size: 14px; color: #374151; margin: 0 0 16px 0; white-space: pre-line; font-family: ${FONT_STACK};">${escapeHtml(branding.email_signature)}</p>`
    : "";

  const customFooter = branding.email_footer
    ? `<p style="font-size: 12px; color: #64748b; margin: 16px 0 0 0; font-family: ${FONT_STACK};">${escapeHtml(branding.email_footer)}</p>`
    : "";

  const paymentButton = paymentOptions?.paymentUrl 
    ? generatePaymentButton(paymentOptions) 
    : "";

  const logoSection = branding.logo_url 
    ? `<img 
        src="${escapeHtml(branding.logo_url)}" 
        alt="${escapeHtml(businessName)} logo" 
        style="max-width: 120px; height: auto; display: block; margin-bottom: 12px;"
      />`
    : "";

  const arPageUrl = getPublicARPageUrl(branding.ar_page_public_token);
  const arPageLink = arPageUrl && branding.ar_page_enabled
    ? `<p style="margin: 8px 0 0; font-size: 12px; font-family: ${FONT_STACK};">
        <a href="${escapeHtml(arPageUrl)}" style="color: #3b82f6; text-decoration: none; font-weight: 500;">
          View AR Portal
        </a>
        <span style="color: #64748b;"> — Invoices, payments & documents</span>
      </p>`
    : "";

  return `
    ${paymentButton}
    <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
      ${customSignature}
      ${logoSection}
      
      <!-- Sent on behalf notice – clean card -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top: 16px; background-color: #f8fafc; border-radius: 8px; width: 100%; border: 1px solid #e2e8f0;">
        <tr>
          <td style="padding: 16px;">
            <p style="margin: 0 0 4px; font-size: 13px; color: #1e293b; font-weight: 600; font-family: ${FONT_STACK};">
              Sent on behalf of ${escapeHtml(businessName)}
            </p>
            <p style="margin: 0; font-size: 12px; color: #64748b; font-family: ${FONT_STACK};">
              Powered by <a href="${COMPANY_INFO.website}" style="color: #3b82f6; text-decoration: none; font-weight: 500;">Recouply.ai</a> · ${COMPANY_INFO.tagline}
            </p>
            ${arPageLink}
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
  paymentOptions?: PaymentLinkOptions,
  personaName?: string
): string {
  const businessName = branding.business_name || branding.from_name || personaName || "Recouply.ai";
  const currentYear = new Date().getFullYear();
  
  let signature = "\n\n";
  
  if (paymentOptions?.paymentUrl) {
    const amountText = paymentOptions.amount ? ` ($${paymentOptions.amount.toLocaleString()})` : "";
    signature += `Pay Now${amountText}: ${paymentOptions.paymentUrl}\n`;
    signature += `Secure payment powered by Stripe\n\n`;
  }
  
  signature += "---\n\n";
  
  if (branding.email_signature) {
    signature += branding.email_signature + "\n\n";
  }
  
  signature += `Sent on behalf of ${businessName}\n`;
  signature += `Powered by ${COMPANY_INFO.displayName} · ${COMPANY_INFO.tagline}\n`;
  signature += `${COMPANY_INFO.website}\n\n`;
  
  const arPageUrl = getPublicARPageUrl(branding.ar_page_public_token);
  if (arPageUrl && branding.ar_page_enabled) {
    signature += `AR Portal: ${arPageUrl}\n\n`;
  }
  
  signature += `---\n`;
  signature += `© ${currentYear} ${COMPANY_INFO.legalName} · ${COMPANY_INFO.address}\n`;
  signature += `Support: ${COMPANY_INFO.emails.support}\n`;
  signature += `\n⚠️ Please reply directly to this email without changing the "To" or "Reply-To" address. Modifying the reply address may prevent your response from being received and processed.\n`;
  
  if (branding.email_footer) {
    signature += "\n" + branding.email_footer;
  }
  
  return signature;
}

function cleanupPlaceholders(text: string): string {
  if (!text) return text;
  return text.replace(/\{\{[^}]+\}\}/g, '');
}

/**
 * Generate a full branded email with content, signature, and optional payment link
 */
export function generateBrandedEmail(
  content: string,
  branding: BrandingSettings,
  paymentOptions?: PaymentLinkOptions
): string {
  const cleanContent = cleanupPlaceholders(content);
  const signature = generateEmailSignature(branding, paymentOptions);
  const emailBody = cleanContent + signature;
  return wrapEmailContent(emailBody, branding);
}

export { COMPANY_INFO };
