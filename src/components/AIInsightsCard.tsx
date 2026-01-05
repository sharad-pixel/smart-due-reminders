import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Lightbulb, 
  Target, 
  AlertTriangle, 
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  ArrowRight,
  DollarSign
} from "lucide-react";
import { useAIAnalytics, TrendAnalysis, Recommendation, Prediction, RiskAlert } from "@/hooks/useAIAnalytics";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface AIInsightsCardProps {
  scope?: "dashboard" | "accounts" | "invoices" | "tasks" | "account-detail";
  context?: Record<string, any>;
  compact?: boolean;
  showTabs?: boolean;
  className?: string;
}

export function AIInsightsCard({ 
  scope = "dashboard", 
  context, 
  compact = false,
  showTabs = true,
  className 
}: AIInsightsCardProps) {
  const { data, isLoading, isError, error, refetch, isRefetching } = useAIAnalytics({ scope, context });
  const [expanded, setExpanded] = useState(!compact);

  if (isError) {
    const message = error instanceof Error ? error.message : "Failed to load AI insights.";
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">AI Insights</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isRefetching}>
              <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
            </Button>
          </div>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary animate-pulse" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const getTrendIcon = (direction: TrendAnalysis["direction"]) => {
    switch (direction) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getPriorityColor = (priority: Recommendation["priority"]) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100";
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100";
    }
  };

  const getConfidenceColor = (confidence: Prediction["confidence"]) => {
    switch (confidence) {
      case "high":
        return "text-green-600";
      case "medium":
        return "text-yellow-600";
      default:
        return "text-muted-foreground";
    }
  };

  const getSeverityStyle = (severity: RiskAlert["severity"]) => {
    switch (severity) {
      case "critical":
        return "border-red-500 bg-red-50 dark:bg-red-950";
      case "warning":
        return "border-yellow-500 bg-yellow-50 dark:bg-yellow-950";
      default:
        return "border-blue-500 bg-blue-50 dark:bg-blue-950";
    }
  };

  const renderCompact = () => (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card className={className}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">AI Insights</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {data.riskAlerts.filter(a => a.severity === "critical").length > 0 && (
                  <Badge variant="destructive" className="animate-pulse">
                    {data.riskAlerts.filter(a => a.severity === "critical").length} Critical
                  </Badge>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); refetch(); }}
                  disabled={isRefetching}
                >
                  <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
                </Button>
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
            <CardDescription className="line-clamp-2">
              {data.summary}
              <span className="block text-xs text-muted-foreground/70 mt-1 italic">
                More interactions = more accurate insights
              </span>
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {renderContent()}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );

  const renderContent = () => (
    <>
      {showTabs ? (
        <Tabs defaultValue="recommendations" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="recommendations" className="text-xs sm:text-sm">
              <Lightbulb className="h-3 w-3 mr-1 hidden sm:inline" />
              Actions
            </TabsTrigger>
            <TabsTrigger value="trends" className="text-xs sm:text-sm">
              <TrendingUp className="h-3 w-3 mr-1 hidden sm:inline" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="predictions" className="text-xs sm:text-sm">
              <Target className="h-3 w-3 mr-1 hidden sm:inline" />
              Forecast
            </TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs sm:text-sm">
              <AlertTriangle className="h-3 w-3 mr-1 hidden sm:inline" />
              Alerts
              {data.riskAlerts.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center text-xs">
                  {data.riskAlerts.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recommendations" className="mt-4 space-y-3">
            {data.recommendations.length > 0 ? (
              data.recommendations.slice(0, 5).map((rec, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <Badge className={cn("shrink-0 mt-0.5", getPriorityColor(rec.priority))}>
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

          <TabsContent value="trends" className="mt-4 space-y-3">
            {data.trends.length > 0 ? (
              data.trends.map((trend, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="shrink-0">
                    {getTrendIcon(trend.direction)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
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

          <TabsContent value="predictions" className="mt-4 space-y-3">
            {data.predictions.length > 0 ? (
              data.predictions.map((pred, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">{pred.metric}</p>
                    <Badge variant="outline" className={cn("text-xs", getConfidenceColor(pred.confidence))}>
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

          <TabsContent value="alerts" className="mt-4 space-y-3">
            {data.riskAlerts.length > 0 ? (
              data.riskAlerts.map((alert, idx) => (
                <div key={idx} className={cn("p-3 rounded-lg border-l-4", getSeverityStyle(alert.severity))}>
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
                                Account: {alert.accountName}
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
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-green-600 font-medium">All clear!</p>
                <p className="text-xs text-muted-foreground">No risk alerts at this time</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-4">
          {data.riskAlerts.filter(a => a.severity === "critical").length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Critical Alerts
              </h4>
              {data.riskAlerts.filter(a => a.severity === "critical").map((alert, idx) => (
                <div key={idx} className={cn("p-2 rounded-lg border-l-4", getSeverityStyle(alert.severity))}>
                  <p className="text-sm">{alert.message}</p>
                </div>
              ))}
            </div>
          )}
          {data.recommendations.slice(0, 3).map((rec, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2 rounded bg-muted/50">
              <Badge className={cn("shrink-0 text-xs", getPriorityColor(rec.priority))}>
                {rec.priority}
              </Badge>
              <p className="text-sm">{rec.action}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (compact) {
    return renderCompact();
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AI Insights</CardTitle>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
          </Button>
        </div>
        <CardDescription>
          {data.summary}
          <span className="block text-xs text-muted-foreground/70 mt-1 italic">
            More interactions = more accurate insights
          </span>
          <span className="block text-xs text-muted-foreground/60 mt-0.5">
            AI synthesizes signals across all collection activities in one centralized view
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>
    </Card>
  );
}
