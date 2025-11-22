type PlanType = "free" | "starter" | "growth" | "pro";

export const PLAN_FEATURES = {
  free: {
    can_use_invoice_line_items: false,
    invoice_limit: 5,
    can_have_team_users: false,
    can_manage_roles: false,
  },
  starter: {
    can_use_invoice_line_items: false,
    invoice_limit: 50,
    can_have_team_users: false,
    can_manage_roles: false,
  },
  growth: {
    can_use_invoice_line_items: false,
    invoice_limit: 200,
    can_have_team_users: true,
    can_manage_roles: true,
  },
  pro: {
    can_use_invoice_line_items: true,
    invoice_limit: null, // unlimited
    can_have_team_users: false,
    can_manage_roles: false,
  },
} as const;

export function canUseFeature(planType: PlanType | null, feature: keyof typeof PLAN_FEATURES.free): boolean {
  if (!planType) return PLAN_FEATURES.free[feature] as boolean;
  return (PLAN_FEATURES[planType]?.[feature] ?? PLAN_FEATURES.free[feature]) as boolean;
}

export function getRequiredPlanForFeature(feature: keyof typeof PLAN_FEATURES.free): string {
  const plans = Object.entries(PLAN_FEATURES).find(
    ([_, features]) => features[feature] === true
  );
  return plans ? plans[0] : "pro";
}
