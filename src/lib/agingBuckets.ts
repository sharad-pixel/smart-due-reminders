/**
 * Shared aging bucket definitions and helpers.
 * Consolidates duplicate bucket logic from InvoiceDetail, Outreach, OutreachTimeline, etc.
 */

export type AgingBucketKey =
  | 'current'
  | 'dpd_1_30'
  | 'dpd_31_60'
  | 'dpd_61_90'
  | 'dpd_91_120'
  | 'dpd_121_150'
  | 'dpd_150_plus';

export interface AgingBucketDef {
  key: AgingBucketKey;
  label: string;
  fullLabel: string;
  color: string;
  minDays: number;
  maxDays: number | null;
}

/** Full bucket definitions used for UI display */
export const AGING_BUCKETS: AgingBucketDef[] = [
  { key: 'current',       label: 'Current',       fullLabel: 'Current (Not Due)',        color: 'bg-green-500',  minDays: 0,   maxDays: 0 },
  { key: 'dpd_1_30',      label: '1-30 Days',     fullLabel: '1-30 Days Past Due',       color: 'bg-yellow-500', minDays: 1,   maxDays: 30 },
  { key: 'dpd_31_60',     label: '31-60 Days',    fullLabel: '31-60 Days Past Due',      color: 'bg-orange-500', minDays: 31,  maxDays: 60 },
  { key: 'dpd_61_90',     label: '61-90 Days',    fullLabel: '61-90 Days Past Due',      color: 'bg-red-400',    minDays: 61,  maxDays: 90 },
  { key: 'dpd_91_120',    label: '91-120 Days',   fullLabel: '91-120 Days Past Due',     color: 'bg-red-500',    minDays: 91,  maxDays: 120 },
  { key: 'dpd_121_150',   label: '121-150 Days',  fullLabel: '121-150 Days Past Due',    color: 'bg-red-600',    minDays: 121, maxDays: 150 },
  { key: 'dpd_150_plus',  label: '150+ Days',     fullLabel: '150+ Days Past Due',       color: 'bg-red-700',    minDays: 151, maxDays: null },
];

/** Map from bucket key to its persona agent */
export const BUCKET_AGENT_MAP: Record<string, { name: string; key: string }> = {
  'dpd_1_30':     { name: 'Sam',   key: 'sam' },
  'dpd_31_60':    { name: 'James', key: 'james' },
  'dpd_61_90':    { name: 'Katy',  key: 'katy' },
  'dpd_91_120':   { name: 'Jimmy', key: 'jimmy' },
  'dpd_121_150':  { name: 'Troy',  key: 'troy' },
  'dpd_150_plus': { name: 'Rocco', key: 'rocco' },
};

/** Get the human-readable label for an aging bucket key */
export function getAgingBucketLabel(bucket: string): string {
  const found = AGING_BUCKETS.find(b => b.key === bucket);
  return found?.fullLabel || bucket;
}

/** Determine the aging bucket key from days past due */
export function getAgingBucketFromDays(daysPastDue: number): AgingBucketKey {
  if (daysPastDue < 0) return 'current';
  if (daysPastDue <= 30) return 'dpd_1_30';
  if (daysPastDue <= 60) return 'dpd_31_60';
  if (daysPastDue <= 90) return 'dpd_61_90';
  if (daysPastDue <= 120) return 'dpd_91_120';
  if (daysPastDue <= 150) return 'dpd_121_150';
  return 'dpd_150_plus';
}

/** Get persona key from days past due */
export function getPersonaKeyFromDays(daysPastDue: number | null | undefined): string {
  const dpd = daysPastDue ?? 0;
  if (dpd <= 0) return 'sam';
  const bucket = getAgingBucketFromDays(dpd);
  return BUCKET_AGENT_MAP[bucket]?.key || 'sam';
}

/** Statuses that represent open (unpaid) receivables. Kept in sync with OPEN_INVOICE_STATUSES. */
const OPEN_STATUS_SET = new Set(['open', 'inpaymentplan', 'partiallypaid', 'partially_paid']);

/** True when an invoice should be counted in Open AR. */
export function isOpenARInvoice(invoice: any): boolean {
  if (!invoice) return false;
  if (invoice.payment_date) return false;
  const status = String(invoice.status ?? '').toLowerCase();
  if (status && !OPEN_STATUS_SET.has(status)) return false;
  return getOpenBalance(invoice) > 0;
}

/**
 * Resolve the outstanding balance for an invoice.
 * Always prefers amount_outstanding so applied payments are reflected.
 */
export function getOpenBalance(invoice: any): number {
  const outstanding = invoice?.amount_outstanding;
  if (outstanding !== null && outstanding !== undefined && outstanding !== '') {
    return Number(outstanding) || 0;
  }
  return Number(invoice?.total_amount ?? invoice?.amount ?? 0) || 0;
}

/** Whole days past due for a due date (negative when not yet due). */
export function getDaysPastDue(dueDate: string | Date | null | undefined): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  const startOfDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((startOfDay(new Date()) - startOfDay(due)) / 86400000);
}

/**
 * Live aging bucket for an invoice, computed from due_date.
 * The stored `aging_bucket` column goes stale between trigger writes, so it is
 * only used as a fallback when no due date is available.
 */
export function resolveAgingBucket(invoice: any): AgingBucketKey {
  const dpd = getDaysPastDue(invoice?.due_date);
  if (dpd === null) {
    const stored = invoice?.aging_bucket;
    return (AGING_BUCKETS.find(b => b.key === stored)?.key as AgingBucketKey) ?? 'current';
  }
  return getAgingBucketFromDays(dpd);
}
