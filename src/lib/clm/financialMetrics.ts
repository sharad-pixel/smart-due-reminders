/**
 * Finance-grade SaaS contract metrics engine.
 *
 * Single source of truth for MRR / ARR / ACV / TCV. Pure functions so the same
 * logic can run client-side (this file) and server-side (mirrored in the
 * `_shared/contractMetrics.ts` edge function module).
 *
 * Inputs accepted (in priority order):
 *   1. Structured `commercial.recurring_components[]` rows from the extractor
 *      (each tagged with cadence + category — unambiguous).
 *   2. Invoice schedule rows.
 *   3. Explicit MRR / ARR / ACV / TCV fields (only if internally consistent).
 *   4. Legacy flat fee fields (`recurring_fees`, `subscription_fees`, etc.) —
 *      treated as best-effort with warnings.
 *
 * Output is deterministic and includes provenance via `source` + `warnings`.
 */

export type Cadence =
  | "monthly"
  | "quarterly"
  | "annual"
  | "one_time"
  | "term_total";

export type ComponentCategory =
  | "subscription"
  | "platform"
  | "support"
  | "maintenance"
  | "usage_minimum"
  | "license"
  | "professional_services"
  | "implementation"
  | "onboarding"
  | "training"
  | "hardware"
  | "other";

export interface RecurringComponent {
  label?: string;
  amount: number;
  cadence: Cadence;
  category: ComponentCategory;
  service_period_start?: string | null;
  service_period_end?: string | null;
}

export interface RampYear {
  year: number;
  mrr?: number;
  arr?: number;
}

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

export interface InvoiceScheduleRow {
  amount?: number | string | null;
  currency?: string | null;
  billing_type?: string | null;
  scheduled_date?: string | null;
  service_period_start?: string | null;
  service_period_end?: string | null;
  description?: string | null;
}

export type MetricsSource =
  | "components"
  | "invoice_schedule"
  | "explicit_overrides"
  | "legacy_fallback"
  | "contract_value_only"
  | "empty";

export interface ContractTotals {
  mrr: number;
  arr: number;
  acv: number;
  currentAcv: number;
  peakAcv: number;
  weightedAcv: number;
  tcv: number;
  recurringTcv: number;
  servicesTcv: number;
  oneTimeTcv: number;
  currency: string;
  termMonths: number;
  termYears: number;
  source: MetricsSource;
  warnings: string[];
  ramp?: RampYear[];
}

// ---------- Category buckets (matches the spec) ----------

const RECURRING_CATEGORIES = new Set<ComponentCategory>([
  "subscription",
  "platform",
  "support",
  "maintenance",
  "usage_minimum",
  "license",
]);

const ONE_TIME_CATEGORIES = new Set<ComponentCategory>([
  "professional_services",
  "implementation",
  "onboarding",
  "training",
  "hardware",
  "other",
]);

// Keyword-based classifier used when a line item's category is missing
// (extractor fallback + invoice schedule rows).
const KEYWORD_TO_CATEGORY: Array<[RegExp, ComponentCategory]> = [
  [/profess?ional[\s_-]*serv/i, "professional_services"],
  [/\bps\b/i, "professional_services"],
  [/implement/i, "implementation"],
  [/onboard|kickoff|kick-?off/i, "onboarding"],
  [/train/i, "training"],
  [/hardware|device|appliance/i, "hardware"],
  [/support/i, "support"],
  [/maint/i, "maintenance"],
  [/license|seat/i, "license"],
  [/usage[\s_-]*(min|commit)/i, "usage_minimum"],
  [/overage/i, "other"],
  [/platform|access fee/i, "platform"],
  [/subscription|saas|recurring|monthly|annual fee/i, "subscription"],
];

const CADENCE_KEYWORDS: Array<[RegExp, Cadence]> = [
  [/month/i, "monthly"],
  [/quarter|qtr/i, "quarterly"],
  [/year|annual|annum|yr/i, "annual"],
  [/one[\s_-]?time|setup|kickoff|implementation|onboarding/i, "one_time"],
];

