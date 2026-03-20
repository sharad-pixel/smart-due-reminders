import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Lightbulb, Target, AlertTriangle } from "lucide-react";
import type { AIInsights } from "@/hooks/useRevenueRisk";

interface Props {
  insights: AIInsights;
}

export function RevenueRiskAIInsights({ insights }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          AI Intelligence Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Risk Summary */}
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm font-medium mb-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            Risk Summary
          </div>
          <p className="text-sm text-muted-foreground">{insights.risk_summary}</p>
        </div>

        {/* Engagement Insight */}
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm font-medium mb-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
            Engagement Insight
          </div>
          <p className="text-sm text-muted-foreground">{insights.engagement_insight}</p>
        </div>

        {/* Key Drivers & Recommendations side by side */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <Target className="h-3.5 w-3.5 text-red-500" />
              Key Risk Drivers
            </div>
            <ul className="space-y-1">
              {insights.key_drivers.map((driver, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-red-400 mt-1">·</span>
                  {driver}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <Lightbulb className="h-3.5 w-3.5 text-green-500" />
              Recommendations
            </div>
            <ul className="space-y-1">
              {insights.recommendations.map((rec, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-green-400 mt-1">·</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
