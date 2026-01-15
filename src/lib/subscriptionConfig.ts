/**
 * Stripe Subscription Configuration
 * 
 * PRICING STRUCTURE (Updated December 2024):
 * - Starter: $199/month
 * - Growth: $499/month
 * - Professional: $799/month
 * - Per Seat: $75/user/month
 * - Per Invoice: $1.99/invoice
 * 
 * Annual billing = 20% discount on monthly price
 * Formula: annual_price = monthly_price * 12 * 0.8
 */

// ============================================================================
// STRIPE PRICE IDs - These are the LIVE mode price IDs
// ============================================================================

export const STRIPE_PRICES = {
  monthly: {
    starter: 'price_1ScbGXBfb0dWgtCDpDqTtrC7',      // $199/month - 100 invoices
    growth: 'price_1ScbGbBfb0dWgtCDLjXblCw4',       // $499/month - 300 invoices
    professional: 'price_1ScbGeBfb0dWgtCDrtiXDKiJ', // $799/month - 500 invoices
  },
  annual: {
    starter: 'price_1ScbGZBfb0dWgtCDvfg6hyy6',      // $1,910.40/year - 100 invoices
    growth: 'price_1ScbGcBfb0dWgtCDQpH6uB7A',       // $4,790.40/year - 300 invoices
    professional: 'price_1ScbGfBfb0dWgtCDhCxrFPE4', // $7,670.40/year - 500 invoices
  },
  invoice: 'price_1SbvzMBqszPdRiQv0AM0GDrv',        // $1.99 per invoice (keep existing)
  
  // Team seat add-on pricing
  seat: {
    monthly: 'price_1ScbGhBfb0dWgtCDZukktOuA',      // $75/user/month
    annual: 'price_1ScbGiBfb0dWgtCDOrLwli7A',       // $720/year per user
  },
} as const;

export const STRIPE_PRODUCTS = {
  starter: 'prod_TZkmWC1MyKQXpP',
  starterAnnual: 'prod_TZkm7G0Mg8x9se',
  growth: 'prod_TZkmds8B5fChZF',
  growthAnnual: 'prod_TZkmtYIr8uLZl8',
  professional: 'prod_TZkm0viKFTgHDi',
  professionalAnnual: 'prod_TZkmtqnzjaZaoY',
  seat: 'prod_TZkmoqr5xpSBtV',
  seatAnnual: 'prod_TZkmyzUeLp2SmA',
  invoice: 'prod_TZ47dBqm7afkzi',
} as const;

// ============================================================================
// PRICING CONFIGURATION - SINGLE SOURCE OF TRUTH
// ============================================================================

/**
 * Annual Discount Rate
 * Annual billing receives 20% discount: annual = monthly * 12 * (1 - ANNUAL_DISCOUNT)
 */
export const ANNUAL_DISCOUNT_RATE = 0.20; // 20% discount

/**
 * Trial Configuration
 * 7-day trial with 5 invoice limit
 */
export const TRIAL_CONFIG = {
  trialDays: 7,
  invoiceLimit: 5,
  defaultPlan: 'starter' as const,
  requirePaymentUpfront: true, // Require payment info before accessing app
} as const;

/**
 * Per-invoice pricing (standardized across all plans)
 */
export const INVOICE_PRICING = {
  perInvoice: 1.99,
  currency: 'USD',
} as const;

/**
 * Per-seat pricing (standardized across all plans)
 */
export const SEAT_PRICING = {
  monthlyPrice: 75.00,
  annualPrice: 720.00, // $75 * 12 * 0.8 = $720/year (20% discount)
  currency: 'USD',
  ownerIncludedFree: true,
} as const;

/**
 * Calculate annual price from monthly price
 * Formula: monthly * 12 * 0.8 (20% discount)
 */
export function calculateAnnualPrice(monthlyPrice: number): number {
  return Math.round(monthlyPrice * 12 * (1 - ANNUAL_DISCOUNT_RATE) * 100) / 100;
}

/**
 * Calculate equivalent monthly price for annual billing
 */
export function calculateEquivalentMonthly(annualPrice: number): number {
  return Math.round((annualPrice / 12) * 100) / 100;
}

export type PlanType = 'free' | 'starter' | 'growth' | 'professional' | 'enterprise';
export type BillingInterval = 'month' | 'year';

export interface PlanConfig {
  name: string;
  displayName: string;
  monthlyPrice: number;
  annualPrice: number;
  equivalentMonthly: number;
  invoiceLimit: number;
  perInvoiceRate: number;
  maxAgents: number;
  features: string[];
  highlighted?: boolean;
}

