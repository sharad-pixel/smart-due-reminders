/**
 * Email Signature Generator
 * 
 * Generates consistent email signatures for all outbound communications
 * using organization branding settings.
 */

export interface BrandingSettings {
  logo_url?: string | null;
  business_name?: string;
  from_name?: string;
  email_signature?: string;
  email_footer?: string;
}

/**
 * Generate HTML email signature with logo (if available) or text-only fallback
 */
export function generateEmailSignature(branding: BrandingSettings): string {
  const businessName = branding.business_name || branding.from_name || "Your Business";
  
  // Custom signature takes precedence if provided
  const customSignature = branding.email_signature 
    ? `<p style="font-size: 14px; color: #333; margin: 0 0 12px 0; white-space: pre-line;">${escapeHtml(branding.email_signature)}</p>`
    : "";

  // Custom footer
  const customFooter = branding.email_footer
    ? `<p style="font-size: 12px; color: #777; margin: 8px 0 0 0;">${escapeHtml(branding.email_footer)}</p>`
    : "";

  // Logo-based signature
  if (branding.logo_url) {
    return `
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e5e5;">
        ${customSignature}
        <img 
          src="${escapeHtml(branding.logo_url)}" 
          alt="${escapeHtml(businessName)} logo" 
          style="max-width: 140px; height: auto; display: block; margin-bottom: 8px;"
        />
        <p style="font-size: 12px; color: #777; margin: 8px 0 0 0;">
          Sent by Recouply.ai on behalf of ${escapeHtml(businessName)}<br/>
          Smart Collections & CashOps Automation
        </p>
        ${customFooter}
      </div>
    `.trim();
  }

  // Text-only signature (fallback)
  return `
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e5e5;">
      ${customSignature}
      <p style="font-size: 12px; color: #777; margin: 0;">
        Sent by Recouply.ai on behalf of ${escapeHtml(businessName)}<br/>
        Smart Collections & CashOps Automation
      </p>
      ${customFooter}
    </div>
  `.trim();
}

/**
 * Generate plain text email signature
 */
export function generatePlainTextSignature(branding: BrandingSettings): string {
  const businessName = branding.business_name || branding.from_name || "Your Business";
  
  let signature = "\n\n---\n";
  
  if (branding.email_signature) {
    signature += branding.email_signature + "\n\n";
  }
  
  signature += `Sent by Recouply.ai on behalf of ${businessName}\nSmart Collections & CashOps Automation`;
  
  if (branding.email_footer) {
    signature += "\n" + branding.email_footer;
  }
  
  return signature;
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
