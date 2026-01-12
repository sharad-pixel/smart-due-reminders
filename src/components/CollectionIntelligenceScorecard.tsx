import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  CheckCircle2,
  XCircle,
  Eye
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useDebtorIntelligence, useCollectionIntelligence } from "@/hooks/useCollectionIntelligence";
import { cn } from "@/lib/utils";

interface CollectionIntelligenceScorecardProps {
  debtorId: string;
  compact?: boolean;
}

export function CollectionIntelligenceScorecard({ 
  debtorId, 
  compact = false 
}: CollectionIntelligenceScorecardProps) {
  const { data, isLoading, refetch } = useDebtorIntelligence(debtorId);
  const { calculateIntelligence } = useCollectionIntelligence(debtorId);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      await calculateIntelligence.mutateAsync({ debtor_id: debtorId });
      await refetch();
    } finally {
      setIsRecalculating(false);
    }
  };

  const getHealthColor = (tier: string | null) => {
    switch (tier) {
      case "Healthy": return "bg-green-100 text-green-800 border-green-300";
      case "Watch": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "At Risk": return "bg-orange-100 text-orange-800 border-orange-300";
      case "Critical": return "bg-red-100 text-red-800 border-red-300";
      default: return "bg-muted text-muted-foreground border-muted";
    }
  };

  const getHealthIcon = (tier: string | null) => {
    switch (tier) {
      case "Healthy": return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "Watch": return <Eye className="h-4 w-4 text-yellow-600" />;
      case "At Risk": return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case "Critical": return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <Brain className="h-4 w-4 text-muted-foreground" />;
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
    if (avgDays <= 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (avgDays <= 30) return <Minus className="h-4 w-4 text-yellow-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  if (isLoading) {
    return (
      <Card className={cn("overflow-hidden", compact && "border-none shadow-none")}>
        <CardContent className={cn("space-y-3", compact ? "p-3" : "pt-6")}>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-full" />
          <div className="grid grid-cols-4 gap-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className={cn("overflow-hidden", compact && "border-none shadow-none")}>
        <CardContent className={cn("flex flex-col items-center justify-center", compact ? "p-3" : "py-8")}>
          <Brain className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No intelligence data</p>
          <Button size="sm" variant="outline" onClick={handleRecalculate} className="mt-2">
            <RefreshCw className="h-3 w-3 mr-1" />
            Calculate
          </Button>
        </CardContent>
      </Card>
    );
  }

  const score = data.collection_intelligence_score;
  const tier = data.collection_health_tier;

  // Compact version for list/table view
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm",
            getScoreColor(score)
          )}>
            {score ?? "—"}
          </div>
          <div className="absolute -bottom-1 -right-1">
            {getHealthIcon(tier)}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <Badge variant="outline" className={cn("text-xs", getHealthColor(tier))}>
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

  // Full scorecard
  return (
    <Card className="overflow-hidden border-2" style={{ borderColor: tier === "Critical" ? "rgb(239 68 68 / 0.5)" : tier === "At Risk" ? "rgb(249 115 22 / 0.5)" : undefined }}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-5 w-5 text-primary" />
            Collection Intelligence
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRecalculate}
            disabled={isRecalculating}
          >
            <RefreshCw className={cn("h-4 w-4", isRecalculating && "animate-spin")} />
          </Button>
        </div>
        {data.collection_score_updated_at && (
          <p className="text-xs text-muted-foreground">
            Updated {formatDistanceToNow(new Date(data.collection_score_updated_at), { addSuffix: true })}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score and Health Tier */}
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg",
            getScoreColor(score)
          )}>
            {score ?? "—"}
          </div>
          <div className="flex-1">
            <Badge className={cn("mb-1", getHealthColor(tier))}>
              {getHealthIcon(tier)}
              <span className="ml-1">{tier || "Unscored"}</span>
            </Badge>
            <Progress 
              value={score ?? 0} 
              className="h-2 mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Collection Health Score
            </p>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign className="h-3 w-3" />
              Open Balance
            </div>
            <div className="text-lg font-semibold">
              ${(data.total_open_balance || 0).toLocaleString()}
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Clock className="h-3 w-3" />
              Avg Days to Pay
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">
                {data.avg_days_to_pay ?? "—"}
              </span>
              {getTrendIcon(data.avg_days_to_pay)}
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <MessageSquare className="h-3 w-3" />
              Touchpoints
            </div>
            <div className="text-lg font-semibold">
              {data.touchpoint_count || 0}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                ({data.response_rate?.toFixed(0) || 0}% response)
              </span>
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <FileText className="h-3 w-3" />
              Open Invoices
            </div>
            <div className="text-lg font-semibold">
              {data.open_invoices_count || 0}
              {(data.max_days_past_due || 0) > 0 && (
                <span className="text-xs font-normal text-destructive ml-1">
                  ({data.max_days_past_due}d overdue)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sentiment Indicator */}
        {data.avg_response_sentiment && (
          <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
            <span className="text-xs text-muted-foreground">Communication Sentiment</span>
            <Badge variant="outline" className={getSentimentColor(data.avg_response_sentiment)}>
              {data.avg_response_sentiment}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
