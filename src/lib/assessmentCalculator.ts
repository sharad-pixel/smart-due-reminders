// Deterministic Collections Assessment Calculator
// All dollar values computed by code, NOT by GPT

export const COST_PER_INVOICE = 1.99;

export const AGE_BAND_OPTIONS = ["0-30", "31-60", "61-90", "91-120", "121+"] as const;
export type AgeBand = typeof AGE_BAND_OPTIONS[number];

export const LOSS_PCT_OPTIONS = ["0-5%", "6-10%", "11-20%", "21%+"] as const;
export type LossPctBand = typeof LOSS_PCT_OPTIONS[number];

export const RATE_OPTIONS = [12, 18, 24] as const;

const AGE_BAND_TO_DELAY_MONTHS: Record<AgeBand, number> = {
  "0-30": 1,
  "31-60": 2,
  "61-90": 3,
  "91-120": 4,
  "121+": 6,
};

const LOSS_PCT_MIDPOINTS: Record<LossPctBand, number> = {
  "0-5%": 0.03,
  "6-10%": 0.08,
  "11-20%": 0.15,
  "21%+": 0.25,
};

export interface AssessmentInputs {
  overdue_count: number;
  overdue_total: number;
  age_band: AgeBand;
  loss_pct_band: LossPctBand;
  annual_rate: number;
}

export interface AssessmentResults {
  recouply_cost: number;
  delay_cost: number;
  loss_risk_cost: number;
  breakeven_recovery: number;
  breakeven_pct: number;
  total_impact: number;
  roi_multiple: number;
  delay_months: number;
}

export function calculateAssessment(inputs: AssessmentInputs): AssessmentResults {
  const recouply_cost = inputs.overdue_count * COST_PER_INVOICE;
  const monthly_rate = inputs.annual_rate / 100 / 12;
  const delay_months = AGE_BAND_TO_DELAY_MONTHS[inputs.age_band];
  const delay_cost = inputs.overdue_total * monthly_rate * delay_months;
  const loss_risk_cost = inputs.overdue_total * LOSS_PCT_MIDPOINTS[inputs.loss_pct_band];
  const breakeven_recovery = recouply_cost;
  const breakeven_pct = inputs.overdue_total > 0 ? recouply_cost / inputs.overdue_total : 0;
  const total_impact = delay_cost + loss_risk_cost;
  const raw_roi = recouply_cost > 0 ? total_impact / recouply_cost : 0;
  const roi_multiple = raw_roi;

  return {
    recouply_cost,
    delay_cost,
    loss_risk_cost,
    breakeven_recovery,
    breakeven_pct,
    total_impact,
    roi_multiple,
    delay_months,
  };
}

export function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatROI(value: number): string {
  return value > 10 ? "10x+" : `${value.toFixed(1)}x`;
}
