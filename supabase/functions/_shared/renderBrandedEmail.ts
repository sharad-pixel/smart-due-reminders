/**
 * Standardized Email Rendering with Deterministic Sender Selection
 * 
 * Clean, modern design matching recouply.ai/collection-intelligence page:
 * - System font stack
 * - Blue primary (#3b82f6), Green accent (#22c55e)
 * - Clean white cards, subtle borders
 * - Professional minimal layout
 */

import { VERIFIED_EMAIL_DOMAIN, INBOUND_EMAIL_DOMAIN } from "./emailConfig.ts";

const FONT_STACK = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;

const COMPANY_INFO = {
  legalName: "RecouplyAI Inc.",
  displayName: "Recouply.ai",
  tagline: "Collections & Risk Intelligence Platform",
  website: "https://recouply.ai",
  emails: {
    collections: `collections@${INBOUND_EMAIL_DOMAIN}`,
    support: `support@${INBOUND_EMAIL_DOMAIN}`,
    notifications: `notifications@${INBOUND_EMAIL_DOMAIN}`,
  },
  address: "Delaware, USA",
} as const;

const DEFAULT_PRIMARY_COLOR = "#3b82f6";
const DEFAULT_ACCENT_COLOR = "#22c55e";

export interface BrandingConfig {
  business_name?: string | null;
  from_name?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  sending_mode?: 'recouply_default' | 'customer_domain' | 'recouply_subdomain' | null;
  from_email?: string | null;
  from_email_verified?: boolean | null;
  verified_from_email?: string | null;
  reply_to_email?: string | null;
  email_signature?: string | null;
  email_footer?: string | null;
  footer_disclaimer?: string | null;
  email_wrapper_enabled?: boolean | null;
  email_format?: 'simple' | 'enhanced' | null;
  ar_page_public_token?: string | null;
  ar_page_enabled?: boolean | null;
  stripe_payment_link?: string | null;
}

export interface EmailRenderInput {
  brand: BrandingConfig;
  subject: string;
  bodyHtml: string;
  cta?: {
    label: string;
    url: string;
  };
  secureInvoiceUrl?: string;
  meta?: {
    invoiceId?: string;
    debtorId?: string;
    agentName?: string;
    templateType?: string;
  };
}

export interface SenderIdentity {
  fromEmail: string;
  fromName: string;
  replyTo: string | null;
  sendingMode: 'recouply_default' | 'customer_domain' | 'recouply_subdomain';
  isCustomerDomainVerified: boolean;
  usedFallback: boolean;
}

export interface BrandSnapshot {
  sending_mode: string;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  primary_color: string;
  accent_color: string;
  business_name: string;
  logo_url: string | null;
  used_fallback: boolean;
  snapshot_at: string;
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

function getContrastingTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#111827' : '#ffffff';
}

/**
 * DETERMINISTIC SENDER SELECTION
 */
export function getSenderIdentity(brand: BrandingConfig): SenderIdentity {
  const fromName = brand.from_name || brand.business_name || 'Recouply';
  
  const isCustomerDomainMode = brand.sending_mode === 'customer_domain';
  const isVerified = brand.from_email_verified === true;
  const hasVerifiedEmail = !!brand.verified_from_email;
  const canUseCustomerDomain = isCustomerDomainMode && isVerified && hasVerifiedEmail;
  
  let fromEmail: string;
  let usedFallback = false;
  let effectiveSendingMode: 'recouply_default' | 'customer_domain' | 'recouply_subdomain' = 'recouply_default';
  
  if (canUseCustomerDomain) {
    fromEmail = `${fromName} <${brand.verified_from_email}>`;
    effectiveSendingMode = 'customer_domain';
  } else {
    fromEmail = `${fromName} <collections@${VERIFIED_EMAIL_DOMAIN}>`;
    usedFallback = isCustomerDomainMode;
    effectiveSendingMode = 'recouply_default';
  }
  
  const configuredReplyTo = (brand.reply_to_email || '').trim();
  const configuredDomain = configuredReplyTo.includes('@')
    ? configuredReplyTo.split('@').pop()?.toLowerCase()
    : undefined;

  const replyTo = configuredReplyTo && configuredDomain === INBOUND_EMAIL_DOMAIN
    ? configuredReplyTo
    : `support@${INBOUND_EMAIL_DOMAIN}`;

  return {
    fromEmail,
    fromName,
    replyTo,
    sendingMode: effectiveSendingMode,
    isCustomerDomainVerified: canUseCustomerDomain,
    usedFallback,
  };
}

