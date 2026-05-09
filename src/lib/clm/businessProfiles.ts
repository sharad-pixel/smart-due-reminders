/**
 * Industry-agnostic CLM business profiles.
 * Each profile defines the metadata fields surfaced in workspace setup
 * and used to drive approval rules. Healthcare-specific fields only
 * appear when the Healthcare profile is selected.
 */

export type BusinessProfileId =
  | "general"
  | "saas"
  | "goods"
  | "services"
  | "healthcare";

export interface ProfileMetaField {
  key: string;
  label: string;
  type: "text" | "number" | "currency" | "select" | "boolean";
  options?: string[];
  placeholder?: string;
  helper?: string;
}

export interface BusinessProfileDef {
  id: BusinessProfileId;
  label: string;
  short: string;
  description: string;
  fields: ProfileMetaField[];
  /** Industry categories this profile pre-filters in the template gallery */
  templateCategories: string[];
}

export const BUSINESS_PROFILES: BusinessProfileDef[] = [
  {
    id: "general",
    label: "General / Other",
    short: "General",
    description: "NDAs, vendor agreements, partnerships, custom paper.",
    templateCategories: ["general", "legal"],
    fields: [
      { key: "deal_value", label: "Estimated deal value", type: "currency", placeholder: "0" },
      { key: "term_months", label: "Term (months)", type: "number", placeholder: "12" },
      { key: "governing_law", label: "Governing law", type: "text", placeholder: "Delaware" },
    ],
  },
  {
    id: "saas",
    label: "SaaS / Subscription",
    short: "SaaS",
    description: "MSAs, Order Forms, SOWs, DPAs, SLAs.",
    templateCategories: ["saas", "general", "legal"],
    fields: [
      { key: "arr", label: "ARR", type: "currency" },
      { key: "tcv", label: "TCV", type: "currency" },
      { key: "acv", label: "ACV", type: "currency" },
      { key: "subscription_term_months", label: "Subscription term (months)", type: "number" },
      { key: "billing_frequency", label: "Billing frequency", type: "select", options: ["Monthly", "Quarterly", "Annual", "Multi-year prepaid"] },
      { key: "payment_terms_days", label: "Payment terms (net days)", type: "number", placeholder: "30" },
      { key: "auto_renewal", label: "Auto-renewal", type: "boolean" },
      { key: "usage_commitments", label: "Usage commitments", type: "text", placeholder: "e.g. 100k API calls/mo" },
      { key: "overage_rate", label: "Overage rate", type: "text", placeholder: "$0.001 per call" },
    ],
  },
  {
    id: "goods",
    label: "Goods / Product",
    short: "Goods",
    description: "Purchase, supply, distributor, reseller agreements.",
    templateCategories: ["goods", "general", "legal"],
    fields: [
      { key: "product_skus", label: "Product SKUs", type: "text", placeholder: "Comma-separated" },
      { key: "quantity", label: "Quantity", type: "number" },
      { key: "unit_price", label: "Unit price", type: "currency" },
      { key: "delivery_terms", label: "Delivery terms (Incoterms)", type: "select", options: ["FOB", "CIF", "DDP", "EXW", "FCA", "Other"] },
      { key: "warranty_months", label: "Warranty (months)", type: "number" },
      { key: "return_window_days", label: "Return window (days)", type: "number" },
      { key: "payment_terms_days", label: "Payment terms (net days)", type: "number" },
      { key: "po_required", label: "Purchase order required", type: "boolean" },
    ],
  },
  {
    id: "services",
    label: "Services / Professional",
    short: "Services",
    description: "Services agreements, engagement letters, SOWs, retainers.",
    templateCategories: ["services", "general", "legal"],
    fields: [
      { key: "scope_summary", label: "Scope summary", type: "text", placeholder: "Brief description of work" },
      { key: "project_fee", label: "Project fee", type: "currency" },
      { key: "hourly_rate", label: "Hourly rate", type: "currency" },
      { key: "retainer", label: "Retainer", type: "currency" },
      { key: "start_date", label: "Start date", type: "text", placeholder: "YYYY-MM-DD" },
      { key: "end_date", label: "End date", type: "text", placeholder: "YYYY-MM-DD" },
      { key: "milestone_billing", label: "Milestone billing", type: "boolean" },
      { key: "expense_reimbursement", label: "Expense reimbursement", type: "boolean" },
    ],
  },
  {
    id: "healthcare",
    label: "Healthcare / Regulated",
    short: "Healthcare",
    description: "BAAs, HIPAA addendums, security & data processing addendums.",
    templateCategories: ["healthcare", "general", "legal"],
    fields: [
      { key: "baa_required", label: "BAA required", type: "boolean" },
      { key: "phi_handling", label: "PHI handled", type: "boolean" },
      { key: "breach_notification_hours", label: "Breach notification window (hours)", type: "number", placeholder: "24" },
      { key: "subcontractors_allowed", label: "Subcontractors allowed", type: "boolean" },
      { key: "data_residency", label: "Data residency", type: "select", options: ["US", "EU", "UK", "Canada", "Other"] },
      { key: "security_framework", label: "Security framework", type: "select", options: ["SOC 2", "HITRUST", "ISO 27001", "Other"] },
    ],
  },
];

export const getBusinessProfile = (id: string | null | undefined): BusinessProfileDef => {
  return BUSINESS_PROFILES.find((p) => p.id === id) ?? BUSINESS_PROFILES[0];
};

export const INDUSTRY_CATEGORIES = [
  { id: "general", label: "General Legal" },
  { id: "saas", label: "SaaS / Subscription" },
  { id: "goods", label: "Goods / Product" },
  { id: "services", label: "Services" },
  { id: "healthcare", label: "Healthcare / Regulated" },
] as const;
