/**
 * Platform Email Sending Configuration
 * 
 * Recouply.ai uses centralized platform email infrastructure.
 * All emails are sent through Resend via the platform's send-email edge function.
 * No per-user email configuration is required.
 */

export interface SendingIdentity {
  senderName: string;
  senderEmail: string;
  domain: string;
  isVerified: boolean;
  useRecouplyDomain: boolean;
  replyToEmail?: string;
}

// Platform email constants
const PLATFORM_FROM_NAME = "Recouply.ai";
const PLATFORM_FROM_EMAIL = "notifications@send.inbound.services.recouply.ai";
const PLATFORM_INBOUND_DOMAIN = "inbound.services.recouply.ai";

/**
 * Get the platform sending identity
 * Always returns the Recouply.ai platform email configuration
 */
export async function getActiveSendingIdentity(): Promise<SendingIdentity> {
  return {
    senderName: PLATFORM_FROM_NAME,
    senderEmail: PLATFORM_FROM_EMAIL,
    domain: "send.inbound.services.recouply.ai",
    isVerified: true,
    useRecouplyDomain: true,
  };
}

/**
 * Generate reply-to address for invoice-level communication
 */
export function getInvoiceReplyTo(invoiceId: string): string {
  return `invoice+${invoiceId}@${PLATFORM_INBOUND_DOMAIN}`;
}

/**
 * Generate reply-to address for debtor-level communication
 */
export function getDebtorReplyTo(debtorId: string): string {
  return `debtor+${debtorId}@${PLATFORM_INBOUND_DOMAIN}`;
}

/**
 * Check if platform email is configured (always true)
 */
export async function hasVerifiedCustomDomain(): Promise<boolean> {
  // Platform email is always available
  return true;
}

/**
 * Get the platform from address with display name
 */
export function getPlatformFromAddress(): string {
  return `${PLATFORM_FROM_NAME} <${PLATFORM_FROM_EMAIL}>`;
}
