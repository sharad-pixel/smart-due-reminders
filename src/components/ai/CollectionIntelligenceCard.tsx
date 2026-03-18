import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate, Link } from "react-router-dom";
import { 
  Brain, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Clock,
  ChevronRight,
  RefreshCw,
  Lightbulb,
  Target,
  BarChart3,
  Users,
  DollarSign,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";
import { useAIAnalytics, TrendAnalysis, Recommendation, Prediction, RiskAlert } from "@/hooks/useAIAnalytics";
import { cn } from "@/lib/utils";

interface IntelligenceReport {
  riskLevel: string;
  riskScore: number;
  executiveSummary: string;
  keyInsights: string[];
  recommendations: string[];
}

interface AccountWithIntelligence {
  id: string;
  company_name: string;
  name: string;
  total_open_balance: number | null;
  intelligence_report: Json | null;
  intelligence_report_generated_at: string | null;
}

export function CollectionIntelligenceCard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  
  // Intelligence data state
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<AccountWithIntelligence[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  // AI Analytics hook
  const { 
    data: aiData, 
    isLoading: aiLoading, 
    isError: aiError, 
    refetch: refetchAI, 
    isRefetching: aiRefetching 
  } = useAIAnalytics({ scope: "dashboard" });

  const fetchAccountsWithIntelligence = useCallback(async (): Promise<AccountWithIntelligence[]> => {
    setLoading(true);
    setLoadError(null);

    const timeoutMs = 12000;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Request timed out. Please try again."));
      }, timeoutMs);
    });

    try {
      const queryPromise = supabase
        .from("debtors")
        .select(
          "id, company_name, name, total_open_balance, intelligence_report, intelligence_report_generated_at",
        )
        .neq("is_archived", true)
        .gt("total_open_balance", 0) // Only show accounts with open balance
        .order("updated_at", { ascending: false })
        .limit(100);

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) throw error;

      // Filter to accounts with intelligence reports AND open balance > 0
      const accountsWithReports = (data || []).filter(
        (a) => a.intelligence_report !== null && (a.total_open_balance || 0) > 0
      );
      accountsWithReports.sort((a, b) => {
        const aTime = a.intelligence_report_generated_at
          ? new Date(a.intelligence_report_generated_at).getTime()
          : 0;
        const bTime = b.intelligence_report_generated_at
          ? new Date(b.intelligence_report_generated_at).getTime()
          : 0;
        return bTime - aTime;
      });

      setAccounts(accountsWithReports);
      return accountsWithReports;
    } catch (error: any) {
      console.error("[CollectionIntelligence] Error:", error);
      setLoadError(error?.message || "Failed to load intelligence.");
      setAccounts([]);
      return [];
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAccountsWithIntelligence();
  }, [fetchAccountsWithIntelligence]);

  const handleRefresh = async () => {
    setRegenerating(true);

    const prevLatestMs = latestReportTime
      ? new Date(latestReportTime).getTime()
      : 0;

    try {
      // Trigger both refreshes in parallel
      const [aiResult, intelligenceResult] = await Promise.all([
        refetchAI(),
        supabase.functions.invoke("daily-intelligence-reports"),
      ]);

      if (aiResult.error) throw aiResult.error;
      if (intelligenceResult.error) throw intelligenceResult.error;

      const processed = (intelligenceResult.data as any)?.processed;
      const failed = (intelligenceResult.data as any)?.failed;

      toast.success(
        typeof processed === "number"
          ? `Refreshing intelligence… (${processed} processed${failed ? `, ${failed} failed` : ""})`
          : "Refreshing intelligence data…",
      );

      // Poll for updates; stop early once we see a newer report timestamp
      let attempts = 0;
      const maxAttempts = 10;
      const pollInterval = setInterval(async () => {
        attempts++;
        const refreshed = await fetchAccountsWithIntelligence();
        const newLatestMs = refreshed[0]?.intelligence_report_generated_at
          ? new Date(refreshed[0].intelligence_report_generated_at).getTime()
          : 0;

        if (newLatestMs > prevLatestMs || attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setRegenerating(false);
          toast.success("Intelligence refresh complete");
        }
      }, 2500);
    } catch (error: any) {
      const message = error?.message || "Failed to refresh intelligence";
      toast.error(message);
      setRegenerating(false);
    }
  };

  // Utility functions
  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case "low": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
      case "medium": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100";
      case "high": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100";
      case "critical": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTrendIcon = (direction: TrendAnalysis["direction"]) => {
    switch (direction) {
      case "up": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "down": return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getPriorityColor = (priority: Recommendation["priority"]) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
      case "medium": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100";
      default: return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100";
    }
  };

  const getSeverityStyle = (severity: RiskAlert["severity"]) => {
    switch (severity) {
      case "critical": return "border-red-500 bg-red-50 dark:bg-red-950";
      case "warning": return "border-yellow-500 bg-yellow-50 dark:bg-yellow-950";
      default: return "border-blue-500 bg-blue-50 dark:bg-blue-950";
    }
  };

  // Calculate summary stats
  const criticalAccounts = accounts.filter(a => 
    (a.intelligence_report as unknown as IntelligenceReport)?.riskLevel?.toLowerCase() === "critical"
  );
  const highRiskAccounts = accounts.filter(a => 
    (a.intelligence_report as unknown as IntelligenceReport)?.riskLevel?.toLowerCase() === "high"
  );
  const recentReports = accounts.filter(a => {
    if (!a.intelligence_report_generated_at) return false;
    const ageHours = (Date.now() - new Date(a.intelligence_report_generated_at).getTime()) / (1000 * 60 * 60);
    return ageHours < 24;
  });

  const latestReportTime = accounts[0]?.intelligence_report_generated_at;
  const isRefreshing = regenerating || aiRefetching;
  const criticalAlerts = aiData?.riskAlerts?.filter(a => a.severity === "critical") || [];

  // Loading state
  if (loading && aiLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary animate-pulse" />
            Collection Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!loading && accounts.length === 0 && !aiData) {
    return (
      <Card className="border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="p-4 rounded-full bg-primary/10">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-lg">Collection Intelligence</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Add accounts and invoices to unlock AI-powered collection insights and risk analysis
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/debtors")} variant="outline" className="gap-2">
              <ChevronRight className="h-4 w-4" />
              Add Accounts
            </Button>
            <Button onClick={() => navigate("/invoices")} className="gap-2">
              <ChevronRight className="h-4 w-4" />
              Import Invoices
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Collection Intelligence</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                AI-powered insights across all collection activities
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {latestReportTime && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Updated {formatDistanceToNow(new Date(latestReportTime), { addSuffix: true })}
              </span>
            )}
            {criticalAlerts.length > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {criticalAlerts.length} Critical
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 bg-muted/30 rounded-lg text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{accounts.length}</div>
            <div className="text-xs text-muted-foreground">Analyzed</div>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg text-center border border-red-200 dark:border-red-800">
            <div className="flex items-center justify-center gap-1 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-600">{criticalAccounts.length}</div>
            <div className="text-xs text-red-600/80">Critical</div>
          </div>
          <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg text-center border border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="h-4 w-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-orange-600">{highRiskAccounts.length}</div>
            <div className="text-xs text-orange-600/80">High Risk</div>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-center border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Sparkles className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-600">{recentReports.length}</div>
            <div className="text-xs text-green-600/80">Updated Today</div>
          </div>
        </div>

        {/* AI Summary */}
        {aiData?.summary && (
          <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
            <p className="text-sm">{aiData.summary}</p>
          </div>
        )}

        {/* Tabs for different views */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="text-xs">
              <BarChart3 className="h-3 w-3 mr-1 hidden sm:inline" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1 hidden sm:inline" />
              Alerts
              {(criticalAlerts.length + criticalAccounts.length) > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 w-4 p-0 justify-center text-[10px]">
                  {criticalAlerts.length + criticalAccounts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="actions" className="text-xs">
              <Lightbulb className="h-3 w-3 mr-1 hidden sm:inline" />
              Actions
            </TabsTrigger>
            <TabsTrigger value="trends" className="text-xs">
              <TrendingUp className="h-3 w-3 mr-1 hidden sm:inline" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="forecast" className="text-xs">
              <Target className="h-3 w-3 mr-1 hidden sm:inline" />
              Forecast
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            {/* Accounts Requiring Attention */}
            {(criticalAccounts.length > 0 || highRiskAccounts.length > 0) && (
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Accounts Requiring Attention
                </h4>
                <div className="space-y-2">
                  {[...criticalAccounts, ...highRiskAccounts].slice(0, 4).map((account) => {
                    const report = account.intelligence_report as unknown as IntelligenceReport;
                    return (
                      <div
                        key={account.id}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => navigate(`/debtors/${account.id}`)}
                      >
                        <div className="flex items-center gap-2">
                          <Badge className={cn("text-xs", getRiskColor(report?.riskLevel))}>
                            {report?.riskLevel?.toUpperCase()}
                          </Badge>
                          <div>
                            <div className="text-sm font-medium">{account.company_name || account.name}</div>
                            <div className="text-xs text-muted-foreground">
                              ${(account.total_open_balance || 0).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Key Insights */}
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Key Insights
              </h4>
              <div className="space-y-2">
                {accounts
                  .slice(0, 3)
                  .filter(a => (a.intelligence_report as unknown as IntelligenceReport)?.keyInsights?.length > 0)
                  .map((account) => {
                    const report = account.intelligence_report as unknown as IntelligenceReport;
                    const topInsight = report?.keyInsights?.[0];
                    if (!topInsight) return null;
                    return (
                      <div
                        key={account.id}
                        className="p-2 bg-primary/5 rounded-lg border border-primary/20 cursor-pointer hover:bg-primary/10 transition-colors"
                        onClick={() => navigate(`/debtors/${account.id}`)}
                      >
                        <p className="text-xs">{topInsight}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          — {account.company_name || account.name}
                        </p>
                      </div>
                    );
                  })}
                {accounts.filter(a => (a.intelligence_report as unknown as IntelligenceReport)?.keyInsights?.length > 0).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">No insights available yet</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="mt-4 space-y-3">
            {/* AI Risk Alerts */}
            {aiData?.riskAlerts && aiData.riskAlerts.length > 0 && (
              <div className="space-y-2">
                {aiData.riskAlerts.map((alert, idx) => (
                  <div key={`ai-${idx}`} className={cn("p-3 rounded-lg border-l-4", getSeverityStyle(alert.severity))}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className={cn(
                        "h-4 w-4 shrink-0 mt-0.5",
                        alert.severity === "critical" ? "text-red-500" : 
                        alert.severity === "warning" ? "text-yellow-500" : "text-blue-500"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{alert.message}</p>
                        {(alert.accountName || alert.amount) && (
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {alert.accountName && alert.accountName !== "N/A" && (
                              alert.accountId ? (
                                <Link 
                                  to={`/debtors/${alert.accountId}`}
                                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                                >
                                  {alert.accountName}
                                  <ArrowRight className="h-3 w-3" />
                                </Link>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {alert.accountName}
                                </span>
                              )
                            )}
                            {alert.amount !== undefined && alert.amount > 0 && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {alert.amount.toLocaleString()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Critical/High Risk Account Alerts */}
            {[...criticalAccounts, ...highRiskAccounts].slice(0, 5).map((account) => {
              const report = account.intelligence_report as unknown as IntelligenceReport;
              const severity = report?.riskLevel?.toLowerCase() === "critical" ? "critical" : "warning";
              return (
                <div 
                  key={account.id} 
                  className={cn("p-3 rounded-lg border-l-4 cursor-pointer", getSeverityStyle(severity as RiskAlert["severity"]))}
                  onClick={() => navigate(`/debtors/${account.id}`)}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={cn(
                      "h-4 w-4 shrink-0 mt-0.5",
                      severity === "critical" ? "text-red-500" : "text-yellow-500"
                    )} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{account.company_name || account.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Risk Score: {report?.riskScore}/100 • ${(account.total_open_balance || 0).toLocaleString()} outstanding
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              );
            })}

            {(!aiData?.riskAlerts || aiData.riskAlerts.length === 0) && criticalAccounts.length === 0 && highRiskAccounts.length === 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-green-600 font-medium">All clear!</p>
                <p className="text-xs text-muted-foreground">No risk alerts at this time</p>
              </div>
            )}
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="actions" className="mt-4 space-y-3">
            {aiData?.recommendations && aiData.recommendations.length > 0 ? (
              aiData.recommendations.slice(0, 6).map((rec, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <Badge className={cn("shrink-0 mt-0.5 text-xs", getPriorityColor(rec.priority))}>
                    {rec.priority}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{rec.action}</p>
                    <p className="text-xs text-muted-foreground mt-1">{rec.impact}</p>
                    {rec.accountName && rec.accountName !== "N/A" && (
                      <div className="mt-1">
                        {rec.accountId ? (
                          <Link 
                            to={`/debtors/${rec.accountId}`}
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                          >
                            {rec.accountName}
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Account: {rec.accountName}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No recommendations at this time</p>
            )}
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="mt-4 space-y-3">
            {aiData?.trends && aiData.trends.length > 0 ? (
              aiData.trends.map((trend, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="shrink-0">
                    {getTrendIcon(trend.direction)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{trend.metric}</p>
                      <Badge variant="outline" className="text-xs">
                        {trend.direction === "stable" ? "—" : `${trend.change}%`} {trend.timeframe}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{trend.insight}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No trend data available</p>
            )}
          </TabsContent>

          {/* Forecast Tab */}
          <TabsContent value="forecast" className="mt-4 space-y-3">
            {aiData?.predictions && aiData.predictions.length > 0 ? (
              aiData.predictions.map((pred, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">{pred.metric}</p>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs",
                        pred.confidence === "high" ? "text-green-600" :
                        pred.confidence === "medium" ? "text-yellow-600" : "text-muted-foreground"
                      )}
                    >
                      {pred.confidence} confidence
                    </Badge>
                  </div>
                  <p className="text-lg font-bold">{pred.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{pred.rationale}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No predictions available</p>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="text-center pt-2 border-t">
          <p className="text-xs text-muted-foreground/70">
            Intelligence auto-refreshes daily • All insights logged for compliance
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