const FIELD_KEY_HINTS: Record<string, { category: ComponentCategory; cadence?: Cadence }> = {
  subscription_fees: { category: "subscription" },
  platform_fees: { category: "platform" },
  saas_fees: { category: "subscription" },
  license_fees: { category: "license" },
  recurring_fees: { category: "subscription" },
  monthly_fee: { category: "subscription", cadence: "monthly" },
  annual_fee: { category: "subscription", cadence: "annual" },
  professional_services_fees: { category: "professional_services", cadence: "one_time" },
  implementation_fees: { category: "implementation", cadence: "one_time" },
  onboarding_fees: { category: "onboarding", cadence: "one_time" },
  setup_fees: { category: "implementation", cadence: "one_time" },
  one_time_fees: { category: "other", cadence: "one_time" },
};

// Legacy parser keeps surfacing these — used only by callers that want raw values.
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
  "subscription_fees",
  "platform_fees",
  "recurring_fees",
  "saas_fees",
  "license_fees",
  "one_time_fees",
  "professional_services_fees",
  "implementation_fees",
  "setup_fees",
  "onboarding_fees",
]);

// ---------- Helpers ----------

export const toNumber = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : 0;
};

const parseTermMonthsFromText = (raw: string | null | undefined): number => {
  if (!raw) return 0;
  const s = String(raw).toLowerCase();
  const num = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (!isFinite(num) || num <= 0) return 0;
  if (s.includes("month")) return num;
  if (s.includes("day")) return num / 30;
  if (s.includes("week")) return num / 4.345;
  // "1 year", "3 yr", or bare numbers → years
  return num * 12;
};

const monthsBetween = (start?: string | null, end?: string | null): number => {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!isFinite(s) || !isFinite(e) || e <= s) return 0;
  return (e - s) / (1000 * 60 * 60 * 24 * 30.4375);
};

const cadenceToMonths = (c: Cadence): number => {
  switch (c) {
    case "monthly": return 1;
    case "quarterly": return 3;
    case "annual": return 12;
    case "one_time": return 0;
    case "term_total": return 0;
  }
};

const normalizeToMonthly = (
  amount: number,
  cadence: Cadence,
  termMonths: number,
): number => {
  if (!isFinite(amount) || amount <= 0) return 0;
  switch (cadence) {
    case "monthly": return amount;
    case "quarterly": return amount / 3;
    case "annual": return amount / 12;
    case "term_total":
      return termMonths > 0 ? amount / termMonths : 0;
    case "one_time":
      return 0;
  }
};

const classifyByKeyword = (label?: string | null): ComponentCategory => {
  const s = String(label || "");
  for (const [re, cat] of KEYWORD_TO_CATEGORY) {
    if (re.test(s)) return cat;
  }
  return "other";
};

const guessCadence = (label?: string | null): Cadence | null => {
  const s = String(label || "");
  for (const [re, cad] of CADENCE_KEYWORDS) {
    if (re.test(s)) return cad;
  }
  return null;
};

const componentTotalOverTerm = (
  c: RecurringComponent,
  termMonths: number,
): number => {
  if (c.amount <= 0) return 0;
  switch (c.cadence) {
    case "monthly": return c.amount * termMonths;
    case "quarterly": return (c.amount / 3) * termMonths;
    case "annual": return (c.amount / 12) * termMonths;
    case "term_total": return c.amount;
    case "one_time": return c.amount;
  }
};

// ---------- Public API ----------

export interface ComputeOptions {
  /** Pre-parsed components (highest priority). */
  components?: RecurringComponent[];
  /** Invoice schedule rows from the extractor. */
  schedule?: InvoiceScheduleRow[];
  /** Optional ramp schedule from the extractor. */
  ramp?: RampYear[];
  /** Optional explicit canonical term in months (overrides date math). */
  termMonths?: number;
}

