// ═══════════════════════════════════════════════════════════════════════════
// EMAIL CONFIGURATION - DO NOT MODIFY WITHOUT VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════
// 
// ⚠️ CRITICAL: The FROM email domain MUST be verified in Resend.
// 
// Current verified domain: send.inbound.services.recouply.ai
// 
// DO NOT change this to @recouply.ai - it is NOT verified
// and emails will fail with "domain not verified" error.
//
// To change this domain:
// 1. Verify new domain in Resend dashboard (https://resend.com/domains)
// 2. Wait for DNS propagation (can take up to 48 hours)
// 3. Test with a single email before updating here
// 4. Update ALL references in this file
//
// Last verified: 2025-01-06
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verified Resend domain for sending emails
 * IMPORTANT: Only change this after verifying the new domain in Resend
 */
export const VERIFIED_EMAIL_DOMAIN = 'send.inbound.services.recouply.ai' as const;

/**
 * Inbound email domain for receiving replies
 * This is separate from the sending domain
 */
export const INBOUND_EMAIL_DOMAIN = 'inbound.services.recouply.ai' as const;

/**
 * Pre-configured FROM email addresses using verified domain
 * All outbound emails MUST use one of these addresses
 */
export const EMAIL_CONFIG = {
  // VERIFIED FROM ADDRESSES - DO NOT CHANGE WITHOUT RESEND VERIFICATION
  FROM_COLLECTIONS: `Recouply <collections@${VERIFIED_EMAIL_DOMAIN}>`,
  FROM_NOTIFICATIONS: `Recouply <notifications@${VERIFIED_EMAIL_DOMAIN}>`,
  FROM_SUPPORT: `Recouply Support <support@${VERIFIED_EMAIL_DOMAIN}>`,
  FROM_NOREPLY: `Recouply <noreply@${VERIFIED_EMAIL_DOMAIN}>`,
  
  // Reply-to addresses can use any domain (doesn't need verification)
  REPLY_TO_SUPPORT: 'support@recouply.ai',
  REPLY_TO_COLLECTIONS: 'collections@recouply.ai',
} as const;

/**
 * Generate a branded FROM address using the verified domain
 * @param businessName - The business name to use in the FROM field
 * @param emailPrefix - The email prefix (collections, notifications, support)
 */
export function getVerifiedFromAddress(
  businessName: string = 'Recouply',
  emailPrefix: 'collections' | 'notifications' | 'support' | 'noreply' = 'collections'
): string {
  return `${businessName} <${emailPrefix}@${VERIFIED_EMAIL_DOMAIN}>`;
}

/**
 * Generate a reply-to address for invoice tracking
 * @param invoiceId - The invoice ID for routing responses
 */
export function getInvoiceReplyToAddress(invoiceId: string): string {
  return `invoice+${invoiceId}@${INBOUND_EMAIL_DOMAIN}`;
}

/**
 * Generate a reply-to address for debtor tracking
 * @param debtorId - The debtor ID for routing responses
 */
export function getDebtorReplyToAddress(debtorId: string): string {
  return `debtor+${debtorId}@${INBOUND_EMAIL_DOMAIN}`;
}

/**
 * Helper function to send email via Resend API
 * Uses the verified domain automatically
 */
export async function sendEmailViaResend(params: {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: params.from || EMAIL_CONFIG.FROM_COLLECTIONS,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        reply_to: params.replyTo || EMAIL_CONFIG.REPLY_TO_SUPPORT,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[EMAIL] Resend API error:', errorText);
      return { success: false, error: errorText };
    }

    const result = await response.json();
    return { success: true, id: result.id };
  } catch (error) {
    console.error('[EMAIL] Failed to send email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
