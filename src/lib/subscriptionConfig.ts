/**
 * Stripe Subscription Configuration
 * 
 * PRICING STRUCTURE:
 * - Annual billing = 20% discount on monthly price
 * - Formula: annual_price = monthly_price * 12 * 0.8
 * 
 * SEAT BILLING:
 * - Owner is included FREE in base plan
 * - Additional users: $75/month or $720/year (20% discount)
 */

// ============================================================================
// STRIPE PRICE IDs - Update these when switching between Test and Live modes
// ============================================================================
// NOTE: These IDs are for LIVE mode. For TEST mode, create corresponding prices
// in your Stripe test dashboard and update accordingly.

export const STRIPE_PRICES = {
  monthly: {
    starter: 'price_1SaNQ5FaeMMSBqcli04PsmKX',      // $99/month - 100 invoices
    growth: 'price_1SaNQKFaeMMSBqclWKbyVTSv',       // $199/month - 300 invoices
    professional: 'price_1SaNVyFaeMMSBqclrcAXjUmm', // $499/month - 500 invoices
  },
  annual: {
    starter: 'price_1SaNWBFaeMMSBqcl6EK9frSv',      // $950.40/year (20% off) - 100 invoices
    growth: 'price_1SaNWTFaeMMSBqclXYovl2Hj',       // $1,910.40/year (20% off) - 300 invoices
    professional: 'price_1SaNXGFaeMMSBqcl08sXmTEm', // $4,790.40/year (20% off) - 500 invoices
  },
  overage: 'price_1SaNZ7FaeMMSBqcleUXkrzWl',        // $1.50 per additional invoice
  
  // Team seat add-on pricing
  seat: {
    monthly: 'price_1SbWueFaeMMSBqclnDqJkOQW',      // $75/user/month
    annual: 'price_1SbWuuFaeMMSBqclX6xqgX9E',       // $720/user/year (20% off: $75 * 12 * 0.8)
  },
} as const;

export const STRIPE_PRODUCTS = {
  starter: 'prod_TXSKnoJFoHzsKc',
  growth: 'prod_TXSLdpR7XTZZQx',
  professional: 'prod_TXSQ7XHGszt03J',
  overage: 'prod_TXSUJBuobgJuOq',
  seatMonthly: 'prod_TYeDiyYwctpxde',
  seatAnnual: 'prod_TYeDoh2yfFpbdg',
} as const;

// ============================================================================
// PRICING CONFIGURATION
// ============================================================================

/**
 * Annual Discount Rate
 * Annual billing receives 20% discount: annual = monthly * 12 * (1 - ANNUAL_DISCOUNT)
 */
export const ANNUAL_DISCOUNT_RATE = 0.20; // 20% discount

/**
 * Calculate annual price from monthly price
 * Formula: monthly * 12 * 0.8 (20% discount)
 * Rounds to 2 decimal places for consistency
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

// Seat pricing configuration
export const SEAT_PRICING = {
  monthlyPrice: 75.00,
  annualPrice: 720.00, // $75 * 12 * 0.8 = $720/year (20% discount)
  currency: 'USD',
  // Owner is included free in the base plan
  // Additional active users are billed per seat
  ownerIncludedFree: true,
} as const;

export type PlanType = 'free' | 'starter' | 'growth' | 'professional' | 'enterprise';
export type BillingInterval = 'month' | 'year';

export interface PlanConfig {
  name: string;
  displayName: string;
  monthlyPrice: number;
  annualPrice: number;        // Calculated: monthlyPrice * 12 * 0.8
  equivalentMonthly: number;  // Annual price divided by 12
  invoiceLimit: number;
  overageRate: number;
  maxAgents: number;
  features: string[];
  highlighted?: boolean;
}

// Plan configurations with 20% annual discount
export const PLAN_CONFIGS: Record<Exclude<PlanType, 'free'>, PlanConfig> = {
  starter: {
    name: 'starter',
    displayName: 'Starter',
    monthlyPrice: 99,
    annualPrice: 950.40,        // $99 * 12 * 0.8 = $950.40
    equivalentMonthly: 79.20,   // $950.40 / 12 = $79.20
    invoiceLimit: 100,
    overageRate: 1.50,
    maxAgents: 2,
    features: [
      'Up to 100 invoices/month',
      '2 AI collection agents',
      'Email collection campaigns',
      'Basic analytics dashboard',
      'Stripe payment links',
      'Email support',
    ],
  },
  growth: {
    name: 'growth',
    displayName: 'Growth',
    monthlyPrice: 199,
    annualPrice: 1910.40,       // $199 * 12 * 0.8 = $1,910.40
    equivalentMonthly: 159.20,  // $1,910.40 / 12 = $159.20
    invoiceLimit: 300,
    overageRate: 1.50,
    maxAgents: 5,
    highlighted: true,
    features: [
      'Up to 300 invoices/month',
      '5 AI collection agents',
      'Email + SMS campaigns',
      'Advanced analytics',
      'CRM integrations',
      'Priority email support',
      'Custom branding',
    ],
  },
  professional: {
    name: 'professional',
    displayName: 'Professional',
    monthlyPrice: 499,
    annualPrice: 4790.40,       // $499 * 12 * 0.8 = $4,790.40
    equivalentMonthly: 399.20,  // $4,790.40 / 12 = $399.20
    invoiceLimit: 500,
    overageRate: 1.50,
    maxAgents: 6,
    features: [
      'Up to 500 invoices/month',
      'All 6 AI collection agents',
      'Full automation suite',
      'Team collaboration',
      'Advanced reporting',
      'API access',
      'Dedicated support',
      'Custom workflows',
    ],
  },
  enterprise: {
    name: 'enterprise',
    displayName: 'Enterprise',
    monthlyPrice: 0,
    annualPrice: 0,
    equivalentMonthly: 0,
    invoiceLimit: -1, // Unlimited
    overageRate: 0,
    maxAgents: 6,
    features: [
      'Unlimited invoices',
      'All 6 AI collection agents',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantee',
      'White-label options',
      'Custom AI training',
      'On-premise deployment option',
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

export function getInvoiceLimit(plan: PlanType): number {
  if (plan === 'free') return 15;
  if (plan === 'enterprise') return -1; // Unlimited
  const config = PLAN_CONFIGS[plan];
  return config?.invoiceLimit || 15;
}

export function getMaxAgents(plan: PlanType): number {
  if (plan === 'free') return 2;
  if (plan === 'enterprise') return 6;
  const config = PLAN_CONFIGS[plan];
  return config?.maxAgents || 2;
}

/**
 * Calculate billable seats for an account
 * Owner is free, additional active users are billed per seat
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
