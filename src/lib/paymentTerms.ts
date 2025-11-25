export const PAYMENT_TERMS = {
  DUE_ON_RECEIPT: { label: "Due on Receipt", days: 0 },
  NET15: { label: "NET 15", days: 15 },
  NET30: { label: "NET 30", days: 30 },
  NET45: { label: "NET 45", days: 45 },
  NET60: { label: "NET 60", days: 60 },
  CUSTOM: { label: "Custom", days: null },
} as const;

export type PaymentTermsKey = keyof typeof PAYMENT_TERMS;

export function calculateDueDate(issueDate: string, paymentTermsDays: number): string {
  const date = new Date(issueDate);
  date.setDate(date.getDate() + paymentTermsDays);
  return date.toISOString().split('T')[0];
}

/**
 * Calculate due date from issue date and payment terms string
 */
export function calculateDueDateFromTerms(issueDate: string, paymentTerms: string): string {
  const days = extractDaysFromPaymentTerms(paymentTerms);
  return calculateDueDate(issueDate, days);
}

/**
 * Extract days from payment terms string
 */
export function extractDaysFromPaymentTerms(paymentTerms: string): number {
  if (!paymentTerms) return 0;
  
  if (paymentTerms.toLowerCase().includes("receipt")) {
    return 0;
  }
  
  const match = paymentTerms.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

export function getPaymentTermsOptions() {
  return Object.entries(PAYMENT_TERMS).map(([key, value]) => ({
    value: key,
    label: value.label,
    days: value.days,
  }));
}