export function computeContractTotals(
  fields: ExtractedField[],
  contract?: ContractTimeframe,
  options: ComputeOptions = {},
): ContractTotals {
  const warnings: string[] = [];

  // ---- Pull raw scalars from extracted fields ----
  let explicitMrr = 0;
  let explicitArr = 0;
  let explicitAcv = 0;
  let explicitTcv = 0;
  let contractValueOnly = 0;
  let monthlyFee = 0;
  let annualFee = 0;
  let currency = "USD";
  let termMonthsField = 0;

  const legacyComponents: RecurringComponent[] = [];

  for (const f of fields) {
    const k = f.field_key;
    const v = f.field_value;
    if (!k) continue;
    if (k === "currency" && v) currency = v;
    else if (k === "initial_term") termMonthsField = parseTermMonthsFromText(v);
    else if (k === "term_months") termMonthsField = toNumber(v);
    else if (k === "mrr") explicitMrr = Math.max(explicitMrr, toNumber(v));
    else if (k === "arr") explicitArr = Math.max(explicitArr, toNumber(v));
    else if (k === "acv") explicitAcv = Math.max(explicitAcv, toNumber(v));
    else if (k === "tcv") explicitTcv = Math.max(explicitTcv, toNumber(v));
    else if (k === "contract_value" || k === "total_value")
      contractValueOnly = Math.max(contractValueOnly, toNumber(v));
    else if (k === "monthly_fee") monthlyFee = Math.max(monthlyFee, toNumber(v));
    else if (k === "annual_fee") annualFee = Math.max(annualFee, toNumber(v));
    else if (FIELD_KEY_HINTS[k]) {
      const amt = toNumber(v);
      if (amt > 0) {
        const hint = FIELD_KEY_HINTS[k];
        legacyComponents.push({
          label: k,
          amount: amt,
          category: hint.category,
          // Cadence unknown for legacy fee buckets → resolved later in fallback.
          cadence: hint.cadence ?? ("term_total" as Cadence),
        });
      }
    }
  }

  // ---- Term in months ----
  const termFromDates =
    monthsBetween(contract?.term_start_date, contract?.term_end_date) ||
    monthsBetween(contract?.effective_date, contract?.term_end_date);
  const termMonths = Math.max(
    0,
    options.termMonths || termMonthsField || termFromDates || 0,
  );
  const termYears = termMonths > 0 ? termMonths / 12 : 0;

  // ---- Path 1: structured components from extractor (preferred) ----
  if (options.components && options.components.length > 0) {
    return finalize(options.components, contractValueOnly, currency, termMonths, termYears, "components", warnings, options.ramp);
  }

  // ---- Path 2: invoice schedule rows (very reliable when present) ----
  if (options.schedule && options.schedule.length > 0) {
    const fromSchedule = componentsFromSchedule(options.schedule, termMonths);
    if (fromSchedule.length > 0) {
      return finalize(fromSchedule, contractValueOnly, currency, termMonths, termYears, "invoice_schedule", warnings, options.ramp);
    }
  }

  // ---- Path 3: explicit MRR/ARR/ACV/TCV if internally consistent ----
  if (explicitMrr > 0 || explicitArr > 0 || explicitAcv > 0 || explicitTcv > 0) {
    const consistent =
      explicitMrr > 0 && explicitArr > 0
        ? Math.abs(explicitArr - explicitMrr * 12) / Math.max(explicitArr, 1) < 0.05
        : true;
    if (consistent) {
      const mrr = explicitMrr || (explicitArr > 0 ? explicitArr / 12 : 0);
      const arr = explicitArr || mrr * 12;
      const acv = explicitAcv || arr;
      const recurringTcv = termYears > 0 ? arr * termYears : explicitTcv;
      const tcv = explicitTcv || recurringTcv;
      const servicesTcv = Math.max(0, tcv - recurringTcv);
      return {
        mrr,
        arr,
        acv,
        currentAcv: acv,
        peakAcv: acv,
        weightedAcv: acv,
        tcv,
        recurringTcv,
        servicesTcv,
        oneTimeTcv: servicesTcv,
        currency,
        termMonths,
        termYears,
        source: "explicit_overrides",
        warnings,
        ramp: options.ramp,
      };
    }
    warnings.push("Explicit MRR/ARR/ACV/TCV fields were inconsistent — falling back to derived calculation.");
  }

  // ---- Path 4: monthly_fee / annual_fee shortcuts ----
  if (monthlyFee > 0 || annualFee > 0) {
    const components: RecurringComponent[] = [];
    if (monthlyFee > 0) components.push({ label: "monthly_fee", amount: monthlyFee, cadence: "monthly", category: "subscription" });
    if (annualFee > 0) components.push({ label: "annual_fee", amount: annualFee, cadence: "annual", category: "subscription" });
    return finalize(components, contractValueOnly, currency, termMonths, termYears, "legacy_fallback", warnings, options.ramp);
  }

  // ---- Path 5: legacy fee buckets — resolve ambiguous cadence ----
  if (legacyComponents.length > 0) {
    const resolved = legacyComponents.map((c) => {
      if (c.cadence !== "term_total") return c;
      // Heuristic per plan §3c: treat as term_total only if term > 12 months,
      // otherwise treat as annual. Always emit a warning.
      if (termMonths > 12) {
        warnings.push(
          `Field "${c.label}" had no explicit cadence; treated as total over the ${Math.round(termMonths)}-month term.`,
        );
        return c;
      }
      warnings.push(`Field "${c.label}" had no explicit cadence; treated as an annual amount.`);
      return { ...c, cadence: "annual" as Cadence };
    });
    return finalize(resolved, contractValueOnly, currency, termMonths, termYears, "legacy_fallback", warnings, options.ramp);
  }

  // ---- Path 6: only contract_value is present ----
  if (contractValueOnly > 0) {
    warnings.push("Only a total contract value was available — MRR/ARR/ACV cannot be split from one-time charges.");
    const tcv = contractValueOnly;
    const acv = termYears > 0 ? tcv / termYears : tcv;
    const arr = acv;
    const mrr = arr / 12;
    return {
      mrr,
      arr,
      acv,
      currentAcv: acv,
      peakAcv: acv,
      weightedAcv: acv,
      tcv,
      recurringTcv: tcv,
      servicesTcv: 0,
      oneTimeTcv: 0,
      currency,
      termMonths,
      termYears,
      source: "contract_value_only",
      warnings,
      ramp: options.ramp,
    };
  }

  // ---- Nothing usable ----
  return {
    mrr: 0, arr: 0, acv: 0, currentAcv: 0, peakAcv: 0, weightedAcv: 0,
    tcv: 0, recurringTcv: 0, servicesTcv: 0, oneTimeTcv: 0,
    currency, termMonths, termYears,
    source: "empty",
    warnings,
    ramp: options.ramp,
  };
}

