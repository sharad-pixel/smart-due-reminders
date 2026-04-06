// Deterministic Collections Assessment Calculator
// All dollar values computed by code, NOT by GPT

export const COST_PER_INVOICE = 1.99;

// Employee overhead benchmarks (from CostComparisonSection)
export const COLLECTOR_SALARY_LOW = 55000;
export const COLLECTOR_SALARY_HIGH = 75000;
export const COLLECTOR_FULLY_LOADED_LOW = 75000;
export const COLLECTOR_FULLY_LOADED_HIGH = 95000;
export const COLLECTOR_FULLY_LOADED_MID = 85000; // midpoint for calculations

export const AGE_BAND_OPTIONS = ["0-30", "31-60", "61-90", "91-120", "121+"] as const;
export type AgeBand = typeof AGE_BAND_OPTIONS[number];

export const LOSS_PCT_OPTIONS = ["0-5%", "6-10%", "11-20%", "21%+"] as const;
export type LossPctBand = typeof LOSS_PCT_OPTIONS[number];

export const RATE_OPTIONS = [12, 18, 24] as const;

export const COLLECTOR_COUNT_OPTIONS = [
  { label: "0 (no dedicated staff)", value: 0 },
  { label: "1", value: 1 },
  { label: "2–3", value: 2.5 },
  { label: "4–5", value: 4.5 },
  { label: "6+", value: 6 },
] as const;

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
  collector_count: number;
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
  // Employee cost modeling
  annual_employee_cost: number;
  annual_recouply_cost: number;
  annual_savings: number;
  savings_pct: number;
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

  // Employee cost modeling
  const annual_employee_cost = inputs.collector_count * COLLECTOR_FULLY_LOADED_MID;
  const annual_recouply_cost = recouply_cost * 12; // monthly cost × 12
  const annual_savings = Math.max(0, annual_employee_cost - annual_recouply_cost);
  const savings_pct = annual_employee_cost > 0 ? annual_savings / annual_employee_cost : 0;

  return {
    recouply_cost,
    delay_cost,
    loss_risk_cost,
    breakeven_recovery,
    breakeven_pct,
    total_impact,
    roi_multiple,
    delay_months,
    annual_employee_cost,
    annual_recouply_cost,
    annual_savings,
    savings_pct,
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
