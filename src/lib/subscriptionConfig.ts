// Stripe Price IDs - New pricing structure
export const STRIPE_PRICES = {
  monthly: {
    starter: 'price_1SaNQ5FaeMMSBqcli04PsmKX',
    growth: 'price_1SaNQKFaeMMSBqclWKbyVTSv',
    professional: 'price_1SaNVyFaeMMSBqclrcAXjUmm',
  },
  annual: {
    starter: 'price_1SaNWBFaeMMSBqcl6EK9frSv',
    growth: 'price_1SaNWTFaeMMSBqclXYovl2Hj',
    professional: 'price_1SaNXGFaeMMSBqcl08sXmTEm',
  },
  overage: 'price_1SaNZ7FaeMMSBqcleUXkrzWl',
  // Team seat pricing - $75/month per additional user (owner is free)
  // NOTE: Set this price ID after creating the product in Stripe when site goes live
  seat: null as string | null, // e.g., 'price_xxxxx' - will be set when Stripe is configured
} as const;

// Seat pricing configuration
export const SEAT_PRICING = {
  pricePerMonth: 75.00,
  currency: 'USD',
  // Owner is included free in the base plan
  // Additional active users are billed at $75/month each
  ownerIncludedFree: true,
} as const;

export const STRIPE_PRODUCTS = {
  starter: 'prod_TXSKnoJFoHzsKc',
  growth: 'prod_TXSLdpR7XTZZQx',
  professional: 'prod_TXSQ7XHGszt03J',
  overage: 'prod_TXSUJBuobgJuOq',
  // Team seat product - will be set when Stripe is configured
  seat: null as string | null,
} as const;

export type PlanType = 'free' | 'starter' | 'growth' | 'professional' | 'enterprise';
export type BillingInterval = 'month' | 'year';

export interface PlanConfig {
  name: string;
  displayName: string;
  monthlyPrice: number;
  annualPrice: number;
  invoiceLimit: number;
  overageRate: number;
  maxAgents: number;
  features: string[];
  highlighted?: boolean;
}

export const PLAN_CONFIGS: Record<Exclude<PlanType, 'free'>, PlanConfig> = {
  starter: {
    name: 'starter',
    displayName: 'Starter',
    monthlyPrice: 99,
    annualPrice: 1009.80,
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
    annualPrice: 2029.80,
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
    annualPrice: 5089.80,
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

export function getPlanByPriceId(priceId: string): PlanType | null {
  for (const [interval, prices] of Object.entries(STRIPE_PRICES)) {
    if (interval === 'overage') continue;
    for (const [plan, id] of Object.entries(prices as Record<string, string>)) {
      if (id === priceId) return plan as PlanType;
    }
  }
  return null;
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
  // All users get free access with 15 invoice limit (Stripe disconnected)
  return 15;
}

export function getMaxAgents(plan: PlanType): number {
  // All users get access to all 6 agents (Stripe disconnected)
  return 6;
}

/**
 * Calculate billable seats for an account
 * Owner is free, additional active users are $75/month each
 */
export function calculateBillableSeats(activeUsers: number, ownerCount: number = 1): number {
  // Owner is included free
  if (SEAT_PRICING.ownerIncludedFree) {
    return Math.max(0, activeUsers - ownerCount);
  }
  return activeUsers;
}

/**
 * Calculate estimated monthly seat cost
 */
export function calculateSeatCost(billableSeats: number): number {
  return billableSeats * SEAT_PRICING.pricePerMonth;
}
