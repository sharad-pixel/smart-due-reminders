/**
 * Stripe Subscription Configuration — Credit Economy v2 (Jun 2026)
 *
 * PRICING MODEL: Platform Access Fee + Included Credits + Metered Add-Ons (Twilio-style)
 * - 1 invoice processed/month = 2 credits.
 * - Overage credits: $0.80 pre-paid / $1.00 on-demand (matches ASC 606 Credits).
 * - Live Contracts: $5.00 / active contract / month (metered add-on, includes alerts + standard risk).
 *
 * PLANS (v2):
 * - Launch:       $29/mo   — 30 credits,  0 contracts, 1 seat
 * - Starter:      $99/mo   — 150 credits, 5 contracts, 2 seats
 * - Growth:       $299/mo  — 500 credits, 20 contracts, 5 seats
 * - Professional: $699/mo  — 1,500 credits, 75 contracts, 10 seats
 * - Enterprise:   Custom
 *
 * Annual billing = 20% discount.
 *
 * Legacy v1 price IDs and Solo Pro tier are retained for grandfathering existing
 * subscribers; new signups use v2 prices below.
 */

// ============================================================================
// STRIPE PRICE IDs
// ============================================================================

export const STRIPE_PRICES = {
  monthly: {
    // v2 (new credit-economy plans — active for new signups)
    launch: 'price_1TfDx6Bfb0dWgtCDc3HpAtye',         // $29/mo
    starter: 'price_1TfDx7Bfb0dWgtCDNkLduVxc',        // $99/mo
    growth: 'price_1TfDx9Bfb0dWgtCDp94E6iNn',         // $299/mo
    professional: 'price_1TfDxBBfb0dWgtCD4ObmfoEW',   // $699/mo
    // v1 legacy (grandfathered — checkout no longer points here)
    solo_pro: 'price_1SvLJHBfb0dWgtCDMHCSyVWo',       // $49/mo legacy
  },
  annual: {
    launch: 'price_1TfDx6Bfb0dWgtCDfcEwQEEt',         // $278.40/yr
    starter: 'price_1TfDx8Bfb0dWgtCDCnnclvGu',        // $950.40/yr
    growth: 'price_1TfDxABfb0dWgtCDt6aAIuH9',         // $2,870.40/yr
    professional: 'price_1TfDxDBfb0dWgtCDNjPFUgaG',   // $6,710.40/yr
    solo_pro: 'price_1SvLJMBfb0dWgtCDxlaprYD9',       // legacy
  },
  // Legacy v1 platform prices retained for grandfathering only:
  legacyMonthly: {
    starter: 'price_1ScbGXBfb0dWgtCDpDqTtrC7',
    growth: 'price_1ScbGbBfb0dWgtCDLjXblCw4',
    professional: 'price_1ScbGeBfb0dWgtCDrtiXDKiJ',
  },
  legacyAnnual: {
    starter: 'price_1ScbGZBfb0dWgtCDvfg6hyy6',
    growth: 'price_1ScbGcBfb0dWgtCDQpH6uB7A',
    professional: 'price_1ScbGfBfb0dWgtCDhCxrFPE4',
  },

  invoice: 'price_1SbvzMBqszPdRiQv0AM0GDrv',          // legacy per-invoice $1.99 (deprecated)

  // Team seat add-on
  seat: {
    monthly: 'price_1ScbGhBfb0dWgtCDZukktOuA',        // $75/user/mo
    annual: 'price_1ScbGiBfb0dWgtCDOrLwli7A',         // $720/user/yr
  },

  // AI Smart Ingestion (metered, $1/page on-demand)
  smartIngestion: 'price_1THHe6Bfb0dWgtCDh4iTrzAe',

  // Live Contracts (metered, $5/contract/mo)
  liveContracts: 'price_1TfDxEBfb0dWgtCDuatQBO3l',

  // Recouply Platform Credits — generic wallet top-up (replaces ASC 606-branded SKUs)
  // Prepaid = $0.80/credit (must be purchased before usage). Overage = $1.00/credit (settles usage after the fact).
  creditsPrepaid: 'price_1TpiYKBfb0dWgtCDVBU5qxIf',
  creditsOverage: 'price_1TpiYVBfb0dWgtCDO5FyUsTx',
} as const;

