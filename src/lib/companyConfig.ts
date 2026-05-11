/**
 * Company Configuration
 * 
 * Centralized company information for use across the application.
 * This ensures consistent branding and legal entity references.
 */

export const COMPANY_INFO = {
  legalName: "RecouplyAI Inc.",
  displayName: "Recouply.ai",
  tagline: "Revenue Intelligence Platform",
  revopsStatement: "Cash is the lifeblood of Revenue Operations. Recouply turns every receivable into a real-time RevOps signal—so finance, sales, and CS run on the same source of truth.",
  description: "Revenue Intelligence Platform for Finance & RevOps teams. Cash is the lifeblood of revenue operations—Recouply analyzes every touchpoint (accounts, communications, payments, tasks, notes) to protect cash flow and maximize receivables recovery.",
  website: "https://recouply.ai",
  emails: {
    collections: "collections@recouply.ai",
    support: "support@recouply.ai",
    notifications: "notifications@recouply.ai",
    sales: "sales@recouply.ai",
  },
  address: {
    state: "Delaware",
    country: "USA",
    full: "Delaware, USA",
  },
  social: {
    linkedin: "https://www.linkedin.com/company/recouplyai-inc",
  },
  legal: {
    disclaimer: "AI-powered software as a service. Not a collection agency.",
    copyright: (year: number = new Date().getFullYear()) => 
      `© ${year} ${COMPANY_INFO.legalName}. All rights reserved.`,
  },
} as const;

export default COMPANY_INFO;
