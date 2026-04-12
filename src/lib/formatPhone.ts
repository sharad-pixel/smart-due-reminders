/**
 * Formats a US phone number string into +1-XXX-XXXX format.
 * Handles 10-digit and 11-digit (with leading 1) numbers.
 * Returns original string if it can't be parsed.
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1-${digits.slice(0, 3)}-${digits.slice(3, 7)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1-${digits.slice(1, 4)}-${digits.slice(4, 8)}`;
  }
  // Return original if non-standard
  return phone;
}
