import { supabase } from "@/integrations/supabase/client";

export interface OcrUsageEvent {
  id: string;
  page_count: number;
  total_cents: number;
  unit_price_cents: number;
  file_name: string | null;
  source: string;
  contract_id: string | null;
  invoice_id: string | null;
  stripe_reported: boolean;
  created_at: string;
  ledger_id: string | null;
  /** Hydrated from the linked ledger row. */
  allocation?: "prepaid" | "overage" | "unbilled";
  /** Actual unit price (cents) used by the ledger entry (80 = prepaid, 100 = overage). */
  ledger_unit_price_cents?: number;
  /** Actual dollars charged for this event, reconciled to the ledger. */
  reconciled_dollars?: number;
}

export async function fetchOcrUsage(rangeDays = 30) {
  const since = new Date(Date.now() - rangeDays * 86400 * 1000).toISOString();
  const { data, error } = await supabase
    .from("ocr_usage_events")
    .select("id, page_count, total_cents, unit_price_cents, file_name, source, contract_id, invoice_id, stripe_reported, created_at, ledger_id")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const events = (data || []) as OcrUsageEvent[];
  const ledgerIds = events.map((e) => e.ledger_id).filter((x): x is string => !!x);

  let ledgerMap = new Map<string, { kind: string; unit_price_cents: number }>();
  if (ledgerIds.length > 0) {
    const { data: ledger } = await supabase
      .from("asc606_credit_ledger")
      .select("id, kind, unit_price_cents")
      .in("id", ledgerIds);
    (ledger || []).forEach((row: any) => ledgerMap.set(row.id, row));
  }

  return events.map((e) => {
    const ledger = e.ledger_id ? ledgerMap.get(e.ledger_id) : undefined;
    let allocation: OcrUsageEvent["allocation"] = "unbilled";
    let unit = e.unit_price_cents || 0;
    if (ledger) {
      unit = ledger.unit_price_cents || unit;
      allocation = ledger.kind === "overage_accrue" ? "overage" : ledger.kind === "consume" ? "prepaid" : "unbilled";
    }
    return {
      ...e,
      allocation,
      ledger_unit_price_cents: unit,
      reconciled_dollars: (e.page_count * unit) / 100,
    };
  });
}

export function summarizeOcrUsage(events: OcrUsageEvent[]) {
  const totalPages = events.reduce((s, e) => s + (e.page_count || 0), 0);
  // Reconciled to the ledger (prepaid @ $0.80, overage @ $1.00). Falls back to
  // legacy total_cents when the event has no ledger link.
  const totalCents = events.reduce(
    (s, e) => s + (e.reconciled_dollars != null ? Math.round(e.reconciled_dollars * 100) : (e.total_cents || 0)),
    0,
  );
  const prepaidPages = events.filter((e) => e.allocation === "prepaid").reduce((s, e) => s + e.page_count, 0);
  const overagePages = events.filter((e) => e.allocation === "overage").reduce((s, e) => s + e.page_count, 0);
  const unbilledPages = events.filter((e) => e.allocation === "unbilled" || !e.allocation).reduce((s, e) => s + e.page_count, 0);
  return {
    totalPages,
    totalCents,
    totalDollars: totalCents / 100,
    count: events.length,
    prepaidPages,
    overagePages,
    unbilledPages,
    prepaidDollars: (prepaidPages * 80) / 100,
    overageDollars: (overagePages * 100) / 100,
  };
}
