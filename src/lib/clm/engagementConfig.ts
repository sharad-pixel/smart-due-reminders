// Engagement Setup Wizard configuration & recommendation engine.
// Single source of truth for industries, engagement types, business models,
// and the rules that derive required documents, compliance flags, and approvals.

export type IndustryId =
  | "healthcare" | "saas" | "ai" | "financial_services" | "manufacturing"
  | "retail" | "logistics" | "professional_services" | "government" | "education"
  | "insurance" | "life_sciences" | "telecom" | "construction" | "energy"
  | "hospitality" | "media" | "marketplace" | "consumer_goods" | "other";

export type EngagementTypeId =
  | "saas_subscription" | "software_license" | "ai_platform" | "services_engagement"
  | "professional_services" | "managed_services" | "product_sale" | "distributor"
  | "marketplace" | "vendor" | "partner" | "pilot" | "poc" | "renewal"
  | "amendment" | "expansion" | "procurement";

export type BusinessModelId =
  | "subscription" | "usage_based" | "per_seat" | "consumption" | "goods"
  | "milestone" | "time_materials" | "fixed_fee" | "annual_commit"
  | "multi_year_ramp" | "platform_credits" | "hybrid";

export type ApproverRoleId =
  | "legal" | "finance" | "security" | "executive" | "procurement" | "deal_desk";

export type RiskLevel = "low" | "medium" | "high";

export const INDUSTRIES: { id: IndustryId; label: string }[] = [
  { id: "healthcare", label: "Healthcare" },
  { id: "saas", label: "SaaS / Software" },
  { id: "ai", label: "AI / Technology" },
  { id: "financial_services", label: "Financial Services" },
  { id: "manufacturing", label: "Manufacturing" },
  { id: "retail", label: "Retail / Ecommerce" },
  { id: "logistics", label: "Logistics / Transportation" },
  { id: "professional_services", label: "Professional Services" },
  { id: "government", label: "Government" },
  { id: "education", label: "Education" },
  { id: "insurance", label: "Insurance" },
  { id: "life_sciences", label: "Life Sciences" },
  { id: "telecom", label: "Telecom" },
  { id: "construction", label: "Construction" },
  { id: "energy", label: "Energy" },
  { id: "hospitality", label: "Hospitality" },
  { id: "media", label: "Media" },
  { id: "marketplace", label: "Marketplace" },
  { id: "consumer_goods", label: "Consumer Goods" },
  { id: "other", label: "Other" },
];

export const ENGAGEMENT_TYPES: { id: EngagementTypeId; label: string }[] = [
  { id: "saas_subscription", label: "SaaS Subscription" },
  { id: "software_license", label: "Software License" },
  { id: "ai_platform", label: "AI Platform" },
  { id: "services_engagement", label: "Services Engagement" },
  { id: "professional_services", label: "Professional Services" },
  { id: "managed_services", label: "Managed Services" },
  { id: "product_sale", label: "Product Sale" },
  { id: "distributor", label: "Distributor Agreement" },
  { id: "marketplace", label: "Marketplace Agreement" },
  { id: "vendor", label: "Vendor Agreement" },
  { id: "partner", label: "Partner Agreement" },
  { id: "pilot", label: "Pilot Program" },
  { id: "poc", label: "Proof of Concept" },
  { id: "renewal", label: "Renewal" },
  { id: "amendment", label: "Amendment" },
  { id: "expansion", label: "Enterprise Expansion" },
  { id: "procurement", label: "Procurement Agreement" },
];

export const BUSINESS_MODELS: { id: BusinessModelId; label: string }[] = [
  { id: "subscription", label: "Subscription" },
  { id: "usage_based", label: "Usage-Based" },
  { id: "per_seat", label: "Per Seat" },
  { id: "consumption", label: "Consumption-Based" },
  { id: "goods", label: "Goods / Product Sales" },
  { id: "milestone", label: "Milestone Billing" },
  { id: "time_materials", label: "Time & Materials" },
  { id: "fixed_fee", label: "Fixed Fee" },
  { id: "annual_commit", label: "Annual Commitment" },
  { id: "multi_year_ramp", label: "Multi-Year Ramp" },
  { id: "platform_credits", label: "Platform Fee + Usage Credits" },
  { id: "hybrid", label: "Hybrid Pricing" },
];

export const COMPANY_SIZES = ["1-50", "51-200", "201-1,000", "1,001-5,000", "5,000+"] as const;
export const REGIONS = ["North America", "EMEA", "APAC", "LATAM", "Global"] as const;
export const CUSTOMER_TYPES = ["Prospect", "Existing Customer", "Renewal", "Expansion"] as const;

export const APPROVER_LABELS: Record<ApproverRoleId, string> = {
  legal: "Legal",
  finance: "Finance",
  security: "Security",
  executive: "Executive",
  procurement: "Procurement",
  deal_desk: "Deal Desk",
};

// ------------------------------------------------------------------
// Recommendation engine
// ------------------------------------------------------------------

