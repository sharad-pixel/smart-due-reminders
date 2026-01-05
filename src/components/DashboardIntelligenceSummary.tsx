import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { 
  Brain, 
  AlertTriangle, 
  TrendingUp, 
  Clock,
  ChevronRight,
  RefreshCw,
  Zap
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

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

export function DashboardIntelligenceSummary() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<AccountWithIntelligence[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    void fetchAccountsWithIntelligence();
  }, []);

  const fetchAccountsWithIntelligence = async () => {
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
      console.log("[DashboardIntelligenceSummary] Fetching accounts with intelligence...");

      // Fetch all non-archived accounts and filter in memory for better data freshness
      const queryPromise = supabase
        .from("debtors")
        .select(
          "id, company_name, name, total_open_balance, intelligence_report, intelligence_report_generated_at",
        )
        .neq("is_archived", true)
        .order("updated_at", { ascending: false })
        .limit(100);

      const { data, error } = await Promise.race([
        queryPromise,
        timeoutPromise,
      ]);

      if (error) {
        console.error("[DashboardIntelligenceSummary] Query error:", error);
        throw error;
      }

      // Filter to accounts with intelligence reports
      const accountsWithReports = (data || []).filter(a => a.intelligence_report !== null);
      // Sort by report generation time
      accountsWithReports.sort((a, b) => {
        const aTime = a.intelligence_report_generated_at ? new Date(a.intelligence_report_generated_at).getTime() : 0;
        const bTime = b.intelligence_report_generated_at ? new Date(b.intelligence_report_generated_at).getTime() : 0;
        return bTime - aTime;
      });
      console.log("[DashboardIntelligenceSummary] Found accounts:", accountsWithReports.length);
      setAccounts(accountsWithReports);
    } catch (error: any) {
      console.error("[DashboardIntelligenceSummary] Error fetching intelligence data:", error);
      setLoadError(error?.message || "Failed to load intelligence.");
      setAccounts([]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const runIntelligenceReports = async () => {
    setRegenerating(true);
    try {
      const { error } = await supabase.functions.invoke("daily-intelligence-reports");
      if (error) throw error;
      toast.success("Intelligence reports regenerating...");
      
      // Poll for updates every 3 seconds for up to 30 seconds
      let attempts = 0;
      const maxAttempts = 10;
      const pollInterval = setInterval(async () => {
        attempts++;
        await fetchAccountsWithIntelligence();
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setRegenerating(false);
          toast.success("Intelligence refresh complete");
        }
      }, 3000);
    } catch (error: any) {
      toast.error(error.message || "Failed to trigger intelligence reports");
      setRegenerating(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case "low": return "bg-green-100 text-green-800 border-green-200";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "high": return "bg-orange-100 text-orange-800 border-orange-200";
      case "critical": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Collection Intelligence Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card className="border border-destructive/20 bg-destructive/5">
        <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="p-4 rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-lg">Collection Intelligence</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {loadError}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void fetchAccountsWithIntelligence()} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
            <Button onClick={() => navigate("/debtors")} className="gap-2">
              <ChevronRight className="h-4 w-4" />
              Add Accounts
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (accounts.length === 0) {
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
      <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Collection Intelligence Overview
          </CardTitle>
          <div className="flex items-center gap-2">
            {latestReportTime && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last updated {formatDistanceToNow(new Date(latestReportTime), { addSuffix: true })}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={runIntelligenceReports}
              disabled={regenerating}
            >
              <RefreshCw className={`h-4 w-4 ${regenerating ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-muted/30 rounded-lg text-center">
            <div className="text-3xl font-bold">{accounts.length}</div>
            <div className="text-xs text-muted-foreground">Accounts Analyzed</div>
          </div>
          <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg text-center border border-red-200 dark:border-red-800">
            <div className="text-3xl font-bold text-red-600">{criticalAccounts.length}</div>
            <div className="text-xs text-red-600/80">Critical Risk</div>
          </div>
          <div className="p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg text-center border border-orange-200 dark:border-orange-800">
            <div className="text-3xl font-bold text-orange-600">{highRiskAccounts.length}</div>
            <div className="text-xs text-orange-600/80">High Risk</div>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg text-center border border-green-200 dark:border-green-800">
            <div className="text-3xl font-bold text-green-600">{recentReports.length}</div>
            <div className="text-xs text-green-600/80">Updated Today</div>
          </div>
        </div>

        {/* Critical & High Risk Accounts */}
        {(criticalAccounts.length > 0 || highRiskAccounts.length > 0) && (
          <div>
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Accounts Requiring Attention
            </h4>
            <div className="space-y-2">
              {[...criticalAccounts, ...highRiskAccounts].slice(0, 5).map((account) => {
                const report = account.intelligence_report as unknown as IntelligenceReport;
                return (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => navigate(`/debtors/${account.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <Badge className={getRiskColor(report?.riskLevel)}>
                        {report?.riskLevel?.toUpperCase()}
                      </Badge>
                      <div>
                        <div className="font-medium">{account.company_name || account.name}</div>
                        <div className="text-xs text-muted-foreground">
                          ${(account.total_open_balance || 0).toLocaleString()} open balance
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-sm font-semibold">{report?.riskScore}/100</div>
                        <div className="text-xs text-muted-foreground">Risk Score</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Insights */}
        <div>
          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Key Insights Across Accounts
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
                    className="p-3 bg-primary/5 rounded-lg border border-primary/20 cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() => navigate(`/debtors/${account.id}`)}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-primary mt-0.5 shrink-0">•</span>
                      <div className="flex-1">
                        <p className="text-sm">{topInsight}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          — {account.company_name || account.name}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Auto-refresh Notice */}
        <div className="text-center pt-2 border-t space-y-1">
          <p className="text-xs text-muted-foreground/70">
            Intelligence reports auto-refresh daily at 5 AM PT
          </p>
          <p className="text-xs text-muted-foreground/60">
            All insights logged for team visibility and seamless handoffs
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