// ---------- Internals ----------

function componentsFromSchedule(
  schedule: InvoiceScheduleRow[],
  termMonths: number,
): RecurringComponent[] {
  const recurring: RecurringComponent[] = [];
  const oneTimes: RecurringComponent[] = [];

  // Group recurring rows by classified category to derive a representative
  // cadence + amount per category.
  const groups = new Map<string, { amounts: number[]; spans: number[]; isRecurring: boolean }>();

  for (const row of schedule) {
    const amt = toNumber(row.amount);
    if (amt <= 0) continue;
    const label = row.description || row.billing_type || "";
    const category = classifyByKeyword(label);
    const cad = guessCadence(row.billing_type) || guessCadence(label);
    const span = monthsBetween(row.service_period_start, row.service_period_end);

    if (ONE_TIME_CATEGORIES.has(category) || cad === "one_time") {
      oneTimes.push({ label, amount: amt, cadence: "one_time", category });
      continue;
    }
    const key = category;
    const g = groups.get(key) || { amounts: [], spans: [], isRecurring: true };
    g.amounts.push(amt);
    if (span > 0) g.spans.push(span);
    groups.set(key, g);
  }

  for (const [category, g] of groups.entries()) {
    if (g.amounts.length === 0) continue;
    const avgAmount = g.amounts.reduce((a, b) => a + b, 0) / g.amounts.length;
    const avgSpan = g.spans.length > 0 ? g.spans.reduce((a, b) => a + b, 0) / g.spans.length : 0;
    let cadence: Cadence = "monthly";
    if (avgSpan >= 11) cadence = "annual";
    else if (avgSpan >= 2.5) cadence = "quarterly";
    else if (avgSpan >= 0.5) cadence = "monthly";
    else if (termMonths > 0 && g.amounts.length === 1) cadence = "term_total";
    recurring.push({
      label: category,
      amount: avgAmount,
      cadence,
      category: category as ComponentCategory,
    });
  }

  return [...recurring, ...oneTimes];
}