export const STRIPE_PRODUCTS = {
  // v2
  launch: 'prod_UeX1XZQFfZGCMF',
  launchAnnual: 'prod_UeX1Oi8BdbpQFU',
  starter: 'prod_UeX15gUYhfTCxs',
  starterAnnual: 'prod_UeX1MQmgcf3OB2',
  growth: 'prod_UeX1TBBTQp8uHZ',
  growthAnnual: 'prod_UeX1gbjN3Pm0In',
  professional: 'prod_UeX1JM6f5lUa2g',
  professionalAnnual: 'prod_UeX13mdZC77FAi',
  liveContracts: 'prod_UeX1TpGXrDCCb3',

  // v1 legacy (grandfathered)
  solo_pro: 'prod_Tt7YjFBzHHYQop',
  solo_proAnnual: 'prod_Tt7Y4h6hvnrUzF',
  legacyStarter: 'prod_TZkmWC1MyKQXpP',
  legacyStarterAnnual: 'prod_TZkm7G0Mg8x9se',
  legacyGrowth: 'prod_TZkmds8B5fChZF',
  legacyGrowthAnnual: 'prod_TZkmtYIr8uLZl8',
  legacyProfessional: 'prod_TZkm0viKFTgHDi',
  legacyProfessionalAnnual: 'prod_TZkmtqnzjaZaoY',

  seat: 'prod_TZkmoqr5xpSBtV',
  seatAnnual: 'prod_TZkmyzUeLp2SmA',
  invoice: 'prod_TZ47dBqm7afkzi',
  smartIngestion: 'prod_UFnEUWvQL0RlJ0',
  creditsPrepaid: 'prod_UpNIt8RGC0aePD',
  creditsOverage: 'prod_UpNJYwUXZrjK96',
} as const;

// ============================================================================
// PRICING CONFIG
// ============================================================================

export const ANNUAL_DISCOUNT_RATE = 0.20;

export const TRIAL_CONFIG = {
  trialDays: 7,
  invoiceLimit: 5,           // credits during trial
  creditLimit: 5,
  defaultPlan: 'launch' as const,
  requirePaymentUpfront: true,
} as const;

/** Unified credit pricing (replaces legacy per-invoice rate). */
export const CREDIT_PRICING = {
  prepaidPerCredit: 0.80,
  overagePerCredit: 1.00,
  currency: 'USD',
} as const;

/** Credits consumed per invoice processed. */
export const CREDITS_PER_INVOICE = 2;

/** Legacy alias — kept so existing code referencing INVOICE_PRICING.perInvoice
 *  continues to compile. Maps to per-invoice cost at on-demand credit rate
 *  ($1.00/credit × CREDITS_PER_INVOICE). */
export const INVOICE_PRICING = {
  perInvoice: CREDIT_PRICING.overagePerCredit * CREDITS_PER_INVOICE,
  currency: 'USD',
} as const;

export const SEAT_PRICING = {
  monthlyPrice: 75.00,
  annualPrice: 720.00,
  currency: 'USD',
  ownerIncludedFree: true,
} as const;

export const SMART_INGESTION_PRICING = {
  perPage: 1.00,
  perFile: 1.00,
  creditsPerPage: 1,
  currency: 'USD',
  billingCadence: 'monthly',
  chargeOnApprovalOnly: true,
} as const;

/** Live Contracts metered add-on. Charged per active contract per month
 *  (counted nightly, pro-rated). Includes alerts + standard risk assessments. */
export const LIVE_CONTRACTS_PRICING = {
  pricePerContractPerMonth: 5.00,
  currency: 'USD',
  includes: ['alerts', 'standard risk assessments'] as const,
} as const;

export function calculateAnnualPrice(monthlyPrice: number): number {
  return Math.round(monthlyPrice * 12 * (1 - ANNUAL_DISCOUNT_RATE) * 100) / 100;
}

export function calculateEquivalentMonthly(annualPrice: number): number {
  return Math.round((annualPrice / 12) * 100) / 100;
}

export type PlanType =
  | 'free'
  | 'launch'
  | 'solo_pro'        // legacy v1, grandfathered
  | 'starter'
  | 'growth'
  | 'professional'
  | 'enterprise';
export type BillingInterval = 'month' | 'year';

