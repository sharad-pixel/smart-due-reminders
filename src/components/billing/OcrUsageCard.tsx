import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScanLine, AlertCircle } from "lucide-react";
import { fetchOcrUsage, summarizeOcrUsage } from "@/lib/supabase/ocrUsage";
import { OCR_PRICE_PER_PAGE_USD } from "@/components/ocr/OcrPricingNotice";

export const OcrUsageCard = () => {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["ocr-usage", 30],
    queryFn: () => fetchOcrUsage(30),
  });

  const summary = summarizeOcrUsage(events);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ScanLine className="h-4 w-4 text-primary" />
          AI Smart Ingestion Usage
          <Badge variant="outline" className="ml-2 text-[10px] font-normal">
            ${OCR_PRICE_PER_PAGE_USD.toFixed(2)} / page
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Tile label="Pages (30d)" value={isLoading ? "…" : String(summary.totalPages)} />
          <Tile label="Cost (30d)" value={isLoading ? "…" : `$${summary.totalDollars.toFixed(2)}`} />
          <Tile label="Scans" value={isLoading ? "…" : String(summary.count)} />
        </div>

        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No AI Smart Ingestion scans yet. Charges of ${OCR_PRICE_PER_PAGE_USD.toFixed(2)} per page apply when you upload invoices for extraction.
          </p>
        ) : (
          <div className="border rounded-md divide-y max-h-80 overflow-y-auto">
            {events.slice(0, 25).map((e) => (
              <div key={e.id} className="px-3 py-2 text-xs flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{e.file_name || e.source}</div>
                  <div className="text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()} · {e.page_count} page
                    {e.page_count === 1 ? "" : "s"}
                    {!e.stripe_reported && (
                      <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                        <AlertCircle className="h-3 w-3" /> not metered
                      </span>
                    )}
                  </div>
                </div>
                <div className="font-medium shrink-0">${(e.total_cents / 100).toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Tile = ({ label, value }: { label: string; value: string }) => (
  <div className="border rounded-md p-2.5 bg-muted/30">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="text-base font-semibold mt-1">{value}</div>
  </div>
);

export default OcrUsageCard;
