/**
 * Standardized Email Rendering with Deterministic Sender Selection
 * 
 * This module provides:
 * 1. A single standardized email wrapper for all outbound emails
 * 2. Deterministic sender selection based on branding settings
 * 3. Brand snapshot capture for auditing
 */

import { VERIFIED_EMAIL_DOMAIN, INBOUND_EMAIL_DOMAIN } from "./emailConfig.ts";

// Company Information - use INBOUND_EMAIL_DOMAIN for reply-capable addresses
const COMPANY_INFO = {
  legalName: "RecouplyAI Inc.",
  displayName: "Recouply.ai",
  tagline: "Collection Intelligence Platform",
  website: "https://recouply.ai",
  emails: {
    // Use inbound domain for emails that might receive replies
    collections: `collections@${INBOUND_EMAIL_DOMAIN}`,
    support: `support@${INBOUND_EMAIL_DOMAIN}`,
    notifications: `notifications@${INBOUND_EMAIL_DOMAIN}`,
  },
  address: "Delaware, USA",
} as const;

// Default colors - using site's light theme blue and green
const DEFAULT_PRIMARY_COLOR = "#3b82f6";
const DEFAULT_ACCENT_COLOR = "#22c55e";

export interface BrandingConfig {
  // Identity
  business_name?: string | null;
  from_name?: string | null;
  logo_url?: string | null;
  
  // Colors
  primary_color?: string | null;
  accent_color?: string | null;
  
  // Sender identity
  sending_mode?: 'recouply_default' | 'customer_domain' | 'recouply_subdomain' | null;
  from_email?: string | null;
  from_email_verified?: boolean | null;
  verified_from_email?: string | null;
  reply_to_email?: string | null;
  
  // Content
  email_signature?: string | null;
  email_footer?: string | null;
  footer_disclaimer?: string | null;
  email_wrapper_enabled?: boolean | null;
  
  // Email format preference
  email_format?: 'simple' | 'enhanced' | null;
  