export interface PlanConfig {
  name: string;
  displayName: string;
  monthlyPrice: number;
  annualPrice: number;
  equivalentMonthly: number;
  /** Monthly credit allotment included with the plan (2 credits = 1 invoice). */
  creditAllotment: number;
  /** Legacy alias — derived as creditAllotment / CREDITS_PER_INVOICE (max invoices/month). */
  invoiceLimit: number;
  /** Live Contracts included before $5/ea overage kicks in. */
  includedContracts: number;
  /** Team seats included before $75/seat/mo overage. */
  includedSeats: number;
  perInvoiceRate: number;
  maxAgents: number;
  features: string[];
  highlighted?: boolean;
  legacy?: boolean;
}

const mk = (cfg: Omit<PlanConfig, 'annualPrice' | 'equivalentMonthly' | 'invoiceLimit' | 'perInvoiceRate'> & { perInvoiceRate?: number }): PlanConfig => ({
  ...cfg,
  annualPrice: calculateAnnualPrice(cfg.monthlyPrice),
  equivalentMonthly: calculateEquivalentMonthly(calculateAnnualPrice(cfg.monthlyPrice)),
  invoiceLimit: Math.floor(cfg.creditAllotment / CREDITS_PER_INVOICE),
  perInvoiceRate: cfg.perInvoiceRate ?? CREDIT_PRICING.overagePerCredit * CREDITS_PER_INVOICE,
});

export const PLAN_CONFIGS: Record<Exclude<PlanType, 'free'>, PlanConfig> = {
  launch: mk({
    name: 'launch',
    displayName: 'Launch',
    monthlyPrice: 29,
    creditAllotment: 30,
    includedContracts: 0,
    includedSeats: 1,
    maxAgents: 6,
    features: [
      '30 credits/month included',
      'All 6 AI collection agents',
      'Stripe & QuickBooks integrations',
      'Email campaigns & full automation',
      'Add Live Contracts at $5/contract/mo',
      'Overage credits: $0.80 pre-paid / $1.00 on-demand',
    ],
  }),
  starter: mk({
    name: 'starter',
    displayName: 'Starter',
    monthlyPrice: 99,
    creditAllotment: 150,
    includedContracts: 5,
    includedSeats: 2,
    maxAgents: 6,
    features: [
      '150 credits/month included',
      '5 Live Contracts included ($25 value)',
      '2 team seats included',
      'All 6 AI collection agents',
      'Collection intelligence dashboard',
      'Overage: $0.80 pre-paid / $1.00 on-demand',
    ],
  }),
  growth: mk({
    name: 'growth',
    displayName: 'Growth',
    monthlyPrice: 299,
    creditAllotment: 500,
    includedContracts: 20,
    includedSeats: 5,
    maxAgents: 6,
    highlighted: true,
    features: [
      '500 credits/month included',
      '20 Live Contracts included ($100 value)',
      '5 team seats included',
      'All 6 AI collection agents',
      'Advanced revenue risk + ECL intelligence',
      'Overage: $0.80 pre-paid / $1.00 on-demand',
    ],
  }),
  professional: mk({
    name: 'professional',
    displayName: 'Professional',
    monthlyPrice: 699,
    creditAllotment: 1500,
    includedContracts: 75,
    includedSeats: 10,
    maxAgents: 6,
    features: [
      '1,500 credits/month included',
      '75 Live Contracts included ($375 value)',
      '10 team seats included',
      'All 6 AI collection agents',
      'Priority AI throughput + dedicated CSM',
      'Overage: $0.80 pre-paid / $1.00 on-demand',
    ],
  }),
  // Legacy — grandfathered only, hidden from checkout UI
  solo_pro: mk({
    name: 'solo_pro',
    displayName: 'Solo Pro (Legacy)',
    monthlyPrice: 49,
    creditAllotment: 25,
    includedContracts: 0,
    includedSeats: 1,
    maxAgents: 6,
    legacy: true,
    features: ['25 credits/month (legacy plan)', 'All 6 AI collection agents'],
  }),
  enterprise: {
    name: 'enterprise',
    displayName: 'Enterprise',
    monthlyPrice: 0,
    annualPrice: 0,
    equivalentMonthly: 0,
    creditAllotment: -1,
    invoiceLimit: -1,
    includedContracts: -1,
    includedSeats: -1,
    perInvoiceRate: 0,
    maxAgents: 6,
    features: [
      'Unlimited credits + contracts pool',
      'Custom volume pricing',
      'Dedicated account manager + SLA',
      'SSO, audit log export, custom DPA',
      'White-label options',
    ],
  },
};

