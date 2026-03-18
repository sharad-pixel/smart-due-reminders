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
  shortLabel: string;
  color: string;
  minDays: number;
  maxDays: number | null;
}

/** Full bucket definitions used for UI display */
export const AGING_BUCKETS: AgingBucketDef[] = [
  { key: 'current',       label: 'Current (Not Due)',        shortLabel: 'Current',    color: 'bg-green-500',  minDays: 0,   maxDays: 0 },
  { key: 'dpd_1_30',      label: '1-30 Days Past Due',      shortLabel: '1-30 Days',  color: 'bg-yellow-500', minDays: 1,   maxDays: 30 },
  { key: 'dpd_31_60',     label: '31-60 Days Past Due',     shortLabel: '31-60 Days', color: 'bg-orange-500', minDays: 31,  maxDays: 60 },
  { key: 'dpd_61_90',     label: '61-90 Days Past Due',     shortLabel: '61-90 Days', color: 'bg-red-400',    minDays: 61,  maxDays: 90 },
  { key: 'dpd_91_120',    label: '91-120 Days Past Due',    shortLabel: '91-120 Days',color: 'bg-red-500',    minDays: 91,  maxDays: 120 },
  { key: 'dpd_121_150',   label: '121-150 Days Past Due',   shortLabel: '121-150 Days',color: 'bg-red-600',   minDays: 121, maxDays: 150 },
  { key: 'dpd_150_plus',  label: '150+ Days Past Due',      shortLabel: '150+ Days',  color: 'bg-red-700',    minDays: 151, maxDays: null },
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
  return found?.label || bucket;
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
