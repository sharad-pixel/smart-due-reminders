import { PLAN_CONFIGS, type PlanType } from './subscriptionConfig';

export const PLAN_FEATURES = {
  free: {
    can_use_invoice_line_items: false,
    invoice_limit: 5,
    can_have_team_users: false,
    can_manage_roles: false,
    max_invited_users: 0,
    max_agents: 1,
  },
  starter: {
    can_use_invoice_line_items: true,
    invoice_limit: 100,
    can_have_team_users: false,
    can_manage_roles: false,
    max_invited_users: 0,
    max_agents: 2,
  },
  growth: {
    can_use_invoice_line_items: true,
    invoice_limit: 300,
    can_have_team_users: true,
    can_manage_roles: false,
    max_invited_users: 3,
    max_agents: 5,
  },
  professional: {
    can_use_invoice_line_items: true,
    invoice_limit: 500,
    can_have_team_users: true,
    can_manage_roles: true,
    max_invited_users: 10,
    max_agents: 6,
  },
  enterprise: {
    can_use_invoice_line_items: true,
    invoice_limit: -1, // Unlimited
    can_have_team_users: true,
    can_manage_roles: true,
    max_invited_users: -1, // Unlimited
    max_agents: 6,
  },
} as const;

// Support both old 'pro' name and new 'professional' name
export function canUseFeature(planType: PlanType | 'pro' | null, feature: keyof typeof PLAN_FEATURES.free): boolean {
  if (!planType) return PLAN_FEATURES.free[feature] as boolean;
  
  // Map 'pro' to 'professional' for backwards compatibility
  const normalizedPlan = planType === 'pro' ? 'professional' : planType;
  
  return (PLAN_FEATURES[normalizedPlan as keyof typeof PLAN_FEATURES]?.[feature] ?? PLAN_FEATURES.free[feature]) as boolean;
}

export function getRequiredPlanForFeature(feature: keyof typeof PLAN_FEATURES.free): string {
  const plans = Object.entries(PLAN_FEATURES).find(
    ([_, features]) => features[feature] === true
  );
  return plans ? plans[0] : "professional";
}

export function getInvoiceLimit(planType: PlanType | 'pro' | null): number {
  if (!planType) return PLAN_FEATURES.free.invoice_limit;
  const normalizedPlan = planType === 'pro' ? 'professional' : planType;
  return PLAN_FEATURES[normalizedPlan as keyof typeof PLAN_FEATURES]?.invoice_limit ?? 5;
}

export function getMaxAgents(planType: PlanType | 'pro' | null): number {
  if (!planType) return PLAN_FEATURES.free.max_agents;
  const normalizedPlan = planType === 'pro' ? 'professional' : planType;
  return PLAN_FEATURES[normalizedPlan as keyof typeof PLAN_FEATURES]?.max_agents ?? 1;
}

export { type PlanType };