/** New-signup plans displayed in marketing/checkout (excludes legacy + free). */
export const ACTIVE_PLAN_KEYS: Array<Exclude<PlanType, 'free' | 'solo_pro' | 'enterprise'>> = [
  'launch',
  'starter',
  'growth',
  'professional',
];

export function getPlanByPriceId(priceId: string): { plan: PlanType; interval: BillingInterval } | null {
  for (const [plan, id] of Object.entries(STRIPE_PRICES.monthly)) {
    if (id === priceId) return { plan: plan as PlanType, interval: 'month' };
  }
  for (const [plan, id] of Object.entries(STRIPE_PRICES.annual)) {
    if (id === priceId) return { plan: plan as PlanType, interval: 'year' };
  }
  for (const [plan, id] of Object.entries(STRIPE_PRICES.legacyMonthly)) {
    if (id === priceId) return { plan: plan as PlanType, interval: 'month' };
  }
  for (const [plan, id] of Object.entries(STRIPE_PRICES.legacyAnnual)) {
    if (id === priceId) return { plan: plan as PlanType, interval: 'year' };
  }
  return null;
}

export function getPriceId(
  plan: Exclude<PlanType, 'free' | 'enterprise'>,
  interval: BillingInterval,
): string {
  const bucket = interval === 'year' ? STRIPE_PRICES.annual : STRIPE_PRICES.monthly;
  return (bucket as Record<string, string>)[plan];
}

export function getSeatPriceId(interval: BillingInterval): string {
  return interval === 'year' ? STRIPE_PRICES.seat.annual : STRIPE_PRICES.seat.monthly;
}

export function getInvoicePriceId(): string {
  return STRIPE_PRICES.invoice;
}

export function getLiveContractsPriceId(): string {
  return STRIPE_PRICES.liveContracts;
}

export function getPlanConfig(plan: PlanType): PlanConfig | null {
  if (plan === 'free') return null;
  return PLAN_CONFIGS[plan] || null;
}

export function canAccessFeature(plan: PlanType, feature: string): boolean {
  if (plan === 'enterprise') return true;
  if (plan === 'free') return false;
  const config = PLAN_CONFIGS[plan];
  return config?.features.includes(feature) || false;
}

export function getInvoiceLimit(plan: PlanType, isTrial: boolean = false): number {
  if (isTrial) return Math.floor(TRIAL_CONFIG.invoiceLimit / CREDITS_PER_INVOICE);
  if (plan === 'free') return Math.floor(5 / CREDITS_PER_INVOICE);
  if (plan === 'enterprise') return -1;
  return Math.floor((PLAN_CONFIGS[plan]?.creditAllotment ?? 5) / CREDITS_PER_INVOICE);
}

export function getMaxAgents(plan: PlanType): number {
  if (plan === 'free') return 2;
  if (plan === 'enterprise') return 6;
  return PLAN_CONFIGS[plan]?.maxAgents ?? 2;
}

export function calculateBillableSeats(activeUsers: number, ownerCount: number = 1): number {
  if (SEAT_PRICING.ownerIncludedFree) {
    return Math.max(0, activeUsers - ownerCount);
  }
  return activeUsers;
}

export function calculateSeatCost(billableSeats: number, interval: BillingInterval = 'month'): number {
  const pricePerSeat = interval === 'year' ? SEAT_PRICING.annualPrice : SEAT_PRICING.monthlyPrice;
  return billableSeats * pricePerSeat;
}

/** Compute Live Contracts monthly charge given an active count and plan allotment. */
export function calculateLiveContractsCost(activeContracts: number, plan: PlanType): number {
  const allotment = PLAN_CONFIGS[plan as Exclude<PlanType, 'free'>]?.includedContracts ?? 0;
  if (allotment < 0) return 0; // enterprise / unlimited
  const billable = Math.max(0, activeContracts - allotment);
  return billable * LIVE_CONTRACTS_PRICING.pricePerContractPerMonth;
}

export function formatPrice(amount: number, options?: { showCents?: boolean }): string {
  if (options?.showCents || amount % 1 !== 0) {
    return `$${amount.toFixed(2)}`;
  }
  return `$${Math.round(amount)}`;
}