export function captureBrandSnapshot(brand: BrandingConfig, sender: SenderIdentity): BrandSnapshot {
  return {
    sending_mode: sender.sendingMode,
    from_name: sender.fromName,
    from_email: sender.fromEmail,
    reply_to: sender.replyTo,
    primary_color: brand.primary_color || DEFAULT_PRIMARY_COLOR,
    accent_color: brand.accent_color || DEFAULT_ACCENT_COLOR,
    business_name: brand.business_name || 'Recouply.ai',
    logo_url: brand.logo_url || null,
    used_fallback: sender.usedFallback,
    snapshot_at: new Date().toISOString(),
  };
}

function getPublicARPageUrl(token: string | null | undefined): string | null {
  if (!token) return null;
  return `https://recouply.ai/ar/${token}`;
}

function generateCtaButton(cta: { label: string; url: string }, accentColor: string): string {
  const textColor = getContrastingTextColor(accentColor);
  
  return `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${escapeHtml(cta.url)}" 
         style="display: inline-block; background-color: ${accentColor}; color: ${textColor}; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: 600; font-family: ${FONT_STACK};">
        ${escapeHtml(cta.label)}
      </a>
    </div>
  `.trim();
}

/**
 * Generate a secure invoice view CTA – always included when invoice public_token is available
 */
function generateSecureInvoiceCTA(invoiceUrl: string): string {
  return `
    <div style="text-align: center; margin: 24px 0; padding: 20px; background-color: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
      <p style="margin: 0 0 6px; font-size: 14px; color: #1e293b; font-weight: 600; font-family: ${FONT_STACK};">
        🔒 Secure Invoice View
      </p>
      <p style="margin: 0 0 14px; font-size: 13px; color: #64748b; font-family: ${FONT_STACK};">
        View this invoice on a secure, encrypted page with payment options
      </p>
      <a href="${escapeHtml(invoiceUrl)}" 
         style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 13px; font-weight: 600; font-family: ${FONT_STACK};">
        View Invoice &amp; Pay Securely →
      </a>
      <p style="margin: 10px 0 0; font-size: 11px; color: #64748b; font-family: ${FONT_STACK};">
        256-bit encrypted · Powered by Recouply.ai
      </p>
    </div>
  `.trim();
}

