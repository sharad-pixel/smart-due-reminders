import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useClmEntitlement } from "@/hooks/useClmEntitlement";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSearch, Sparkles, ArrowRight, Eye, CheckCircle2 } from "lucide-react";

/**
 * Quick-access card for Contract Intelligence on the dashboard.
 * Workspaces (CLM) UI is hidden until the module is GA — this card now
 * focuses entirely on the AI Smart Ingestion contract repository.
 */
export const ClmQuickAccessCard = () => {
  const { isActive, isLoading } = useClmEntitlement();

  const { data: counts } = useQuery({
    queryKey: ["contract-intel-quick-counts"],
    enabled: isActive,
    queryFn: async () => {
      const { data } = await supabase
        .from("live_contract_imports")
        .select("id, status")
        .neq("status", "archived")
        .limit(1000);
      const rows = data || [];
      const scanning = rows.filter((r) =>
        ["found", "queued", "scanning", "ocr_processing", "ai_extracting"].includes(String(r.status))
      ).length;
      const review = rows.filter((r) => r.status === "needs_review").length;
      const extracted = rows.filter((r) => ["imported", "approved"].includes(String(r.status))).length;
      return { total: rows.length, scanning, review, extracted };
    },
  });

  if (isLoading || !isActive) return null;

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Contract Intelligence
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Upload contracts, validate AI extraction, and turn them into invoiceable revenue.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/ai-ingestion">
              Open repository <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/ai-ingestion?status=scanning"
            className="group border rounded-lg p-4 hover:border-primary hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileSearch className="h-4 w-4 text-primary" /> Scanned
            </div>
            <p className="text-2xl font-semibold mt-2">{counts?.scanning ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">AI is extracting data</p>
          </Link>
          <Link
            to="/ai-ingestion?status=needs_review"
            className="group border rounded-lg p-4 hover:border-primary hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <Eye className="h-4 w-4 text-amber-600" /> Under Review
            </div>
            <p className="text-2xl font-semibold mt-2">{counts?.review ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">Awaiting validation</p>
          </Link>
          <Link
            to="/ai-ingestion?status=imported"
            className="group border rounded-lg p-4 hover:border-primary hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Extracted
            </div>
            <p className="text-2xl font-semibold mt-2">{counts?.extracted ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">Validated & live</p>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
