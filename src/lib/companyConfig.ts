/**
 * Company Configuration
 * 
 * Centralized company information for use across the application.
 * This ensures consistent branding and legal entity references.
 */

export const COMPANY_INFO = {
  legalName: "RecouplyAI Inc.",
  displayName: "Recouply.ai",
  tagline: "Revenue Intelligence — from contract to cash",
  revopsStatement: "Revenue Intelligence — from contract to cash. Recouply reads every contract, tracks every obligation, and turns every receivable into a real-time signal so finance, sales, and CS run on one source of truth.",
  description: "Revenue Intelligence from contract to cash. Recouply unifies Contract Intelligence and Collection Intelligence — extracting every clause, obligation, and price, then guiding every invoice from issued to paid with AI-native workflows.",
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