  // Public AR page
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
 * Check if a color has acceptable contrast for button text
 * Simple luminance check - if too dark, text should be white; if too light, text should be dark
 */
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
 * 
 * Rules:
 * 1. If sending_mode = 'customer_domain' AND from_email_verified = true AND verified_from_email exists:
 *    → Use verified_from_email as From
 * 2. Otherwise:
 *    → Use platform verified sender: collections@send.inbound.services.recouply.ai
 * 
 * Always set Reply-To:
 * - Prefer reply_to_email if present
 * - Else from_email if present
 * - Else null
 */
export function getSenderIdentity(brand: BrandingConfig): SenderIdentity {
  const fromName = brand.from_name || brand.business_name || 'Recouply';
  
  // Check if customer domain is properly verified
  const isCustomerDomainMode = brand.sending_mode === 'customer_domain';
  const isVerified = brand.from_email_verified === true;
  const hasVerifiedEmail = !!brand.verified_from_email;
  
  const canUseCustomerDomain = isCustomerDomainMode && isVerified && hasVerifiedEmail;
  
  let fromEmail: string;
  let usedFallback = false;
  let effectiveSendingMode: 'recouply_default' | 'customer_domain' | 'recouply_subdomain' = 'recouply_default';
  
  if (canUseCustomerDomain) {
    // Use verified customer domain email
    fromEmail = `${fromName} <${brand.verified_from_email}>`;
    effectiveSendingMode = 'customer_domain';
  } else {
    // Fallback to platform verified sender
    fromEmail = `${fromName} <collections@${VERIFIED_EMAIL_DOMAIN}>`;
    usedFallback = isCustomerDomainMode; // Mark as fallback if they wanted custom but couldn't use it
    effectiveSendingMode = 'recouply_default';
  }
  
  // Determine reply-to.
  // CRITICAL: For deliverability + inbound routing, Reply-To must be on the INBOUND_EMAIL_DOMAIN.
  // If a non-inbound address is configured, ignore it and fall back to support@INBOUND_EMAIL_DOMAIN.
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

/**
 * Generate brand snapshot for auditing
 */
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

/**
 * Get the public AR page URL
 */
function getPublicARPageUrl(token: string | null | undefined): string | null {
  if (!token) return null;
  return `https://recouply.ai/ar/${token}`;
}

/**
 * Generate CTA Button HTML
 */
function generateCtaButton(cta: { label: string; url: string }, accentColor: string): string {
  const textColor = getContrastingTextColor(accentColor);
  
  return `
    <div style="text-align: center; margin: 28px 0;">
      <a href="${escapeHtml(cta.url)}" 
         style="display: inline-block; background: ${accentColor}; color: ${textColor}; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
        ${escapeHtml(cta.label)}
      </a>
    </div>
  `.trim();
}

/**
 * Generate Public AR Page CTA section
 */
function generatePublicARPageCTA(brand: BrandingConfig): string {
  const arPageUrl = getPublicARPageUrl(brand.ar_page_public_token);
  if (!arPageUrl || !brand.ar_page_enabled) return "";

  const businessName = brand.business_name || brand.from_name || "Our Company";

  return `
    <div style="text-align: center; margin: 24px 0; padding: 24px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; border: 1px solid #93c5fd;">
      <p style="margin: 0 0 8px; font-size: 16px; color: #1e40af; font-weight: 600;">
        📄 ${escapeHtml(businessName)} Accounts Receivable Portal
      </p>
      <p style="margin: 0 0 16px; font-size: 13px; color: #3b82f6;">
        View payment options, download invoices, and access important documents
      </p>
      <a href="${escapeHtml(arPageUrl)}" 
         style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);">
        Visit AR Portal →
      </a>
    </div>
  `.trim();
}

/**
 * Generate minimal footer - just subtle "Powered by recouply.ai"
 */
function generateMinimalFooter(brand: BrandingConfig): string {
  const arPageCTA = generatePublicARPageCTA(brand);
  const footerDisclaimer = brand.footer_disclaimer 
    ? `<p style="margin: 12px 0 0; font-size: 11px; color: #64748b;">${escapeHtml(brand.footer_disclaimer)}</p>`
    : "";
  const emailFooter = brand.email_footer
    ? `<p style="margin: 12px 0 0; font-size: 11px; color: #64748b;">${escapeHtml(brand.email_footer)}</p>`
    : "";
  
  return `
    <!-- Public AR Page CTA -->
    ${arPageCTA ? `<tr><td style="padding: 0 36px;">${arPageCTA}</td></tr>` : ""}
    
    <!-- Custom Footer Content -->
    ${emailFooter || footerDisclaimer ? `
    <tr>
      <td style="padding: 16px 36px;">
        ${emailFooter}
        ${footerDisclaimer}
      </td>
    </tr>
    ` : ""}
    
    <!-- Subtle Powered By Footer with Payment Portal -->
    <tr>
      <td style="padding: 16px 36px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
        <a href="https://recouply.ai/debtor-portal" style="display: inline-block; font-size: 11px; color: #6b7280; text-decoration: none; font-weight: 500; margin-bottom: 6px;">🔒 Access Payment Portal</a>
        <br/>
        <span style="font-size: 10px; color: #9ca3af;">Powered by <a href="https://recouply.ai" style="color: #9ca3af; text-decoration: none; font-weight: 500;">recouply.ai</a></span>
      </td>
    </tr>
  `.trim();
}

/**
 * Clean up any remaining placeholders from content
 * This is a safety net to ensure no {{variable}} patterns slip through
 */
function cleanupPlaceholders(text: string): string {
  if (!text) return text;
  // Remove any remaining {{...}} placeholders
  return text.replace(/\{\{[^}]+\}\}/g, '');
}

/**
 * MAIN FUNCTION: Render a fully branded email
 * 
 * This is the single standardized wrapper used by ALL outbound email sending.
 * Automatically cleans up any remaining placeholders as a safety net.
 */
export function renderBrandedEmail(input: EmailRenderInput, personaName?: string): string {
  const { brand, cta, meta } = input;
  
  // Clean up any remaining placeholders as safety net
  const bodyHtml = cleanupPlaceholders(input.bodyHtml);
  
  const businessName = brand.business_name || brand.from_name || personaName || "Recouply.ai";
  const primaryColor = brand.primary_color || DEFAULT_PRIMARY_COLOR;
  const accentColor = brand.accent_color || DEFAULT_ACCENT_COLOR;
  
  // Custom signature if provided
  const signatureHtml = brand.email_signature 
    ? `<div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
        <p style="font-size: 14px; color: #374151; margin: 0; white-space: pre-line;">${escapeHtml(brand.email_signature)}</p>
       </div>`
    : "";
  
  // CTA button if provided
  const ctaHtml = cta ? generateCtaButton(cta, accentColor) : "";
  
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
            <td style="padding: 28px 36px; background: linear-gradient(135deg, ${primaryColor} 0%, ${lightenColor(primaryColor, 20)} 100%);">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    ${brand.logo_url 
                      ? `<img src="${escapeHtml(brand.logo_url)}" alt="${escapeHtml(businessName)}" style="max-height: 52px; max-width: 200px; height: auto;" />`
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
              ${bodyHtml}
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
 * Lighten a hex color for gradient effect
 */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

/**
 * SIMPLE EMAIL FORMAT: Minimal HTML without branding template
 * Used when email_format = 'simple'
 * Automatically cleans up any remaining placeholders as a safety net.
 */
export function renderSimpleEmail(input: EmailRenderInput, personaName?: string): string {
  const { brand, cta } = input;
  
  // Clean up any remaining placeholders as safety net
  const bodyHtml = cleanupPlaceholders(input.bodyHtml);
  
  const businessName = brand.business_name || brand.from_name || personaName || "Recouply.ai";
  
  // Simple signature
  const signatureHtml = brand.email_signature 
    ? `<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 14px; color: #374151; margin: 0; white-space: pre-line;">${escapeHtml(brand.email_signature)}</p>
       </div>`
    : "";
  
  // Simple CTA button
  const ctaHtml = cta 
    ? `<div style="margin: 24px 0;">
        <a href="${escapeHtml(cta.url)}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">${escapeHtml(cta.label)}</a>
       </div>`
    : "";
  
  // Simple footer
  const footerHtml = brand.email_footer 
    ? `<p style="font-size: 12px; color: #6b7280; margin: 16px 0 0;">${escapeHtml(brand.email_footer)}</p>`
    : "";
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Message from ${escapeHtml(businessName)}</title>
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; background-color: #ffffff;">
  <div style="max-width: 600px; margin: 0 auto;">
    ${bodyHtml}
    ${ctaHtml}
    ${signatureHtml}
    ${footerHtml}
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
      <a href="https://recouply.ai/debtor-portal" style="display: inline-block; font-size: 11px; color: #6b7280; text-decoration: none; font-weight: 500; margin-bottom: 6px;">🔒 Access Payment Portal</a>
      <br/>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 4px auto 0;">
        <tr>
          <td style="padding-right: 5px; vertical-align: middle;">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;color:#9ca3af;"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/></svg>
          </td>
          <td style="vertical-align: middle;">
            <span style="font-size: 10px; color: #9ca3af;">Powered by <a href="https://recouply.ai" style="color: #6b7280; text-decoration: none; font-weight: 600;">Recouply.ai</a></span>
          </td>
        </tr>
      </table>
    </div>
  </div>
</body>
</html>`.trim();
}

/**
 * Generate a plain text version of the email
 */
export function renderPlainTextEmail(input: EmailRenderInput, personaName?: string): string {
  const { brand, bodyHtml, cta } = input;
  const businessName = brand.business_name || brand.from_name || personaName || "Recouply.ai";
  const currentYear = new Date().getFullYear();
  
  // Strip HTML tags (simple approach)
  const plainBody = bodyHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
  
  let text = plainBody;
  
  if (cta) {
    text += `\n\n${cta.label}: ${cta.url}`;
  }
  
  if (brand.email_signature) {
    text += `\n\n---\n${brand.email_signature}`;
  }
  
  text += `\n\n---`;
  text += `\nPowered by recouply.ai`;
  
  if (brand.ar_page_enabled && brand.ar_page_public_token) {
    text += `\n\n📄 AR Portal: https://recouply.ai/ar/${brand.ar_page_public_token}`;
  }
  
  return text;
}

/**
 * SMART EMAIL RENDERER: Automatically chooses format based on brand settings
 */
export function renderEmail(input: EmailRenderInput): string {
  const emailFormat = input.brand.email_format || 'enhanced';
  
  if (emailFormat === 'simple') {
    return renderSimpleEmail(input);
  }
  
  return renderBrandedEmail(input);
}
