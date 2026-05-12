/**
 * Derive MRR / ARR / ACV / TCV from a contract's extracted fields.
 * Handles cases where the extractor stored fee components (subscription_fees,
 * platform_fees, one_time_fees, professional_services_fees) instead of explicit
 * MRR/ARR/ACV values.
 */

export interface ExtractedField {
  field_group?: string | null;
  field_key: string;
  field_value: string | null;
}

export interface ContractTimeframe {
  term_start_date?: string | null;
  term_end_date?: string | null;
  effective_date?: string | null;
}

export interface ContractTotals {
  mrr: number;
  arr: number;
  acv: number;
  tcv: number;
  currency: string;
  termYears: number;
}

const RECURRING_KEYS = new Set([
  "subscription_fees",
  "platform_fees",
  "recurring_fees",
  "saas_fees",
  "license_fees",
]);

const ONE_TIME_KEYS = new Set([
  "one_time_fees",
  "professional_services_fees",
  "implementation_fees",
  "setup_fees",
  "onboarding_fees",
]);

export const AMOUNT_KEYS = new Set<string>([
  "mrr",
  "arr",
  "acv",
  "tcv",
  "contract_value",
  "total_value",
  "monthly_fee",
  "annual_fee",
  "late_fee",
  "discount",
  "cap",
  ...RECURRING_KEYS,
  ...ONE_TIME_KEYS,
]);

export const toNumber = (v: unknown): number => {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : 0;
};

const parseInitialTermYears = (raw: string | null | undefined): number => {
  if (!raw) return 0;
  const s = String(raw).toLowerCase();
  const num = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (!isFinite(num) || num <= 0) return 0;
  if (s.includes("month")) return num / 12;
  if (s.includes("day")) return num / 365;
  return num; // assume years
};

const yearsBetween = (start?: string | null, end?: string | null): number => {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!isFinite(s) || !isFinite(e) || e <= s) return 0;
  return (e - s) / (1000 * 60 * 60 * 24 * 365.25);
};

export function computeContractTotals(
  fields: ExtractedField[],
  contract?: ContractTimeframe,
): ContractTotals {
  let mrr = 0;
  let arr = 0;
  let acv = 0;
  let tcv = 0;
  let monthlyFee = 0;
  let annualFee = 0;
  let recurringSum = 0;
  let oneTimeSum = 0;
  let initialTermYears = 0;
  let currency = "USD";

  for (const f of fields) {
    const key = f.field_key;
    const val = f.field_value;
    if (key === "currency" && val) currency = val;
    else if (key === "initial_term") initialTermYears = parseInitialTermYears(val);
    else if (key === "mrr") mrr = Math.max(mrr, toNumber(val));
    else if (key === "arr") arr = Math.max(arr, toNumber(val));
    else if (key === "acv") acv = Math.max(acv, toNumber(val));
    else if (key === "tcv" || key === "contract_value" || key === "total_value")
      tcv = Math.max(tcv, toNumber(val));
    else if (key === "monthly_fee") monthlyFee = Math.max(monthlyFee, toNumber(val));
    else if (key === "annual_fee") annualFee = Math.max(annualFee, toNumber(val));
    else if (RECURRING_KEYS.has(key)) recurringSum += toNumber(val);
    else if (ONE_TIME_KEYS.has(key)) oneTimeSum += toNumber(val);
  }

  const termYears =
    initialTermYears ||
    yearsBetween(contract?.term_start_date, contract?.term_end_date) ||
    yearsBetween(contract?.effective_date, contract?.term_end_date) ||
    0;

  // Derive MRR / ARR from explicit fees if not provided
  if (mrr === 0 && monthlyFee > 0) mrr = monthlyFee;
  if (arr === 0 && annualFee > 0) arr = annualFee;

  // Derive ARR from recurring fees + term length (recurring fees are typically total over term)
  if (arr === 0 && recurringSum > 0 && termYears > 0) {
    arr = recurringSum / termYears;
  }
  if (arr === 0 && mrr > 0) arr = mrr * 12;
  if (mrr === 0 && arr > 0) mrr = arr / 12;
  if (acv === 0 && arr > 0) acv = arr;

  // TCV fallback: sum of recurring + one-time, or arr * termYears + one-time
  if (tcv === 0) {
    if (recurringSum > 0 || oneTimeSum > 0) {
      tcv = recurringSum + oneTimeSum;
    } else if (arr > 0 && termYears > 0) {
      tcv = arr * termYears + oneTimeSum;
    }
  }

  return { mrr, arr, acv, tcv, currency, termYears };
}
