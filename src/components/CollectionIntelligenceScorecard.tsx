import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Brain, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  MessageSquare,
  FileText,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  Mail,
  Zap
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useDebtorIntelligence, useCollectionIntelligence, DebtorIntelligenceWithInvoices } from "@/hooks/useCollectionIntelligence";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CollectionIntelligenceScorecardProps {
  debtorId: string;
  debtorName?: string;
  compact?: boolean;
  onIntelligenceCalculated?: () => void; // Callback to refresh related components
}

export function CollectionIntelligenceScorecard({ 
  debtorId, 
  debtorName,
  compact = false,
  onIntelligenceCalculated
}: CollectionIntelligenceScorecardProps) {
  const { data, isLoading, refetch } = useDebtorIntelligence(debtorId);
  const { calculateIntelligence } = useCollectionIntelligence(debtorId);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      // Run both scorecard calculation AND intelligence report generation in parallel
      const [scorecardResult] = await Promise.all([
        calculateIntelligence.mutateAsync({ debtor_id: debtorId }),
        // Also trigger the account-intelligence edge function
        (async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await supabase.functions.invoke("account-intelligence", {
              body: { debtor_id: debtorId, force_regenerate: true },
            });
          }
        })()
      ]);
      
      await refetch();
      
      // Notify parent component to refresh intelligence report
      onIntelligenceCalculated?.();
      
      toast.success("Intelligence calculated successfully");
    } catch (error: any) {
      console.error("Error calculating intelligence:", error);
      toast.error(error.message || "Failed to calculate intelligence");
    } finally {
      setIsRecalculating(false);
    }
  };

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
      case "Healthy": return "border-green-300 bg-green-50/30";
      case "Watch": return "border-yellow-300 bg-yellow-50/30";
      case "At Risk": return "border-orange-300 bg-orange-50/30";
      case "Critical": return "border-red-300 bg-red-50/30";
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
      case "neutral": return "text-muted-foreground";
      default: return "text-muted-foreground";
    }
  };

  const getTrendIcon = (avgDays: number | null) => {
    if (avgDays === null) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (avgDays <= 30) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (avgDays <= 60) return <Minus className="h-4 w-4 text-yellow-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  const getInsightMessage = (tier: string | null, hasSufficientData: boolean) => {
    if (!hasSufficientData) {
      return { icon: Brain, message: "Still learning. Add invoices or activities to build intelligence.", className: "bg-blue-100 text-blue-700" };
    }
    switch (tier) {
      case "Healthy":
        return { icon: CheckCircle, message: "Reliable payer. Standard follow-up cadence.", className: "bg-green-100 text-green-700" };
      case "Watch":
        return { icon: Clock, message: "Monitor closely. Increase touchpoint frequency.", className: "bg-yellow-100 text-yellow-700" };
      case "At Risk":
        return { icon: AlertTriangle, message: "Escalate to senior AR. Consider payment plan.", className: "bg-orange-100 text-orange-700" };
      case "Critical":
        return { icon: AlertTriangle, message: "Immediate action required. High write-off risk.", className: "bg-red-100 text-red-700" };
      default:
        return { icon: Brain, message: "Calculate intelligence to get insights.", className: "bg-muted text-muted-foreground" };
    }
  };

  if (isLoading) {
    return (
      <Card className="overflow-hidden border-2">
        <CardContent className="p-6 space-y-4">
          <div className="flex justify-between items-start">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-10 w-16" />
          </div>
          <Skeleton className="h-4 w-full" />
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="overflow-hidden border-2 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Brain className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No intelligence data available</p>
          <Button size="sm" onClick={handleRecalculate} disabled={isRecalculating}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isRecalculating && "animate-spin")} />
            Calculate Intelligence
          </Button>
        </CardContent>
      </Card>
    );
  }

  const score = data.collection_intelligence_score;
  const tier = data.collection_health_tier;
  
  // Use REAL invoice data from the hook
  const paidInvoices = data.paid_invoices_count ?? 0;
  const overdueInvoices = data.overdue_invoices_count ?? 0;
  const hasSufficientData = data.has_sufficient_data ?? false;
  const pastDueBalance = data.total_open_balance || data.current_balance || 0;

  // Check if we have any meaningful data
  const hasInvoiceData = paidInvoices > 0 || overdueInvoices > 0 || (data.open_invoices_count || 0) > 0;
  
  const insight = getInsightMessage(tier, hasSufficientData);
  const InsightIcon = insight.icon;

  // Compact version for list/table view
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm",
          getScoreColor(score)
        )}>
          {score ?? "—"}
        </div>
        <div className="flex-1 min-w-0">
          <Badge variant="outline" className={cn("text-xs", getHealthBadgeStyle(tier))}>
            {tier || "Unscored"}
          </Badge>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {data.touchpoint_count || 0}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {data.open_invoices_count || 0}
            </span>
            <span className={cn("flex items-center gap-1", getSentimentColor(data.avg_response_sentiment))}>
              {data.avg_response_sentiment || "—"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Full scorecard matching landing page design
  return (
    <Card className={cn("overflow-hidden border-2 transition-all", getCardBorderStyle(tier))}>
      <CardContent className="p-0">
        {/* Header with name and score */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-start justify-between mb-3">
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
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRecalculate}
                disabled={isRecalculating}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={cn("h-4 w-4", isRecalculating && "animate-spin")} />
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
              <span>Intelligence Score</span>
              <span>{score ?? 0}/100</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn("h-full rounded-full transition-all", getScoreColor(score))}
                style={{ width: `${score ?? 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="p-4 space-y-3">
          {/* Invoice Activity */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>Invoices</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {hasInvoiceData ? (
                <>
                  <span className="text-green-600">{paidInvoices} paid</span>
                  <span className="text-muted-foreground">·</span>
                  <span className={overdueInvoices > 0 ? "text-red-600" : "text-muted-foreground"}>
                    {overdueInvoices} overdue
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground italic">No invoices</span>
              )}
            </div>
          </div>

          {/* Past Due Balance */}
          <div className="flex items-center justify-between">
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Avg Days to Pay</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">{data.avg_days_to_pay ?? "—"}</span>
              {getTrendIcon(data.avg_days_to_pay)}
            </div>
          </div>

          {/* Touchpoints */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span>Touchpoints</span>
            </div>
            <span className="text-sm font-medium">{data.touchpoint_count || 0}</span>
          </div>

          {/* Inbound Replies */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>Inbound Replies</span>
            </div>
            <span className="text-sm font-medium">{data.inbound_email_count || 0}</span>
          </div>

          {/* Sentiment */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span>Sentiment</span>
            </div>
            <span className={cn("text-sm font-medium", getSentimentColor(data.avg_response_sentiment))}>
              {data.avg_response_sentiment || "—"}
            </span>
          </div>

          {/* Response Rate */}
          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Response Rate</span>
              <span className="text-xs font-medium">{data.response_rate?.toFixed(0) || 0}%</span>
            </div>
            <Progress value={data.response_rate || 0} className="h-1.5" />
          </div>
        </div>

        {/* Footer Insight */}
        <div className="px-4 pb-4">
          <div className={cn("p-3 rounded-lg text-sm flex items-center gap-2", insight.className)}>
            <InsightIcon className="h-4 w-4 flex-shrink-0" />
            <span>{insight.message}</span>
          </div>
        </div>

        {/* Last Updated */}
        {data.collection_score_updated_at && (
          <div className="px-4 pb-3 text-center">
            <span className="text-xs text-muted-foreground">
              Updated {formatDistanceToNow(new Date(data.collection_score_updated_at), { addSuffix: true })}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