function generatePublicARPageCTA(brand: BrandingConfig): string {
  const arPageUrl = getPublicARPageUrl(brand.ar_page_public_token);
  if (!arPageUrl || !brand.ar_page_enabled) return "";

  const businessName = brand.business_name || brand.from_name || "Our Company";

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
 * Minimal footer – subtle "Powered by recouply.ai"
 */
function generateMinimalFooter(brand: BrandingConfig): string {
  const arPageCTA = generatePublicARPageCTA(brand);
  const footerDisclaimer = brand.footer_disclaimer 
    ? `<p style="margin: 8px 0 0; font-size: 11px; color: #64748b; font-family: ${FONT_STACK};">${escapeHtml(brand.footer_disclaimer)}</p>`
    : "";
  const emailFooter = brand.email_footer
    ? `<p style="margin: 8px 0 0; font-size: 11px; color: #64748b; font-family: ${FONT_STACK};">${escapeHtml(brand.email_footer)}</p>`
    : "";
  
  return `
    <!-- Public AR Page CTA -->
    ${arPageCTA ? `<tr><td style="padding: 0 32px;">${arPageCTA}</td></tr>` : ""}
    
    <!-- Custom Footer Content -->
    ${emailFooter || footerDisclaimer ? `
    <tr>
      <td style="padding: 12px 32px;">
        ${emailFooter}
        ${footerDisclaimer}
      </td>
    </tr>
    ` : ""}
    
    <!-- Powered By Footer -->
    <tr>
      <td style="padding: 12px 32px 8px; text-align: center; border-top: 1px solid #e2e8f0;">
        <a href="https://recouply.ai/debtor-portal" style="display: inline-block; font-size: 11px; color: #64748b; text-decoration: none; font-weight: 500; margin-bottom: 4px; font-family: ${FONT_STACK};">🔒 Access Payment Portal</a>
        <br/>
        <span style="font-size: 10px; color: #94a3b8; font-family: ${FONT_STACK};">Powered by <a href="https://recouply.ai" style="color: #94a3b8; text-decoration: none; font-weight: 500;">recouply.ai</a></span>
      </td>
    </tr>
    <!-- Reply-To Tracking Notice -->
    <tr>
      <td style="padding: 4px 32px 16px; text-align: center;">
        <p style="margin: 0; font-size: 9px; color: #b0b8c4; font-family: ${FONT_STACK}; line-height: 1.4;">
          ⚠️ Please reply directly to this email without changing the "To" or "Reply-To" address. Modifying the reply address may prevent your response from being received and processed.
        </p>
      </td>
    </tr>
  `.trim();
}

function cleanupPlaceholders(text: string): string {
  if (!text) return text;
  return text.replace(/\{\{[^}]+\}\}/g, '');
}

/**
 * MAIN: Render a fully branded email – clean design
 */
