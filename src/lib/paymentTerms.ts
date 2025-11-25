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
  
  const lowerTerms = paymentTerms.toLowerCase();
  
  // Handle "Due on Receipt" or similar
  if (lowerTerms.includes("receipt") || lowerTerms.includes("due on")) {
    return 0;
  }
  
  // Extract numeric value (handles "Net 30", "NET30", "30 days", etc.)
  const match = paymentTerms.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Calculate days past due from a due date
 */
export function calculateDaysPastDue(dueDate: string | Date): number {
  const today = new Date();
  const due = new Date(dueDate);
  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Calculate aging bucket from days past due
 */
export function calculateAgingBucket(daysPastDue: number): string {
  if (daysPastDue < 0) return 'current';
  if (daysPastDue <= 30) return 'dpd_1_30';
  if (daysPastDue <= 60) return 'dpd_31_60';
  if (daysPastDue <= 90) return 'dpd_61_90';
  if (daysPastDue <= 120) return 'dpd_91_120';
  return 'dpd_121_plus';
}

/**
 * Get human-readable aging bucket label
 */
export function getAgingBucketLabel(bucket: string): string {
  const labels: Record<string, string> = {
    'current': 'Current (Not Due)',
    'dpd_1_30': '1-30 Days Past Due',
    'dpd_31_60': '31-60 Days Past Due',
    'dpd_61_90': '61-90 Days Past Due',
    'dpd_91_120': '91-120 Days Past Due',
    'dpd_121_plus': '121+ Days Past Due',
  };
  return labels[bucket] || bucket;
}

export function getPaymentTermsOptions() {
  return Object.entries(PAYMENT_TERMS).map(([key, value]) => ({
    value: key,
    label: value.label,
    days: value.days,
  }));
}
