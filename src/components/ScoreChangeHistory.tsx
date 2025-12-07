import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, Minus, History, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ScoreChangeHistoryProps {
  debtorId: string;
  limit?: number;
}

interface ScoreChange {
  id: string;
  change_type: string;
  old_health_score: number | null;
  new_health_score: number | null;
  old_risk_score: number | null;
  new_risk_score: number | null;
  old_health_tier: string | null;
  new_health_tier: string | null;
  change_reason: string;
  created_at: string;
}

export const ScoreChangeHistory = ({ debtorId, limit = 10 }: ScoreChangeHistoryProps) => {
  const { data: changes, isLoading } = useQuery({
    queryKey: ["score-change-history", debtorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("score_change_logs")
        .select("*")
        .eq("debtor_id", debtorId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as ScoreChange[];
    },
    enabled: !!debtorId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!changes || changes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Score History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No score changes recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5" />
          Score History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-3">
            {changes.map((change) => (
              <ScoreChangeItem key={change.id} change={change} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

interface ScoreChangeItemProps {
  change: ScoreChange;
}

const ScoreChangeItem = ({ change }: ScoreChangeItemProps) => {
  const healthDiff = (change.new_health_score ?? 0) - (change.old_health_score ?? 0);
  const riskDiff = (change.new_risk_score ?? 0) - (change.old_risk_score ?? 0);

  const getHealthTrendIcon = () => {
    if (healthDiff > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (healthDiff < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getRiskTrendIcon = () => {
    // For risk, decreasing is good
    if (riskDiff < 0) return <TrendingDown className="h-4 w-4 text-green-500" />;
    if (riskDiff > 0) return <TrendingUp className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const tierChanged = change.old_health_tier !== change.new_health_tier;

  return (
    <div className="p-3 bg-muted/50 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {format(new Date(change.created_at), "MMM d, yyyy h:mm a")}
        </span>
        {tierChanged && (
          <Badge variant="outline" className="text-xs">
            {change.old_health_tier} → {change.new_health_tier}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Health Score Change */}
        <div className="flex items-center gap-2">
          {getHealthTrendIcon()}
          <div className="text-sm">
            <span className="text-muted-foreground">Health: </span>
            <span className={cn(
              "font-medium",
              healthDiff > 0 ? "text-green-500" : healthDiff < 0 ? "text-red-500" : ""
            )}>
              {change.old_health_score ?? '—'} → {change.new_health_score ?? '—'}
              {healthDiff !== 0 && (
                <span className="ml-1">
                  ({healthDiff > 0 ? '+' : ''}{healthDiff})
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Risk Score Change */}
        <div className="flex items-center gap-2">
          {getRiskTrendIcon()}
          <div className="text-sm">
            <span className="text-muted-foreground">Risk: </span>
            <span className={cn(
              "font-medium",
              riskDiff < 0 ? "text-green-500" : riskDiff > 0 ? "text-red-500" : ""
            )}>
              {change.old_risk_score ?? '—'} → {change.new_risk_score ?? '—'}
              {riskDiff !== 0 && (
                <span className="ml-1">
                  ({riskDiff > 0 ? '+' : ''}{riskDiff})
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Change Reason */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="h-3 w-3 mt-0.5 shrink-0" />
        <span>{change.change_reason}</span>
      </div>
    </div>
  );
};

export default ScoreChangeHistory;