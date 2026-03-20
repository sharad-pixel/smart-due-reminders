import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Brain, ShieldAlert, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function RevenueRisk() {
  const navigate = useNavigate();
  const { data, isLoading, isFetching, refetch, generatingAI, regenerateWithAI } = useRevenueRisk();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/login");
    });
  }, [navigate]);

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
      </AppLayout>
    );
  }

  const aggregate = data?.aggregate;

  return (
    <AppLayout>
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
          <div className="flex items-center gap-2">
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
    </AppLayout>
  );
}