// Plan configurations with updated pricing
export const PLAN_CONFIGS: Record<Exclude<PlanType, 'free'>, PlanConfig> = {
  starter: {
    name: 'starter',
    displayName: 'Starter',
    monthlyPrice: 199,
    annualPrice: calculateAnnualPrice(199),         // $1,910.40/year
    equivalentMonthly: calculateEquivalentMonthly(calculateAnnualPrice(199)), // $159.20/month
    invoiceLimit: 100,
    perInvoiceRate: INVOICE_PRICING.perInvoice,
    maxAgents: 6,
    features: [
      'Up to 100 invoices/month',
      'All 6 AI collection agents',
      'Stripe & QuickBooks integrations',
      'Email campaigns',
      'Full automation suite',
      'Collection intelligence dashboard',
    ],
  },
  growth: {
    name: 'growth',
    displayName: 'Growth',
    monthlyPrice: 499,
    annualPrice: calculateAnnualPrice(499),         // $4,790.40/year
    equivalentMonthly: calculateEquivalentMonthly(calculateAnnualPrice(499)), // $399.20/month
    invoiceLimit: 300,
    perInvoiceRate: INVOICE_PRICING.perInvoice,
    maxAgents: 6,
    highlighted: true,
    features: [
      'Up to 300 invoices/month',
      'All 6 AI collection agents',
      'Stripe & QuickBooks integrations',
      'Email campaigns',
      'Full automation suite',
      'Collection intelligence dashboard',
    ],
  },
  professional: {
    name: 'professional',
    displayName: 'Professional',
    monthlyPrice: 799,
    annualPrice: calculateAnnualPrice(799),         // $7,670.40/year
    equivalentMonthly: calculateEquivalentMonthly(calculateAnnualPrice(799)), // $639.20/month
    invoiceLimit: 500,
    perInvoiceRate: INVOICE_PRICING.perInvoice,
    maxAgents: 6,
    features: [
      'Up to 500 invoices/month',
      'All 6 AI collection agents',
      'Stripe & QuickBooks integrations',
      'Email campaigns',
      'Full automation suite',
      'Collection intelligence dashboard',
    ],
  },
  enterprise: {
    name: 'enterprise',
    displayName: 'Enterprise',
    monthlyPrice: 0,
    annualPrice: 0,
    equivalentMonthly: 0,
    invoiceLimit: -1, // Unlimited
    perInvoiceRate: 0,
    maxAgents: 6,
    features: [
      'Unlimited invoices',
      'All 6 AI collection agents',
      'Stripe & QuickBooks integrations',
      'Custom enterprise integrations',
      'Dedicated account manager',
      'SLA guarantee',
      'White-label options',
    ],
  },
};

/**
 * Get plan type from Stripe price ID
 */
export function getPlanByPriceId(priceId: string): { plan: PlanType; interval: BillingInterval } | null {
  // Check monthly prices
  for (const [plan, id] of Object.entries(STRIPE_PRICES.monthly)) {
    if (id === priceId) return { plan: plan as PlanType, interval: 'month' };
  }
  // Check annual prices
  for (const [plan, id] of Object.entries(STRIPE_PRICES.annual)) {
    if (id === priceId) return { plan: plan as PlanType, interval: 'year' };
  }
  return null;
}

/**
 * Get price ID for a plan and billing interval
 */
export function getPriceId(plan: Exclude<PlanType, 'free' | 'enterprise'>, interval: BillingInterval): string {
  return interval === 'year' 
    ? STRIPE_PRICES.annual[plan] 
    : STRIPE_PRICES.monthly[plan];
}

/**
 * Get seat price ID for billing interval
 */
export function getSeatPriceId(interval: BillingInterval): string {
  return interval === 'year' 
    ? STRIPE_PRICES.seat.annual 
    : STRIPE_PRICES.seat.monthly;
}

/**
 * Get invoice price ID (same for all plans)
 */
export function getInvoicePriceId(): string {
  return STRIPE_PRICES.invoice;
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
  if (isTrial) return TRIAL_CONFIG.invoiceLimit; // 5 invoices during trial
  if (plan === 'free') return 5; // Free tier now has same limit as trial
  if (plan === 'enterprise') return -1; // Unlimited
  const config = PLAN_CONFIGS[plan];
  return config?.invoiceLimit || 5;
}

export function getMaxAgents(plan: PlanType): number {
  if (plan === 'free') return 2;
  if (plan === 'enterprise') return 6;
  const config = PLAN_CONFIGS[plan];
  return config?.maxAgents || 2;
}

/**
 * Calculate billable seats for an account
 */
export function calculateBillableSeats(activeUsers: number, ownerCount: number = 1): number {
  if (SEAT_PRICING.ownerIncludedFree) {
    return Math.max(0, activeUsers - ownerCount);
  }
  return activeUsers;
}

/**
 * Calculate seat cost based on billing interval
 */
export function calculateSeatCost(billableSeats: number, interval: BillingInterval = 'month'): number {
  const pricePerSeat = interval === 'year' 
    ? SEAT_PRICING.annualPrice 
    : SEAT_PRICING.monthlyPrice;
  return billableSeats * pricePerSeat;
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, options?: { showCents?: boolean }): string {
  if (options?.showCents || amount % 1 !== 0) {
    return `$${amount.toFixed(2)}`;
  }
  return `$${Math.round(amount)}`;
}