export function renderBrandedEmail(input: EmailRenderInput, personaName?: string): string {
  const { brand, cta, meta, secureInvoiceUrl } = input;
  const bodyHtml = cleanupPlaceholders(input.bodyHtml);
  
  const businessName = brand.business_name || brand.from_name || personaName || "Recouply.ai";
  const primaryColor = brand.primary_color || DEFAULT_PRIMARY_COLOR;
  const accentColor = brand.accent_color || DEFAULT_ACCENT_COLOR;
  
  const signatureHtml = brand.email_signature 
    ? `<div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
        <p style="font-size: 14px; color: #374151; margin: 0; white-space: pre-line; font-family: ${FONT_STACK};">${escapeHtml(brand.email_signature)}</p>
       </div>`
    : "";
  
  const ctaHtml = cta ? generateCtaButton(cta, accentColor) : "";
  const secureInvoiceHtml = secureInvoiceUrl ? generateSecureInvoiceCTA(secureInvoiceUrl) : "";
  
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
                    ${brand.logo_url 
                      ? `<img src="${escapeHtml(brand.logo_url)}" alt="${escapeHtml(businessName)}" style="max-height: 72px; max-width: 280px; height: auto;" />`
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
              ${bodyHtml}
              ${secureInvoiceHtml}
              ${ctaHtml}
              ${signatureHtml}
            </td>
          </tr>
          
          ${generateMinimalFooter(brand)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * SIMPLE EMAIL FORMAT: Minimal HTML without branding template
 */
export function renderSimpleEmail(input: EmailRenderInput, personaName?: string): string {
  const { brand, cta, secureInvoiceUrl } = input;
  const bodyHtml = cleanupPlaceholders(input.bodyHtml);
  
  const businessName = brand.business_name || brand.from_name || personaName || "Recouply.ai";
  
  const signatureHtml = brand.email_signature 
    ? `<div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid #e2e8f0;">
        <p style="font-size: 14px; color: #374151; margin: 0; white-space: pre-line; font-family: ${FONT_STACK};">${escapeHtml(brand.email_signature)}</p>
       </div>`
    : "";
  
  const ctaHtml = cta 
    ? `<div style="margin: 20px 0;">
        <a href="${escapeHtml(cta.url)}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 600; font-family: ${FONT_STACK};">${escapeHtml(cta.label)}</a>
       </div>`
    : "";

  const secureInvoiceHtml = secureInvoiceUrl ? generateSecureInvoiceCTA(secureInvoiceUrl) : "";
  
  const footerHtml = brand.email_footer 
    ? `<p style="font-size: 12px; color: #64748b; margin: 14px 0 0; font-family: ${FONT_STACK};">${escapeHtml(brand.email_footer)}</p>`
    : "";
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Message from ${escapeHtml(businessName)}</title>
</head>
<body style="margin: 0; padding: 20px; font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.6; color: #1e293b; background-color: #ffffff;">
  <div style="max-width: 600px; margin: 0 auto;">
    ${bodyHtml}
    ${secureInvoiceHtml}
    ${ctaHtml}
    ${signatureHtml}
    ${footerHtml}
    <div style="margin-top: 28px; padding-top: 14px; border-top: 1px solid #e2e8f0; text-align: center;">
      <a href="https://recouply.ai/debtor-portal" style="display: inline-block; font-size: 11px; color: #64748b; text-decoration: none; font-weight: 500; margin-bottom: 4px; font-family: ${FONT_STACK};">🔒 Access Payment Portal</a>
      <br/>
      <span style="font-size: 10px; color: #94a3b8; font-family: ${FONT_STACK};">Powered by <a href="https://recouply.ai" style="color: #94a3b8; text-decoration: none; font-weight: 500;">recouply.ai</a></span>
      <p style="margin: 6px 0 0; font-size: 9px; color: #b0b8c4; font-family: ${FONT_STACK}; line-height: 1.4;">
        ⚠️ Please reply directly to this email without changing the "To" or "Reply-To" address. Modifying the reply address may prevent your response from being received and processed.
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

/**
 * Backwards-compatible renderer used across edge functions.
 * Respects email_format + wrapper toggle from branding settings.
 */
export function renderEmail(input: EmailRenderInput, personaName?: string): string {
  const normalizedFormat = (input.brand?.email_format || '').toString().toLowerCase();
  const wrapperDisabled = input.brand?.email_wrapper_enabled === false;

  // Simple mode (or explicit wrapper disabled) keeps email lightweight
  if (normalizedFormat === 'simple' || wrapperDisabled) {
    return renderSimpleEmail(input, personaName);
  }

  // Default to enhanced branded template
  return renderBrandedEmail(input, personaName);
}

/**
 * Generate a plain text version of the email
 */
export function renderPlainTextEmail(input: EmailRenderInput, personaName?: string): string {
  const { brand, bodyHtml, cta, secureInvoiceUrl } = input;
  const businessName = brand.business_name || brand.from_name || personaName || "Recouply.ai";
  const currentYear = new Date().getFullYear();

  // Strip HTML tags for plain text
  let plainBody = bodyHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Clean up placeholders
  plainBody = plainBody.replace(/\{\{[^}]+\}\}/g, '');

  let result = plainBody + '\n\n';

  if (secureInvoiceUrl) {
    result += `🔒 View Invoice Securely: ${secureInvoiceUrl}\n\n`;
  }

  if (cta) {
    result += `${cta.label}: ${cta.url}\n\n`;
  }

  if (brand.email_signature) {
    result += `---\n${brand.email_signature}\n\n`;
  }

  result += `---\n`;
  result += `Sent on behalf of ${businessName}\n`;
  result += `Powered by Recouply.ai · Collections & Risk Intelligence Platform\n`;
  result += `https://recouply.ai\n\n`;
  result += `© ${currentYear} RecouplyAI Inc. · Delaware, USA\n`;
  result += `\n⚠️ Please reply directly to this email without changing the "To" or "Reply-To" address. Modifying the reply address may prevent your response from being received and processed.\n`;

  if (brand.email_footer) {
    result += `\n${brand.email_footer}\n`;
  }

  return result;
}
