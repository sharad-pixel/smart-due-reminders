import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { 
  Brain, 
  RefreshCw, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Minus,
  MessageSquare, 
  Target,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Zap,
  Mail,
  ChevronDown,
  ChevronUp,
  Info
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useDebtorIntelligence, useCollectionIntelligence } from "@/hooks/useCollectionIntelligence";
import { cn } from "@/lib/utils";

interface AccountIntelligencePanelProps {
  debtorId: string;
  debtorName?: string;
  onIntelligenceCalculated?: () => void;
}

interface Intelligence {
  riskLevel: "low" | "medium" | "high" | "critical" | "unknown";
  riskScore: number;
  executiveSummary: string;
  keyInsights: string[];
  recommendations: string[];
  paymentBehavior: string;
  communicationSentiment: string;
  collectionStrategy: string;
}

export function AccountIntelligencePanel({ 
  debtorId, 
  debtorName,
  onIntelligenceCalculated
}: AccountIntelligencePanelProps) {
  // Scorecard data
  const { data: scorecardData, isLoading: scorecardLoading, refetch: refetchScorecard } = useDebtorIntelligence(debtorId);
  const { calculateIntelligence } = useCollectionIntelligence(debtorId);
  
  // Report data
  const [reportLoading, setReportLoading] = useState(true);
  const [intelligence, setIntelligence] = useState<Intelligence | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isReportExpanded, setIsReportExpanded] = useState(true);

  // Load cached report on mount
  useEffect(() => {
    loadCachedReport();
  }, [debtorId, refreshKey]);

  // Listen for realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`debtor-intel-panel-${debtorId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "debtors",
          filter: `id=eq.${debtorId}`,
        },
        (payload) => {
          if (payload.new.intelligence_report_generated_at !== payload.old?.intelligence_report_generated_at) {
            setRefreshKey(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [debtorId]);

  const loadCachedReport = async () => {
    setReportLoading(true);
    try {
      const { data: debtor, error } = await supabase
        .from("debtors")
        .select("intelligence_report, intelligence_report_generated_at")
        .eq("id", debtorId)
        .single();

      if (error) {
        setReportLoading(false);
        setInitialLoadDone(true);
        return;
      }

      if (debtor?.intelligence_report && debtor?.intelligence_report_generated_at) {
        const cacheAge = Date.now() - new Date(debtor.intelligence_report_generated_at).getTime();
        const cacheAgeHours = cacheAge / (1000 * 60 * 60);

        if (cacheAgeHours < 24) {
          setIntelligence(debtor.intelligence_report as unknown as Intelligence);
          setGeneratedAt(debtor.intelligence_report_generated_at);
          setFromCache(true);
          setReportLoading(false);
          setInitialLoadDone(true);
          return;
        }
      }
      
      setReportLoading(false);
      setInitialLoadDone(true);
    } catch (error) {
      setReportLoading(false);
      setInitialLoadDone(true);
    }
  };

  const handleRecalculateAll = async () => {
    setIsRecalculating(true);
    try {
      // Run both scorecard + report generation in parallel
      await Promise.all([
        calculateIntelligence.mutateAsync({ debtor_id: debtorId }),
        (async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const { data, error } = await supabase.functions.invoke("account-intelligence", {
              body: { debtor_id: debtorId, force_regenerate: true },
            });
            if (!error && data?.intelligence) {
              setIntelligence(data.intelligence);
              setGeneratedAt(data.generatedAt);
              setFromCache(false);
            }
          }
        })(),
      ]);

      await refetchScorecard();
      onIntelligenceCalculated?.();
      toast.success("Intelligence updated");
    } catch (error: any) {
      console.error("Error calculating intelligence:", error);
      toast.error(error.message || "Failed to run intelligence");
    } finally {
      setIsRecalculating(false);
    }
  };

  // Helper functions
  const getHealthColor = (tier: string | null) => {
    switch (tier) {
      case "Healthy": return "text-green-600";
      case "Watch": return "text-yellow-600";
      case "At Risk": return "text-orange-600";
      case "Critical": return "text-red-600";
      default: return "text-muted-foreground";
    }
  };

  const getHealthBadgeStyle = (tier: string | null) => {
    switch (tier) {
      case "Healthy": return "bg-green-100 text-green-700 border-green-200";
      case "Watch": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "At Risk": return "bg-orange-100 text-orange-700 border-orange-200";
      case "Critical": return "bg-red-100 text-red-700 border-red-200";
      default: return "bg-muted text-muted-foreground border-muted";
    }
  };

  const getCardBorderStyle = (tier: string | null) => {
    switch (tier) {
      case "Healthy": return "border-green-300";
      case "Watch": return "border-yellow-300";
      case "At Risk": return "border-orange-300";
      case "Critical": return "border-red-300";
      default: return "border-border";
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "bg-muted";
    if (score >= 75) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    if (score >= 25) return "bg-orange-500";
    return "bg-red-500";
  };

  const getSentimentColor = (sentiment: string | null) => {
    switch (sentiment?.toLowerCase()) {
      case "positive": return "text-green-600";
      case "negative": case "hostile": return "text-red-600";
      case "delaying": return "text-orange-600";
      default: return "text-muted-foreground";
    }
  };

  const getTrendIcon = (avgDays: number | null) => {
    if (avgDays === null) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (avgDays <= 30) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (avgDays <= 60) return <Minus className="h-4 w-4 text-yellow-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "low": return "bg-green-100 text-green-800 border-green-200";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "high": return "bg-orange-100 text-orange-800 border-orange-200";
      case "critical": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case "low": return <CheckCircle2 className="h-4 w-4" />;
      case "medium": return <AlertCircle className="h-4 w-4" />;
      case "high": return <AlertTriangle className="h-4 w-4" />;
      case "critical": return <XCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  // Loading state
  if (scorecardLoading && !initialLoadDone) {
    return (
      <Card className="overflow-hidden border-2">
        <CardContent className="p-6 space-y-6">
          <div className="flex justify-between items-start">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-14 w-20" />
          </div>
          <Skeleton className="h-4 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const score = scorecardData?.collection_intelligence_score;
  const tier = scorecardData?.collection_health_tier;
  const paidInvoices = scorecardData?.paid_invoices_count ?? 0;
  const overdueInvoices = scorecardData?.overdue_invoices_count ?? 0;
  const pastDueBalance = scorecardData?.total_open_balance || scorecardData?.current_balance || 0;
  const hasInvoiceData = paidInvoices > 0 || overdueInvoices > 0 || (scorecardData?.open_invoices_count || 0) > 0;

  return (
    <Card className={cn("overflow-hidden border-2 transition-all", getCardBorderStyle(tier))}>
      <CardContent className="p-0">
        {/* Header Section */}
        <div className="p-5 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Brain className="h-6 w-6 text-primary" />
              <div>
                {debtorName && (
                  <h3 className="font-semibold text-lg">{debtorName}</h3>
                )}
                <Badge 
                  variant="outline" 
                  className={cn("mt-1", getHealthBadgeStyle(tier))}
                >
                  {tier || "Unscored"}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRecalculateAll}
                disabled={isRecalculating}
                className="gap-2"
              >
                <RefreshCw className={cn("h-4 w-4", isRecalculating && "animate-spin")} />
                Run Intelligence
              </Button>
              <div className={cn(
                "text-4xl font-bold",
                getHealthColor(tier)
              )}>
                {score ?? "—"}
              </div>
            </div>
          </div>
          
          {/* Score Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Collection Intelligence Score</span>
              <span>{score ?? 0}/100</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn("h-full rounded-full transition-all", getScoreColor(score))}
                style={{ width: `${score ?? 0}%` }}
              />
            </div>
          </div>

          {/* Updated timestamp */}
          {(scorecardData?.collection_score_updated_at || generatedAt) && (
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                Updated {formatDistanceToNow(new Date(scorecardData?.collection_score_updated_at || generatedAt!), { addSuffix: true })}
              </span>
              {fromCache && <Badge variant="secondary" className="text-xs">Cached</Badge>}
            </div>
          )}
        </div>

        {/* Key Metrics Grid */}
        <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* Invoices */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>Invoices</span>
            </div>
            <div className="text-sm font-medium">
              {hasInvoiceData ? (
                <span>
                  <span className="text-green-600">{paidInvoices}</span>
                  <span className="text-muted-foreground"> / </span>
                  <span className={overdueInvoices > 0 ? "text-red-600" : ""}>{overdueInvoices} due</span>
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>

          {/* Past Due Balance */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span>Past Due</span>
            </div>
            <span className={cn(
              "text-sm font-medium",
              pastDueBalance > 0 ? "text-red-600" : "text-green-600"
            )}>
              ${pastDueBalance.toLocaleString()}
            </span>
          </div>

          {/* Avg Days to Pay */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Avg Days</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">{scorecardData?.avg_days_to_pay ?? "—"}</span>
              {getTrendIcon(scorecardData?.avg_days_to_pay ?? null)}
            </div>
          </div>

          {/* Touchpoints */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span>Touchpoints</span>
            </div>
            <span className="text-sm font-medium">{scorecardData?.touchpoint_count || 0}</span>
          </div>

          {/* Inbound Replies */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>Replies</span>
            </div>
            <span className="text-sm font-medium">{scorecardData?.inbound_email_count ?? 0}</span>
          </div>

          {/* Sentiment */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span>Sentiment</span>
            </div>
            <span className={cn("text-sm font-medium capitalize", getSentimentColor(scorecardData?.avg_response_sentiment ?? null))}>
              {scorecardData?.avg_response_sentiment || "—"}
            </span>
          </div>
        </div>

        {/* Response Rate */}
        <div className="px-5 pb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Response Rate</span>
            <span className="text-xs font-medium">{scorecardData?.response_rate?.toFixed(0) || 0}%</span>
          </div>
          <Progress value={scorecardData?.response_rate || 0} className="h-1.5" />
        </div>

        {/* AI Report Section - Collapsible */}
        <Collapsible open={isReportExpanded} onOpenChange={setIsReportExpanded}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-4 border-t border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Target className="h-4 w-4 text-primary" />
                AI Intelligence Report
              </div>
              {isReportExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="p-5 border-t border-border/30 space-y-4">
              {reportLoading && !intelligence ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : !intelligence ? (
                <div className="text-center py-6">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
                    <Info className="h-4 w-4" />
                    <span>Reports auto-refresh daily at 5 AM PT</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click "Run Intelligence" above to generate a report
                  </p>
                </div>
              ) : (
                <>
                  {/* Risk Level Banner */}
                  <div className={`p-3 rounded-lg border-2 ${getRiskColor(intelligence.riskLevel)}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getRiskIcon(intelligence.riskLevel)}
                        <div>
                          <div className="font-semibold uppercase text-sm">
                            {intelligence.riskLevel} Risk
                          </div>
                          <div className="text-xs opacity-80">
                            Score: {intelligence.riskScore}/100
                          </div>
                        </div>
                      </div>
                      <div className="text-2xl font-bold">{intelligence.riskScore}</div>
                    </div>
                  </div>

                  {/* Executive Summary */}
                  {intelligence.executiveSummary && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <h4 className="font-semibold text-xs mb-1 flex items-center gap-1 text-muted-foreground uppercase tracking-wide">
                        Executive Summary
                      </h4>
                      <p className="text-sm">{intelligence.executiveSummary}</p>
                    </div>
                  )}

                  {/* Key Insights */}
                  {intelligence.keyInsights && intelligence.keyInsights.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-xs mb-2 flex items-center gap-1 text-muted-foreground uppercase tracking-wide">
                        <TrendingUp className="h-3 w-3" />
                        Key Insights
                      </h4>
                      <ul className="space-y-1.5">
                        {intelligence.keyInsights.slice(0, 3).map((insight, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommendations */}
                  {intelligence.recommendations && intelligence.recommendations.length > 0 && (
                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                      <h4 className="font-semibold text-xs mb-2 flex items-center gap-1 text-primary uppercase tracking-wide">
                        <Target className="h-3 w-3" />
                        Recommended Actions
                      </h4>
                      <ul className="space-y-1.5">
                        {intelligence.recommendations.slice(0, 3).map((rec, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <Badge variant="outline" className="shrink-0 text-xs h-5 w-5 p-0 flex items-center justify-center">{index + 1}</Badge>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Collection Strategy */}
                  {intelligence.collectionStrategy && (
                    <div className="p-3 border-2 border-primary/30 rounded-lg bg-primary/5">
                      <h5 className="text-xs font-semibold text-primary mb-1 uppercase tracking-wide">
                        Collection Strategy
                      </h5>
                      <p className="text-sm">{intelligence.collectionStrategy}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Footer note */}
        <div className="px-5 py-3 text-center border-t border-border/30 bg-muted/10">
          <span className="text-xs text-muted-foreground italic">
            Intelligence improves with more account activity and interactions
          </span>
        </div>
      </CardContent>
    </Card>
  );
}