import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Brain, 
  RefreshCw, 
  AlertTriangle, 
  TrendingUp, 
  MessageSquare, 
  Target,
  Users,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AccountIntelligenceCardProps {
  debtorId: string;
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

interface Metrics {
  account: {
    name: string;
    type: string;
    paymentScore: number | null;
    riskTier: string | null;
    avgDaysToPay: number | null;
  };
  financials: {
    totalOpenBalance: number;
    openInvoicesCount: number;
    totalInvoicesCount: number;
    avgDSO: number;
    disputedCount: number;
  };
  tasks: {
    openCount: number;
    completedCount: number;
    overdueCount: number;
  };
  communications: {
    inboundCount: number;
    lastContactDate: string | null;
  };
  contacts: Array<{
    name: string;
    title: string;
    outreachEnabled: boolean;
    isPrimary: boolean;
  }>;
}

export function AccountIntelligenceCard({ debtorId }: AccountIntelligenceCardProps) {
  const [loading, setLoading] = useState(true);
  const [intelligence, setIntelligence] = useState<Intelligence | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [cacheExpiresAt, setCacheExpiresAt] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Load cached report on mount
  useEffect(() => {
    loadCachedReport();
  }, [debtorId]);

  const loadCachedReport = async () => {
    setLoading(true);
    console.log("[AccountIntelligenceCard] Loading cached report for debtor:", debtorId);
    try {
      const { data: debtor, error } = await supabase
        .from("debtors")
        .select("intelligence_report, intelligence_report_generated_at")
        .eq("id", debtorId)
        .single();

      if (error) {
        console.error("[AccountIntelligenceCard] Error fetching debtor:", error);
        setLoading(false);
        setInitialLoadDone(true);
        return;
      }

      console.log("[AccountIntelligenceCard] Debtor data:", {
        hasReport: !!debtor?.intelligence_report,
        generatedAt: debtor?.intelligence_report_generated_at
      });

      if (debtor?.intelligence_report && debtor?.intelligence_report_generated_at) {
        const cacheAge = Date.now() - new Date(debtor.intelligence_report_generated_at).getTime();
        const cacheAgeHours = cacheAge / (1000 * 60 * 60);

        console.log("[AccountIntelligenceCard] Cache age:", cacheAgeHours.toFixed(1), "hours");

        if (cacheAgeHours < 24) {
          setIntelligence(debtor.intelligence_report as unknown as Intelligence);
          setGeneratedAt(debtor.intelligence_report_generated_at);
          setFromCache(true);
          setCacheExpiresAt(new Date(new Date(debtor.intelligence_report_generated_at).getTime() + 24 * 60 * 60 * 1000).toISOString());
          setLoading(false);
          setInitialLoadDone(true);
          return;
        }
      }
      
      // No valid cached report - show the generate button
      console.log("[AccountIntelligenceCard] No valid cache, showing generate button");
      setLoading(false);
      setInitialLoadDone(true);
    } catch (error) {
      console.error("[AccountIntelligenceCard] Error loading cached report:", error);
      setLoading(false);
      setInitialLoadDone(true);
    }
  };

  const generateIntelligence = async (forceRegenerate = false) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("account-intelligence", {
        body: { debtor_id: debtorId, force_regenerate: forceRegenerate },
      });

      if (error) throw error;

      if (data.error) {
        if (data.error.includes("Rate limit")) {
          toast.error("AI rate limit reached. Please try again in a moment.");
        } else if (data.error.includes("credits")) {
          toast.error("AI credits exhausted. Please add credits to continue.");
        } else {
          toast.error(data.error);
        }
        if (data.data) {
          setMetrics(data.data);
        }
        return;
      }

      setIntelligence(data.intelligence);
      setMetrics(data.metrics);
      setGeneratedAt(data.generatedAt);
      setFromCache(data.fromCache || false);
      setCacheExpiresAt(data.cacheExpiresAt || null);
      
      if (data.fromCache) {
        toast.info("Showing cached intelligence report");
      } else {
        toast.success("Collection Intelligence generated");
      }
    } catch (error: any) {
      console.error("Error generating intelligence:", error);
      toast.error(error.message || "Failed to generate intelligence");
    } finally {
      setLoading(false);
    }
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

  if (loading && !initialLoadDone) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary animate-pulse" />
            Loading Intelligence Report...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!intelligence && !loading) {
    return (
      <Card className="border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="p-4 rounded-full bg-primary/10">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-lg">Collection Intelligence</h3>
            <p className="text-sm text-muted-foreground mt-1">
              AI-powered risk analysis based on payment history, tasks, and communication patterns
            </p>
            <p className="text-xs text-muted-foreground/70 mt-2 italic">
              Reports are auto-generated daily at 5 AM PT
            </p>
          </div>
          <Button onClick={() => generateIntelligence(false)} className="gap-2">
            <Brain className="h-4 w-4" />
            Generate Intelligence Report
          </Button>
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
            Collection Intelligence Report
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {generatedAt && (
              <div className="flex flex-col items-end text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(generatedAt), { addSuffix: true })}
                  {fromCache && <Badge variant="secondary" className="text-xs ml-1">Cached</Badge>}
                </span>
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => generateIntelligence(true)} 
              disabled={loading}
              title="Regenerate report manually"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        {/* 24-hour auto-refresh notice */}
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>
            Reports auto-refresh daily at 5 AM PT. Click refresh to regenerate manually.
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Risk Level Banner */}
        {intelligence && (
          <div className={`p-4 rounded-lg border-2 ${getRiskColor(intelligence.riskLevel)}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getRiskIcon(intelligence.riskLevel)}
                <div>
                  <div className="font-semibold uppercase text-sm">
                    {intelligence.riskLevel} Risk
                  </div>
                  <div className="text-xs opacity-80">
                    Risk Score: {intelligence.riskScore}/100
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{intelligence.riskScore}</div>
              </div>
            </div>
          </div>
        )}

        {/* Executive Summary */}
        {intelligence?.executiveSummary && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Executive Summary
            </h4>
            <p className="text-sm">{intelligence.executiveSummary}</p>
          </div>
        )}

        {/* Key Metrics */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <DollarSign className="h-3 w-3" />
                Open Balance
              </div>
              <div className="text-lg font-bold">
                ${metrics.financials.totalOpenBalance.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Clock className="h-3 w-3" />
                Avg DSO
              </div>
              <div className="text-lg font-bold">
                {metrics.financials.avgDSO} days
              </div>
            </div>
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <AlertTriangle className="h-3 w-3" />
                Open Tasks
              </div>
              <div className="text-lg font-bold">
                {metrics.tasks.openCount}
                {metrics.tasks.overdueCount > 0 && (
                  <span className="text-xs text-destructive ml-1">
                    ({metrics.tasks.overdueCount} overdue)
                  </span>
                )}
              </div>
            </div>
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <MessageSquare className="h-3 w-3" />
                Inbound Messages
              </div>
              <div className="text-lg font-bold">
                {metrics.communications.inboundCount}
              </div>
            </div>
          </div>
        )}

        {/* Key Insights */}
        {intelligence?.keyInsights && intelligence.keyInsights.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Key Insights
            </h4>
            <ul className="space-y-2">
              {intelligence.keyInsights.map((insight, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {intelligence?.recommendations && intelligence.recommendations.length > 0 && (
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Recommended Actions
            </h4>
            <ul className="space-y-2">
              {intelligence.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <Badge variant="outline" className="shrink-0">{index + 1}</Badge>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Analysis Details */}
        <div className="grid md:grid-cols-2 gap-4">
          {intelligence?.paymentBehavior && (
            <div className="p-3 border rounded-lg">
              <h5 className="text-xs font-semibold text-muted-foreground mb-1">Payment Behavior</h5>
              <p className="text-sm">{intelligence.paymentBehavior}</p>
            </div>
          )}
          {intelligence?.communicationSentiment && (
            <div className="p-3 border rounded-lg">
              <h5 className="text-xs font-semibold text-muted-foreground mb-1">Communication Sentiment</h5>
              <p className="text-sm">{intelligence.communicationSentiment}</p>
            </div>
          )}
        </div>

        {intelligence?.collectionStrategy && (
          <div className="p-3 border-2 border-primary/30 rounded-lg bg-primary/5">
            <h5 className="text-xs font-semibold text-primary mb-1">Recommended Collection Strategy</h5>
            <p className="text-sm">{intelligence.collectionStrategy}</p>
          </div>
        )}

        {/* Contacts */}
        {metrics?.contacts && metrics.contacts.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Account Contacts
            </h4>
            <div className="flex flex-wrap gap-2">
              {metrics.contacts.map((contact, index) => (
                <Badge 
                  key={index} 
                  variant={contact.outreachEnabled ? "default" : "secondary"}
                  className="gap-1"
                >
                  {contact.isPrimary && <span className="text-xs">★</span>}
                  {contact.name}
                  {contact.title && <span className="opacity-70">({contact.title})</span>}
                  {!contact.outreachEnabled && <span className="text-xs opacity-60">• No outreach</span>}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Credibility Note */}
        <div className="text-center pt-2 border-t">
          <p className="text-xs text-muted-foreground/70 italic">
            Intelligence improves with more account activity and interactions
          </p>
        </div>
      </CardContent>
    </Card>
  );
}