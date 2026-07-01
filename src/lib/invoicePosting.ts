// Helpers for the Draft / Posted invoice lifecycle.
// Integrated invoices (Stripe, QuickBooks, NetSuite, Sage) are always treated
// as Posted — their lifecycle lives in the source system. Manual entries and
// invoices generated from OCR / Contract Intelligence use Draft → Posted.

const INTEGRATED_SOURCES = new Set([
  "stripe",
  "quickbooks",
  "netsuite",
  "sage",
  "sage_intacct",
]);

export type PostingState = "draft" | "posted";

export interface PostingLifecycleInvoice {
  integration_source?: string | null;
  source_system?: string | null;
  source_contract_id?: string | null;
  posting_state?: string | null;
}

/**
 * True when this invoice participates in the Draft / Posted lifecycle
 * (manual creation, OCR ingestion, or Contract Intelligence generation).
 * False for invoices synced in from an external system of record.
 */
export function usesPostingLifecycle(inv: PostingLifecycleInvoice | null | undefined): boolean {
  if (!inv) return false;
  if (inv.source_contract_id) return true;
  const src = (inv.integration_source ?? inv.source_system ?? "").toLowerCase();
  if (!src) return true; // default treat as user-owned
  return !INTEGRATED_SOURCES.has(src);
}

export function getPostingState(inv: PostingLifecycleInvoice | null | undefined): PostingState {
  return ((inv?.posting_state as PostingState) === "draft") ? "draft" : "posted";
}
