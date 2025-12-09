/**
 * Company Configuration
 * 
 * Centralized company information for use across the application.
 * This ensures consistent branding and legal entity references.
 */

export const COMPANY_INFO = {
  legalName: "RecouplyAI Inc.",
  displayName: "Recouply.ai",
  tagline: "Collection Intelligence Platform",
  description: "AI-powered collection intelligence platform that analyzes every touchpoint—accounts, communications, payments, tasks, and notes—to maximize receivables recovery.",
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
    linkedin: "https://linkedin.com/company/recouply",
  },
  legal: {
    disclaimer: "AI-powered software as a service. Not a collection agency.",
    copyright: (year: number = new Date().getFullYear()) => 
      `© ${year} ${COMPANY_INFO.legalName}. All rights reserved.`,
  },
} as const;

export default COMPANY_INFO;
