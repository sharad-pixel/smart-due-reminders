import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DollarSign, TrendingDown, Target, AlertTriangle, FileText, Users } from "lucide-react";
import type { RevenueRiskAggregate } from "@/hooks/useRevenueRisk";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  aggregate: RevenueRiskAggregate;
}

export function RevenueRiskOverview({ aggregate }: Props) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* Total AR */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            Total AR
          </div>
          <div className="text-xl font-bold">{formatCurrency(aggregate.total_ar)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {aggregate.invoice_count} invoices · {aggregate.debtor_count} accounts
          </div>
        </CardContent>
      </Card>

      {/* Overdue AR */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1.5">
            <TrendingDown className="h-3.5 w-3.5" />
            Overdue AR
          </div>
          <div className="text-xl font-bold text-orange-600">{formatCurrency(aggregate.overdue_ar)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {aggregate.pct_overdue}% of total
          </div>
        </CardContent>
      </Card>

      {/* Avg Collectability */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1.5">
            <Target className="h-3.5 w-3.5" />
            Avg Collectability
          </div>
          <div className={`text-xl font-bold ${getScoreColor(aggregate.avg_collectability)}`}>
            {aggregate.avg_collectability}%
          </div>
          <Progress value={aggregate.avg_collectability} className="h-1.5 mt-1.5" />
        </CardContent>
      </Card>

      {/* Expected Credit Loss */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Expected Credit Loss
          </div>
          <div className="text-xl font-bold text-red-600">{formatCurrency(aggregate.total_ecl)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {aggregate.pct_at_risk}% of AR at risk
          </div>
        </CardContent>
      </Card>

      {/* Engagement-Adjusted ECL */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1.5">
            <Users className="h-3.5 w-3.5" />
            Engagement-Adj ECL
          </div>
          <div className="text-xl font-bold text-amber-600">{formatCurrency(aggregate.engagement_adjusted_ecl)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {aggregate.total_ecl > 0
              ? `${Math.round((1 - aggregate.engagement_adjusted_ecl / aggregate.total_ecl) * 100)}% adjusted`
              : "—"}
          </div>
        </CardContent>
      </Card>

      {/* At Risk Count */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1.5">
            <FileText className="h-3.5 w-3.5" />
            At Risk Invoices
          </div>
          <div className="text-xl font-bold">
            {aggregate.collectability_distribution.at_risk + aggregate.collectability_distribution.high_risk}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            of {aggregate.invoice_count} total
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
