import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { 
  Brain, 
  RefreshCw, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  MessageSquare, 
  Target,
  Users,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Minus
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ScoringModelTooltip } from "@/components/ScoringModelTooltip";
import { usePaymentScore } from "@/hooks/usePaymentScore";

interface AccountIntelligenceCardProps {
  debtorId: string;
  // Risk engine props (optional - will be fetched if not provided)
  paymentScore?: number | null;
  riskTier?: string | null;
  riskStatusNote?: string | null;
  riskLastCalculatedAt?: string | null;
  avgDaysToPay?: number | null;
  maxDaysPastDue?: number | null;
  openInvoicesCount?: number | null;
  disputedInvoicesCount?: number | null;
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

export function AccountIntelligenceCard({ 
  debtorId,
  paymentScore: propPaymentScore,
  riskTier: propRiskTier,
  riskStatusNote: propRiskStatusNote,
  riskLastCalculatedAt: propRiskLastCalculatedAt,
  avgDaysToPay: propAvgDaysToPay,
  maxDaysPastDue: propMaxDaysPastDue,
  openInvoicesCount: propOpenInvoicesCount,
  disputedInvoicesCount: propDisputedInvoicesCount,
}: AccountIntelligenceCardProps) {
  const [loading, setLoading] = useState(true);
  const [intelligence, setIntelligence] = useState<Intelligence | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  
  // Local state for risk data if not provided via props
  const [localRiskData, setLocalRiskData] = useState<{
    paymentScore: number | null;
    riskTier: string | null;
    riskStatusNote: string | null;
    riskLastCalculatedAt: string | null;
    avgDaysToPay: number | null;
    maxDaysPastDue: number | null;
    openInvoicesCount: number | null;
    disputedInvoicesCount: number | null;
  }>({
    paymentScore: propPaymentScore ?? null,
    riskTier: propRiskTier ?? null,
    riskStatusNote: propRiskStatusNote ?? null,
    riskLastCalculatedAt: propRiskLastCalculatedAt ?? null,
    avgDaysToPay: propAvgDaysToPay ?? null,
    maxDaysPastDue: propMaxDaysPastDue ?? null,
    openInvoicesCount: propOpenInvoicesCount ?? null,
    disputedInvoicesCount: propDisputedInvoicesCount ?? null,
  });

  const { calculateScore } = usePaymentScore(debtorId);

  // Use props if provided, otherwise use local state
  const paymentScore = propPaymentScore ?? localRiskData.paymentScore;
  const riskTier = propRiskTier ?? localRiskData.riskTier;
  const riskStatusNote = propRiskStatusNote ?? localRiskData.riskStatusNote;
  const riskLastCalculatedAt = propRiskLastCalculatedAt ?? localRiskData.riskLastCalculatedAt;
  const avgDaysToPay = propAvgDaysToPay ?? localRiskData.avgDaysToPay;
  const maxDaysPastDue = propMaxDaysPastDue ?? localRiskData.maxDaysPastDue;
  const openInvoicesCount = propOpenInvoicesCount ?? localRiskData.openInvoicesCount;
  const disputedInvoicesCount = propDisputedInvoicesCount ?? localRiskData.disputedInvoicesCount;

  const isStillLearning = riskTier === "Still learning" || !riskTier;

  // Load cached report on mount
  useEffect(() => {
    loadCachedReport();
  }, [debtorId]);

  const loadCachedReport = async () => {
    setLoading(true);
    try {
      const { data: debtor, error } = await supabase
        .from("debtors")
        .select(`
          intelligence_report, 
          intelligence_report_generated_at,
          payment_score,
          payment_risk_tier,
          risk_status_note,
          risk_last_calculated_at,
          payment_score_last_calculated,
          avg_days_to_pay,
          max_days_past_due,
          open_invoices_count,
          disputed_invoices_count
        `)
        .eq("id", debtorId)
        .single();

      if (error) {
        console.error("[AccountIntelligenceCard] Error fetching debtor:", error);
        setLoading(false);
        setInitialLoadDone(true);
        return;
      }

      // Update local risk data if not provided via props
      if (propPaymentScore === undefined) {
        setLocalRiskData({
          paymentScore: debtor?.payment_score ?? null,
          riskTier: debtor?.payment_risk_tier ?? null,
          riskStatusNote: debtor?.risk_status_note ?? null,
          riskLastCalculatedAt: debtor?.risk_last_calculated_at ?? debtor?.payment_score_last_calculated ?? null,
          avgDaysToPay: debtor?.avg_days_to_pay ?? null,
          maxDaysPastDue: debtor?.max_days_past_due ?? null,
          openInvoicesCount: debtor?.open_invoices_count ?? null,
          disputedInvoicesCount: debtor?.disputed_invoices_count ?? null,
        });
      }

      if (debtor?.intelligence_report && debtor?.intelligence_report_generated_at) {
        const cacheAge = Date.now() - new Date(debtor.intelligence_report_generated_at).getTime();
        const cacheAgeHours = cacheAge / (1000 * 60 * 60);

        if (cacheAgeHours < 24) {
          setIntelligence(debtor.intelligence_report as unknown as Intelligence);
          setGeneratedAt(debtor.intelligence_report_generated_at);
          setFromCache(true);
          setLoading(false);
          setInitialLoadDone(true);
          return;
        }
      }
      
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

  const handleRecalculateRisk = () => {
    calculateScore.mutate({ debtor_id: debtorId });
  };

  // Risk styling helpers
  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score <= 30) return "text-green-600";
    if (score <= 55) return "text-yellow-600";
    if (score <= 75) return "text-orange-500";
    return "text-red-600";
  };

  const getScoreBg = (score: number | null) => {
    if (score === null) return "bg-muted";
    if (score <= 30) return "bg-green-500";
    if (score <= 55) return "bg-yellow-500";
    if (score <= 75) return "bg-orange-500";
    return "bg-red-500";
  };

  const getRiskBadge = (tier: string | null) => {
    if (!tier || tier === "Still learning") {
      return <Badge variant="secondary" className="bg-muted text-muted-foreground">Still Learning</Badge>;
    }
    
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
      Low: { variant: "default", className: "bg-green-100 text-green-800 hover:bg-green-100" },
      Medium: { variant: "default", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
      High: { variant: "default", className: "bg-orange-100 text-orange-800 hover:bg-orange-100" },
      Critical: { variant: "destructive", className: "" },
    };

    const config = variants[tier] || variants.Medium;
    return <Badge variant={config.variant} className={config.className}>{tier} Risk</Badge>;
  };

  const getRiskIcon = (tier: string | null) => {
    if (!tier || tier === "Still learning") return <Brain className="h-5 w-5 text-muted-foreground" />;
    if (tier === "Low") return <ShieldCheck className="h-5 w-5 text-green-600" />;
    if (tier === "Medium") return <Shield className="h-5 w-5 text-yellow-600" />;
    if (tier === "High") return <ShieldAlert className="h-5 w-5 text-orange-500" />;
    return <AlertTriangle className="h-5 w-5 text-red-600" />;
  };

  const getIntelligenceRiskColor = (level: string) => {
    switch (level) {
      case "low": return "bg-green-100 text-green-800 border-green-200";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "high": return "bg-orange-100 text-orange-800 border-orange-200";
      case "critical": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getIntelligenceRiskIcon = (level: string) => {
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
            Loading Collection Intelligence...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-4 gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            {getRiskIcon(riskTier)}
            Collection Intelligence
            <ScoringModelTooltip />
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      handleRecalculateRisk();
                      generateIntelligence(true);
                    }} 
                    disabled={loading || calculateScore.isPending}
                    title="Regenerate report"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading || calculateScore.isPending ? "animate-spin" : ""}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Recalculate Risk & Regenerate Intelligence</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* Combined Risk Score Section */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Risk Score Card */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Risk Assessment</span>
              {getRiskBadge(riskTier)}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Risk Score</span>
                <span className={`text-2xl font-bold ${getScoreColor(paymentScore)}`}>
                  {paymentScore !== null ? paymentScore : "—"}
                  <span className="text-sm font-normal text-muted-foreground">/100</span>
                </span>
              </div>
              <Progress 
                value={paymentScore ?? 0} 
                className={`h-2 ${isStillLearning ? "[&>div]:bg-muted" : `[&>div]:${getScoreBg(paymentScore)}`}`}
              />
              <p className="text-xs text-muted-foreground">Lower score = lower risk</p>
            </div>
            {riskLastCalculatedAt && (
              <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">
                Last calculated: {format(new Date(riskLastCalculatedAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            )}
          </div>

          {/* AI Intelligence Score Card */}
          {intelligence ? (
            <div className={`p-4 rounded-lg border-2 ${getIntelligenceRiskColor(intelligence.riskLevel)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getIntelligenceRiskIcon(intelligence.riskLevel)}
                  <div>
                    <div className="font-semibold uppercase text-sm">
                      {intelligence.riskLevel} Risk
                    </div>
                    <div className="text-xs opacity-80">
                      AI Risk Score: {intelligence.riskScore}/100
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{intelligence.riskScore}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/5 to-transparent flex flex-col items-center justify-center text-center">
              <Brain className="h-6 w-6 text-primary mb-2" />
              <p className="text-sm font-medium">AI Analysis</p>
              <p className="text-xs text-muted-foreground mb-2">
                Generate a detailed AI intelligence report
              </p>
              <Button size="sm" onClick={() => generateIntelligence(false)} disabled={loading}>
                <Brain className="h-4 w-4 mr-1" />
                Generate
              </Button>
            </div>
          )}
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Clock className="h-3 w-3" />
              Avg Days to Pay
            </div>
            <div className="text-lg font-bold flex items-center gap-1">
              {avgDaysToPay !== null ? (
                <>
                  {Math.round(avgDaysToPay)} days
                  {avgDaysToPay <= 30 ? (
                    <TrendingDown className="h-3 w-3 text-green-500" />
                  ) : avgDaysToPay > 60 ? (
                    <TrendingUp className="h-3 w-3 text-red-500" />
                  ) : (
                    <Minus className="h-3 w-3 text-yellow-500" />
                  )}
                </>
              ) : "—"}
            </div>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <AlertTriangle className="h-3 w-3" />
              Max Days Past Due
            </div>
            <div className="text-lg font-bold">
              {maxDaysPastDue !== null ? `${maxDaysPastDue} days` : "—"}
            </div>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign className="h-3 w-3" />
              Open Invoices
            </div>
            <div className="text-lg font-bold">{openInvoicesCount ?? 0}</div>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <XCircle className="h-3 w-3" />
              Disputed
            </div>
            <div className="text-lg font-bold">{disputedInvoicesCount ?? 0}</div>
          </div>
        </div>

        {/* Status Note */}
        {riskStatusNote && (
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">{riskStatusNote}</p>
          </div>
        )}

        {/* AI Intelligence Details (Collapsible) */}
        {intelligence && (
          <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  AI Intelligence Details
                </span>
                {isDetailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              {/* Executive Summary */}
              {intelligence.executiveSummary && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Executive Summary
                  </h4>
                  <p className="text-sm">{intelligence.executiveSummary}</p>
                </div>
              )}

              {/* Key Insights */}
              {intelligence.keyInsights && intelligence.keyInsights.length > 0 && (
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
              {intelligence.recommendations && intelligence.recommendations.length > 0 && (
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
                {intelligence.paymentBehavior && (
                  <div className="p-3 border rounded-lg">
                    <h5 className="text-xs font-semibold text-muted-foreground mb-1">Payment Behavior</h5>
                    <p className="text-sm">{intelligence.paymentBehavior}</p>
                  </div>
                )}
                {intelligence.communicationSentiment && (
                  <div className="p-3 border rounded-lg">
                    <h5 className="text-xs font-semibold text-muted-foreground mb-1">Communication Sentiment</h5>
                    <p className="text-sm">{intelligence.communicationSentiment}</p>
                  </div>
                )}
              </div>

              {intelligence.collectionStrategy && (
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
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Auto-refresh notice */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>
            Reports auto-refresh daily at 5 AM PT. Click refresh to regenerate manually.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default AccountIntelligenceCard;