export const recommendDocuments = (
  industries: IndustryId[],
  engagement: EngagementTypeId | undefined,
  model: BusinessModelId | undefined,
): string[] => {
  const set = new Set<string>();
  // Defaults for almost every engagement
  set.add("MSA");
  set.add("Order Form");

  if (engagement === "saas_subscription" || engagement === "ai_platform" || engagement === "software_license") {
    set.add("DPA");
    set.add("SLA");
  }
  if (engagement === "services_engagement" || engagement === "professional_services" || engagement === "managed_services") {
    set.delete("Order Form");
    set.add("Services Agreement");
    set.add("SOW");
    set.add("Change Order");
  }
  if (engagement === "product_sale" || model === "goods") {
    set.delete("MSA");
    set.add("Purchase Agreement");
    set.add("Product Terms");
    set.add("Warranty Terms");
  }
  if (engagement === "marketplace" || engagement === "partner" || engagement === "distributor") {
    set.add("Partner Agreement");
    set.add("Revenue Share Terms");
    set.add("DPA");
  }
  if (engagement === "renewal" || engagement === "amendment") {
    set.add("Amendment");
  }
  if (engagement === "procurement" || engagement === "vendor") {
    set.add("Vendor Agreement");
    set.add("Code of Conduct");
  }

  // Industry layering
  if (industries.includes("healthcare")) {
    set.add("BAA");
    set.add("DPA");
    set.add("Security Addendum");
  }
  if (industries.includes("financial_services")) {
    set.add("Security Addendum");
    set.add("DPA");
  }
  if (industries.includes("ai")) {
    set.add("AI Usage Terms");
    set.add("DPA");
  }
  if (industries.includes("government")) {
    set.add("Government Terms");
    set.add("Security Addendum");
  }
  if (industries.includes("life_sciences")) {
    set.add("Quality Agreement");
    set.add("DPA");
  }

  return Array.from(set);
};

export interface ComplianceFlag {
  key: string;
  label: string;
}

export const recommendCompliance = (
  industries: IndustryId[],
  engagement: EngagementTypeId | undefined,
): ComplianceFlag[] => {
  const flags: ComplianceFlag[] = [];
  const add = (key: string, label: string) => {
    if (!flags.some((f) => f.key === key)) flags.push({ key, label });
  };

  if (industries.includes("healthcare")) {
    add("hipaa", "HIPAA compliance");
    add("baa_required", "Business Associate Agreement (BAA) required");
    add("phi_review", "PHI handling review");
  }
  if (industries.includes("financial_services") || industries.includes("insurance")) {
    add("soc2", "SOC 2 attestation");
    add("data_residency", "Data residency requirements");
    add("encryption_review", "Encryption review");
  }
  if (industries.includes("government")) {
    add("procurement_terms", "Government procurement terms");
    add("data_hosting", "Data hosting requirements");
    add("security_review", "Security review");
  }
  if (industries.includes("ai") || engagement === "ai_platform") {
    add("ai_usage", "AI usage terms");
    add("training_data", "Training data restrictions");
    add("model_disclaimer", "Model output disclaimers");
    add("dpa", "Data processing agreement");
  }
  if (industries.includes("life_sciences")) {
    add("gxp", "GxP / quality compliance");
  }
  if (industries.includes("education")) {
    add("ferpa", "FERPA compliance");
  }
  // Generic baseline
  if (flags.length === 0) {
    add("standard_review", "Standard legal review");
  }
  return flags;
};

export const recommendApprovals = (
  industries: IndustryId[],
  engagement: EngagementTypeId | undefined,
  model: BusinessModelId | undefined,
  compliance: ComplianceFlag[],
): { role: ApproverRoleId; reason: string }[] => {
  const out: { role: ApproverRoleId; reason: string }[] = [];
  const push = (role: ApproverRoleId, reason: string) => {
    if (!out.some((r) => r.role === role)) out.push({ role, reason });
  };

  push("legal", "Required for all engagements");
  push("finance", "Pricing & revenue recognition review");

  if (compliance.some((c) => ["hipaa", "soc2", "security_review", "encryption_review", "ai_usage", "data_hosting"].includes(c.key))) {
    push("security", "Compliance / security review required");
  }
  if (engagement === "expansion" || engagement === "renewal" || model === "multi_year_ramp" || model === "annual_commit") {
    push("deal_desk", "Multi-period or expansion deal");
  }
  if (engagement === "procurement" || engagement === "vendor" || industries.includes("government")) {
    push("procurement", "Procurement / vendor agreement");
  }
  if (industries.includes("government") || compliance.length >= 4) {
    push("executive", "High-risk or regulated engagement");
  }
  return out;
};

export const deriveRiskLevel = (
  industries: IndustryId[],
  model: BusinessModelId | undefined,
  compliance: ComplianceFlag[],
): RiskLevel => {
  let score = 0;
  if (industries.includes("healthcare")) score += 2;
  if (industries.includes("financial_services")) score += 2;
  if (industries.includes("government")) score += 3;
  if (industries.includes("ai")) score += 1;
  if (industries.includes("life_sciences")) score += 2;
  if (model === "multi_year_ramp" || model === "annual_commit") score += 1;
  score += Math.min(compliance.length, 4);
  if (score >= 6) return "high";
  if (score >= 3) return "medium";
  return "low";
};

export const RISK_BADGE: Record<RiskLevel, { label: string; className: string }> = {
  low: { label: "Low risk", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  medium: { label: "Medium risk", className: "bg-amber-100 text-amber-800 border-amber-200" },
  high: { label: "High risk", className: "bg-red-100 text-red-800 border-red-200" },
};
