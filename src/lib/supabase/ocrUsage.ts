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
}

export async function fetchOcrUsage(rangeDays = 30) {
  const since = new Date(Date.now() - rangeDays * 86400 * 1000).toISOString();
  const { data, error } = await supabase
    .from("ocr_usage_events")
    .select("id, page_count, total_cents, unit_price_cents, file_name, source, contract_id, invoice_id, stripe_reported, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as OcrUsageEvent[];
}

export function summarizeOcrUsage(events: OcrUsageEvent[]) {
  const totalPages = events.reduce((s, e) => s + (e.page_count || 0), 0);
  const totalCents = events.reduce((s, e) => s + (e.total_cents || 0), 0);
  return { totalPages, totalCents, totalDollars: totalCents / 100, count: events.length };
}
