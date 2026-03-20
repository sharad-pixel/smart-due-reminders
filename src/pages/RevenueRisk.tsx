import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { useRevenueRisk } from "@/hooks/useRevenueRisk";
import { RevenueRiskOverview } from "@/components/revenue-risk/RevenueRiskOverview";
import { RevenueRiskDistribution } from "@/components/revenue-risk/RevenueRiskDistribution";
import { EngagementRiskView } from "@/components/revenue-risk/EngagementRiskView";
import { TopRiskAccounts } from "@/components/revenue-risk/TopRiskAccounts";
import { RevenueRiskAIInsights } from "@/components/revenue-risk/RevenueRiskAIInsights";
import { Button } from "@/components/ui/button";
import { RefreshCw, Brain, ShieldAlert, AlertTriangle, Printer, Download, FileSpreadsheet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  printRevenueRiskReport,
  exportTopRiskAccountsCsv,
  exportInvoiceRiskScoresCsv,
} from "@/lib/revenueRiskExport";
import { toast } from "sonner";

export default function RevenueRisk() {
  const navigate = useNavigate();
  const { data, isLoading, isFetching, refetch, generatingAI, regenerateWithAI } = useRevenueRisk();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/login");
    });
  }, [navigate]);

  const handlePrintPdf = () => {
    if (!data) {
      toast.error("No data to export. Please refresh first.");
      return;
    }
    printRevenueRiskReport(data);
  };

  const handleExportAccountsCsv = () => {
    if (!data?.top_risk_accounts?.length) {
      toast.error("No risk accounts to export.");
      return;
    }
    exportTopRiskAccountsCsv(data.top_risk_accounts);
    toast.success("Risk accounts CSV downloaded");
  };

  const handleExportInvoicesCsv = () => {
    if (!data?.invoice_scores?.length) {
      toast.error("No invoice scores to export.");
      return;
    }
    exportInvoiceRiskScoresCsv(data.invoice_scores);
    toast.success("Invoice risk scores CSV downloaded");
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6 p-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-72" />
          <Skeleton className="h-64" />
        </div>
      </Layout>
    );
  }

  const aggregate = data?.aggregate;

  return (
    <Layout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-7 w-7 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">Revenue Risk & Collectability Intelligence</h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Multi-signal AR risk analysis with engagement-adjusted expected credit loss
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Export dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={!data}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handlePrintPdf}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print / Save as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportAccountsCsv}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Risk Accounts (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportInvoicesCsv}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Invoice Risk Scores (CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              onClick={regenerateWithAI}
              disabled={generatingAI || isFetching}
            >
              {generatingAI ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Brain className="h-4 w-4 mr-2" />
              )}
              Generate AI Insights
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{data?.disclaimer || "Estimated Collectability & Expected Credit Loss (Operational Model). Not GAAP-certified. For internal decision-making only."}</span>
        </div>

        {/* A & B: AR Overview + Revenue at Risk */}
        {aggregate && <RevenueRiskOverview aggregate={aggregate} />}

        {/* C & D: Distribution + Engagement vs Risk */}
        <div className="grid gap-4 lg:grid-cols-2">
          {aggregate && <RevenueRiskDistribution distribution={aggregate.collectability_distribution} />}
          {aggregate && <EngagementRiskView engagement={aggregate.engagement_breakdown} />}
        </div>

        {/* AI Insights */}
        {data?.ai_insights && <RevenueRiskAIInsights insights={data.ai_insights} />}

        {/* E: Top Risk Accounts */}
        {data?.top_risk_accounts && (
          <TopRiskAccounts accounts={data.top_risk_accounts} />
        )}
      </div>
    </Layout>
  );
}
