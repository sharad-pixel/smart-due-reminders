import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScanLine } from "lucide-react";
import { fetchOcrUsage, summarizeOcrUsage } from "@/lib/supabase/ocrUsage";

export const OcrUsageCard = () => {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["ocr-usage", 30],
    queryFn: () => fetchOcrUsage(30),
  });

  const summary = summarizeOcrUsage(events);
  // 1 credit per page; dollars are reconciled from the ledger so prepaid usage
  // counts at $0.80/credit and overage at $1.00/credit.
  const credits30d = summary.totalPages;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ScanLine className="h-4 w-4 text-primary" />
          AI Smart Ingestion Activity
          <Badge variant="outline" className="ml-2 text-[10px] font-normal">
            1 credit / page
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <Tile label="Pages (30d)" value={isLoading ? "…" : String(summary.totalPages)} />
          <Tile
            label="Credits (30d)"
            value={isLoading ? "…" : String(credits30d)}
            sub={isLoading ? undefined : `= $${summary.totalDollars.toFixed(2)} reconciled`}
          />
          <Tile label="Scans" value={isLoading ? "…" : String(summary.count)} />
        </div>

        {!isLoading && summary.totalPages > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Tile
              label="Pre-paid credits used"
              value={`${summary.prepaidPages} credits`}
              sub={`$${summary.prepaidDollars.toFixed(2)} @ $0.80/credit`}
            />
            <Tile
              label="Standard credits (overage)"
              value={`${summary.overagePages} credits`}
              sub={`$${summary.overageDollars.toFixed(2)} @ $1.00/credit`}
            />
          </div>
        )}

        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No Smart Ingestion scans yet. Each page consumes 1 platform credit from your wallet.
          </p>
        ) : (
          <div className="border rounded-md divide-y max-h-80 overflow-y-auto">
            {events.slice(0, 25).map((e) => {
              const dollars = e.reconciled_dollars ?? (e.total_cents / 100);
              const badge =
                e.allocation === "overage" ? { label: "Overage", cls: "bg-amber-100 text-amber-800 border-amber-300" }
                : e.allocation === "prepaid" ? { label: "Pre-paid", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" }
                : { label: "Unbilled", cls: "bg-muted text-muted-foreground" };
              return (
                <div key={e.id} className="px-3 py-2 text-xs flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      <span className="truncate">{e.file_name || e.source}</span>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${badge.cls}`}>{badge.label}</Badge>
                    </div>
                    <div className="text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()} · {e.page_count} page
                      {e.page_count === 1 ? "" : "s"} · {e.page_count} credit
                      {e.page_count === 1 ? "" : "s"} @ ${((e.ledger_unit_price_cents ?? 0) / 100).toFixed(2)}/credit
                    </div>
                  </div>
                  <div className="font-medium shrink-0">${dollars.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Tile = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="border rounded-md p-2.5 bg-muted/30">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="text-base font-semibold mt-1">{value}</div>
    {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
  </div>
);

export default OcrUsageCard;
