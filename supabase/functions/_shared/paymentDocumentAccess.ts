export function isPaymentDocumentAvailable(document: { status: string; expires_at: string | null }, now = new Date()): boolean {
  if (["rejected", "expired"].includes(document.status)) return false;
  if (!document.expires_at) return true;
  const expiry = new Date(document.expires_at).getTime();
  return Number.isFinite(expiry) && expiry > now.getTime();
}