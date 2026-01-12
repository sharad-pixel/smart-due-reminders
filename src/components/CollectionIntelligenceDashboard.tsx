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
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Zap
} from "lucide-react";
import { useCollectionIntelligenceDashboard, useCollectionIntelligence, CollectionIntelligenceData } from "@/hooks/useCollectionIntelligence";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export function CollectionIntelligenceDashboard() {
  const navigate = useNavigate();
  const { data, summary, isLoading, refetch } = useCollectionIntelligenceDashboard();
  const { calculateIntelligence } = useCollectionIntelligence();
  const [isRecalculating, setIsRecalculating] = useState(false);

  const handleRecalculateAll = async () => {
    setIsRecalculating(true);
    try {
      await calculateIntelligence.mutateAsync({ recalculate_all: true });
      await refetch();
    } finally {
      setIsRecalculating(false);
    }
  };

  const getHealthColor = (tier: string | null) => {
    switch (tier) {
      case "Healthy": return "bg-green-500";
      case "Watch": return "bg-yellow-500";
      case "At Risk": return "bg-orange-500";
      case "Critical": return "bg-red-500";
      default: return "bg-muted";
    }
  };

  const getHealthBorderColor = (tier: string | null) => {
    switch (tier) {
      case "Healthy": return "border-green-500/50 bg-green-50 dark:bg-green-950/20";
      case "Watch": return "border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20";
      case "At Risk": return "border-orange-500/50 bg-orange-50 dark:bg-orange-950/20";
      case "Critical": return "border-red-500/50 bg-red-50 dark:bg-red-950/20";
      default: return "border-muted bg-muted/20";
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

  const getTrendIcon = (avgDays: number | null) => {
    if (avgDays === null) return <Minus className="h-3 w-3 text-muted-foreground" />;
    if (avgDays <= 0) return <TrendingUp className="h-3 w-3 text-green-600" />;
    if (avgDays <= 30) return <Minus className="h-3 w-3 text-yellow-600" />;
    return <TrendingDown className="h-3 w-3 text-red-600" />;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary animate-pulse" />
            Loading Collection Intelligence...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-48" />
        </CardContent>
      </Card>
    );
  }

  // Get accounts requiring attention (Critical and At Risk)
  const attentionAccounts = data
    ?.filter((d) => d.collection_health_tier === "Critical" || d.collection_health_tier === "At Risk")
    .slice(0, 6) || [];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Collection Intelligence Scorecards
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRecalculateAll}
            disabled={isRecalculating}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRecalculating && "animate-spin")} />
            Recalculate All
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          AI-powered health scoring based on invoice activity, payment practices, touchpoints, and engagement sentiment
        </p>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <div className="text-3xl font-bold text-primary">{summary.avgScore}</div>
              <div className="text-xs text-muted-foreground">Avg Score</div>
            </div>
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 text-center border border-green-200 dark:border-green-800">
              <div className="text-3xl font-bold text-green-600">{summary.healthyCount}</div>
              <div className="text-xs text-green-700">Healthy</div>
            </div>
            <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 text-center border border-yellow-200 dark:border-yellow-800">
              <div className="text-3xl font-bold text-yellow-600">{summary.watchCount}</div>
              <div className="text-xs text-yellow-700">Watch</div>
            </div>
            <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950/20 text-center border border-orange-200 dark:border-orange-800">
              <div className="text-3xl font-bold text-orange-600">{summary.atRiskCount}</div>
              <div className="text-xs text-orange-700">At Risk</div>
            </div>
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 text-center border border-red-200 dark:border-red-800">
              <div className="text-3xl font-bold text-red-600">{summary.criticalCount}</div>
              <div className="text-xs text-red-700">Critical</div>
            </div>
          </div>
        )}

        {/* Attention Required Section */}
        {attentionAccounts.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Accounts Requiring Attention
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {attentionAccounts.map((account) => (
                <AccountScorecard 
                  key={account.id} 
                  account={account}
                  onClick={() => navigate(`/debtors/${account.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Accounts Grid */}
        {data && data.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              All Accounts ({data.length})
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto">
              {data.map((account) => (
                <MiniScorecard 
                  key={account.id} 
                  account={account}
                  onClick={() => navigate(`/debtors/${account.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!data || data.length === 0) && (
          <div className="text-center py-8">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold">No accounts found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add accounts to start tracking collection intelligence
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Individual Account Scorecard
function AccountScorecard({ 
  account, 
  onClick 
}: { 
  account: CollectionIntelligenceData;
  onClick: () => void;
}) {
  const tier = account.collection_health_tier;
  const score = account.collection_intelligence_score;

  const getHealthBorderColor = (tier: string | null) => {
    switch (tier) {
      case "Healthy": return "border-green-500/50 bg-green-50/50 dark:bg-green-950/20";
      case "Watch": return "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20";
      case "At Risk": return "border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20";
      case "Critical": return "border-red-500/50 bg-red-50/50 dark:bg-red-950/20";
      default: return "border-muted";
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "bg-muted text-muted-foreground";
    if (score >= 75) return "bg-green-500 text-white";
    if (score >= 50) return "bg-yellow-500 text-white";
    if (score >= 25) return "bg-orange-500 text-white";
    return "bg-red-500 text-white";
  };

  return (
    <Card 
      className={cn(
        "cursor-pointer hover:shadow-md transition-all border-2",
        getHealthBorderColor(tier)
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">{account.company_name}</h4>
            <Badge variant="outline" className="text-xs mt-1">
              {tier || "Unscored"}
            </Badge>
          </div>
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0",
            getScoreColor(score)
          )}>
            {score ?? "—"}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Balance:</span>
            <span className="font-medium ml-1">${(account.total_open_balance || 0).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Invoices:</span>
            <span className="font-medium ml-1">{account.open_invoices_count || 0}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Touchpoints:</span>
            <span className="font-medium ml-1">{account.touchpoint_count || 0}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Response:</span>
            <span className="font-medium ml-1">{account.response_rate?.toFixed(0) || 0}%</span>
          </div>
        </div>

        {account.avg_response_sentiment && (
          <div className="mt-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground">Sentiment: </span>
            <span className={cn(
              "text-xs font-medium",
              account.avg_response_sentiment === "positive" ? "text-green-600" :
              account.avg_response_sentiment === "negative" ? "text-red-600" : "text-muted-foreground"
            )}>
              {account.avg_response_sentiment}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Mini scorecard for compact grid
function MiniScorecard({ 
  account, 
  onClick 
}: { 
  account: CollectionIntelligenceData;
  onClick: () => void;
}) {
  const score = account.collection_intelligence_score;
  const tier = account.collection_health_tier;

  const getScoreColor = (score: number | null) => {
    if (score === null) return "bg-muted";
    if (score >= 75) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    if (score >= 25) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div 
      className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors flex items-center gap-3"
      onClick={onClick}
    >
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0",
        getScoreColor(score)
      )}>
        {score ?? "—"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{account.company_name}</div>
        <div className="text-xs text-muted-foreground">
          ${(account.total_open_balance || 0).toLocaleString()} • {tier || "Unscored"}
        </div>
      </div>
    </div>
  );
}
