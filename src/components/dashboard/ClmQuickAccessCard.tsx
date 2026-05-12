import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useClmEntitlement } from "@/hooks/useClmEntitlement";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSignature, FileSearch, Sparkles, ArrowRight } from "lucide-react";

export const ClmQuickAccessCard = () => {
  const { isActive, isLoading } = useClmEntitlement();

  const { data: counts } = useQuery({
    queryKey: ["clm-quick-access-counts"],
    enabled: isActive,
    queryFn: async () => {
      const [imports, instances] = await Promise.all([
        supabase
          .from("live_contract_imports")
          .select("id, status", { count: "exact", head: false })
          .limit(1000),
        supabase
          .from("clm_instances")
          .select("id", { count: "exact", head: true }),
      ]);
      const rows = imports.data || [];
      return {
        ocrTotal: rows.length,
        ocrNeedsReview: rows.filter((r) => r.status === "needs_review").length,
        workspaces: instances.count || 0,
      };
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
              Manage live workspaces and OCR-scanned contracts with Kurt.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/contracts">
              Open Kurt <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            to="/contracts"
            className="group border rounded-lg p-4 hover:border-primary hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileSignature className="h-4 w-4 text-primary" />
                  Live Workspaces
                </div>
                <p className="text-2xl font-semibold mt-2">
                  {counts?.workspaces ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Active CLM instances
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Link>

          <Link
            to="/contracts/live"
            className="group border rounded-lg p-4 hover:border-primary hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileSearch className="h-4 w-4 text-primary" />
                  OCR Contracts
                </div>
                <p className="text-2xl font-semibold mt-2">
                  {counts?.ocrTotal ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {counts?.ocrNeedsReview
                    ? `${counts.ocrNeedsReview} need review`
                    : "Scanned & extracted"}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