function finalize(
  components: RecurringComponent[],
  contractValueHint: number,
  currency: string,
  termMonths: number,
  termYears: number,
  source: MetricsSource,
  warnings: string[],
  ramp?: RampYear[],
): ContractTotals {
  let mrr = 0;
  let recurringTcv = 0;
  let servicesTcv = 0;
  let oneTimeTcv = 0;

  for (const c of components) {
    const monthly = normalizeToMonthly(c.amount, c.cadence, termMonths);
    if (RECURRING_CATEGORIES.has(c.category) && monthly > 0) {
      mrr += monthly;
      recurringTcv += termMonths > 0 ? monthly * termMonths : componentTotalOverTerm(c, termMonths);
    } else {
      const total = componentTotalOverTerm(c, termMonths);
      if (c.category === "professional_services" || c.category === "implementation" || c.category === "onboarding" || c.category === "training") {
        servicesTcv += total;
      } else {
        oneTimeTcv += total;
      }
    }
  }

  const arr = mrr * 12;

  // ACV / ramp handling
  let currentAcv = arr;
  let peakAcv = arr;
  let weightedAcv = arr;
  if (ramp && ramp.length > 0) {
    const arrs = ramp.map((r) => r.arr ?? (r.mrr ?? 0) * 12).filter((n) => n > 0);
    if (arrs.length > 0) {
      peakAcv = Math.max(...arrs);
      weightedAcv = arrs.reduce((a, b) => a + b, 0) / arrs.length;
      // current = ramp year whose year matches the elapsed years (best-effort)
      currentAcv = arrs[0];
    }
  } else if (termYears > 0 && recurringTcv > 0) {
    weightedAcv = recurringTcv / termYears;
    currentAcv = arr;
    peakAcv = Math.max(arr, weightedAcv);
  }
  const acv = weightedAcv > 0 ? weightedAcv : arr;

  let tcv = recurringTcv + servicesTcv + oneTimeTcv;

  // Sanity: if contractValueHint is much larger than what we derived and we have
  // no services figure, surface a warning but do NOT silently overwrite — the
  // legacy `Math.max(tcv, contract_value)` behaviour was the source of bad TCVs.
  if (
    contractValueHint > 0 &&
    tcv > 0 &&
    contractValueHint > tcv * 1.25 &&
    servicesTcv + oneTimeTcv === 0
  ) {
    warnings.push(
      `Stated contract value (${contractValueHint.toLocaleString()}) is higher than derived TCV — likely missing one-time/services components.`,
    );
  }
  if (tcv === 0 && contractValueHint > 0) {
    tcv = contractValueHint;
  }

  return {
    mrr,
    arr,
    acv,
    currentAcv,
    peakAcv,
    weightedAcv,
    tcv,
    recurringTcv,
    servicesTcv,
    oneTimeTcv,
    currency,
    termMonths,
    termYears,
    source,
    warnings,
    ramp,
  };
}
