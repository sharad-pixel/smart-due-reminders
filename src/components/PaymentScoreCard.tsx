import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { usePaymentScore } from "@/hooks/usePaymentScore";
import { format } from "date-fns";

interface PaymentScoreCardProps {
  debtorId: string;
  paymentScore: number | null;
  paymentRiskTier: string | null;
  avgDaysToPay: number | null;
  maxDaysPastDue: number | null;
  agingMixCurrentPct: number | null;
  agingMix1_30Pct: number | null;
  agingMix31_60Pct: number | null;
  agingMix61_90Pct: number | null;
  agingMix91_120Pct: number | null;
  agingMix121PlusPct: number | null;
  disputedInvoicesCount: number | null;
  inPaymentPlanInvoicesCount: number | null;
  writtenOffInvoicesCount: number | null;
  paymentScoreLastCalculated: string | null;
}

export const PaymentScoreCard = ({
  debtorId,
  paymentScore,
  paymentRiskTier,
  avgDaysToPay,
  maxDaysPastDue,
  agingMixCurrentPct,
  agingMix1_30Pct,
  agingMix31_60Pct,
  agingMix61_90Pct,
  agingMix91_120Pct,
  agingMix121PlusPct,
  disputedInvoicesCount,
  inPaymentPlanInvoicesCount,
  writtenOffInvoicesCount,
  paymentScoreLastCalculated,
}: PaymentScoreCardProps) => {
  const { calculateScore } = usePaymentScore(debtorId);
  
  const score = paymentScore || 50;
  const tier = paymentRiskTier || "medium";

  // RISK SCORE: Higher = Riskier (inverted color logic)
  const getScoreColor = () => {
    if (score <= 30) return "text-green-600"; // Low risk
    if (score <= 55) return "text-yellow-600"; // Medium risk
    if (score <= 75) return "text-orange-600"; // High risk
    return "text-red-600"; // Critical risk
  };

  const getScoreBg = () => {
    if (score <= 30) return "bg-green-100";
    if (score <= 55) return "bg-yellow-100";
    if (score <= 75) return "bg-orange-100";
    return "bg-red-100";
  };

  const getRiskBadge = () => {
    const tierLower = tier.toLowerCase();
    if (tierLower === "low") return <Badge className="bg-green-500">Low Risk</Badge>;
    if (tierLower === "medium") return <Badge className="bg-yellow-500">Medium Risk</Badge>;
    if (tierLower === "high") return <Badge className="bg-orange-500">High Risk</Badge>;
    if (tierLower === "critical") return <Badge className="bg-red-500">Critical Risk</Badge>;
    return <Badge variant="secondary">Still Learning</Badge>;
  };

  const getRiskIcon = () => {
    const tierLower = tier.toLowerCase();
    if (tierLower === "low") return <TrendingUp className="h-5 w-5 text-green-600" />;
    if (tierLower === "medium") return <Minus className="h-5 w-5 text-yellow-600" />;
    if (tierLower === "high") return <TrendingDown className="h-5 w-5 text-orange-600" />;
    if (tierLower === "critical") return <AlertCircle className="h-5 w-5 text-red-600" />;
    return <Minus className="h-5 w-5 text-muted-foreground" />;
  };

  const getBreakdown = () => {
    const breakdown: Array<{ text: string; impact: "positive" | "negative" | "neutral" }> = [];

    if (avgDaysToPay !== null) {
      if (avgDaysToPay <= 5) {
        breakdown.push({ text: `Average days to pay: ${avgDaysToPay.toFixed(1)} (excellent)`, impact: "positive" });
      } else if (avgDaysToPay <= 15) {
        breakdown.push({ text: `Average days to pay: ${avgDaysToPay.toFixed(1)} (good)`, impact: "neutral" });
      } else if (avgDaysToPay <= 30) {
        breakdown.push({ text: `Average days to pay: ${avgDaysToPay.toFixed(1)} (fair)`, impact: "negative" });
      } else {
        breakdown.push({ text: `Average days to pay: ${avgDaysToPay.toFixed(1)} (poor)`, impact: "negative" });
      }
    }

    if (agingMixCurrentPct && agingMixCurrentPct > 70) {
      breakdown.push({ text: `${agingMixCurrentPct.toFixed(0)}% of balance is current`, impact: "positive" });
    }

    const late31Plus = (agingMix31_60Pct || 0) + (agingMix61_90Pct || 0);
    if (late31Plus > 30) {
      breakdown.push({ text: `${late31Plus.toFixed(0)}% of balance is 31+ days past due`, impact: "negative" });
    }

    const late61Plus = (agingMix61_90Pct || 0) + (agingMix91_120Pct || 0) + (agingMix121PlusPct || 0);
    if (late61Plus > 50) {
      breakdown.push({ text: `Over 50% of balance is 61+ days past due`, impact: "negative" });
    }

    if ((disputedInvoicesCount || 0) >= 2) {
      breakdown.push({ text: `${disputedInvoicesCount} disputed invoices`, impact: "negative" });
    } else if ((disputedInvoicesCount || 0) === 1) {
      breakdown.push({ text: "1 disputed invoice (monitored)", impact: "neutral" });
    }

    if ((inPaymentPlanInvoicesCount || 0) > 0) {
      breakdown.push({ text: `${inPaymentPlanInvoicesCount} invoice(s) in payment plan`, impact: "positive" });
    }

    if ((writtenOffInvoicesCount || 0) > 0) {
      breakdown.push({ text: `${writtenOffInvoicesCount} written-off invoice(s)`, impact: "negative" });
    }

    if (maxDaysPastDue && maxDaysPastDue > 90) {
      breakdown.push({ text: `Oldest invoice is ${maxDaysPastDue} days past due`, impact: "negative" });
    }

    return breakdown;
  };

  const breakdown = getBreakdown();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Payment Score
              {getRiskIcon()}
            </CardTitle>
            <CardDescription>
              Based on payment history, aging, and status
              {paymentScoreLastCalculated && (
                <span className="block text-xs mt-1">
                  Last calculated: {format(new Date(paymentScoreLastCalculated), "MMM d, yyyy h:mm a")}
                </span>
              )}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => calculateScore.mutate({ debtor_id: debtorId })}
            disabled={calculateScore.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${calculateScore.isPending ? "animate-spin" : ""}`} />
            Recalculate
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score Display */}
        <div className="flex items-center justify-between">
          <div className={`text-6xl font-bold ${getScoreColor()}`}>
            {score}
          </div>
          <div className="text-right">
            {getRiskBadge()}
            <p className="text-sm text-muted-foreground mt-2">Out of 100</p>
          </div>
        </div>

        {/* Risk Score Progress Bar */}
        <div>
          <Progress value={score} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Low Risk (0)</span>
            <span>Medium (55)</span>
            <span>Critical (100)</span>
          </div>
        </div>

        {/* Aging Mix Breakdown */}
        {(agingMixCurrentPct || agingMix1_30Pct || agingMix31_60Pct) && (
          <div>
            <h4 className="font-semibold mb-2 text-sm">Aging Mix</h4>
            <div className="space-y-2">
              {agingMixCurrentPct > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current</span>
                  <span className="font-medium text-green-600">{agingMixCurrentPct.toFixed(0)}%</span>
                </div>
              )}
              {agingMix1_30Pct > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">1-30 days past due</span>
                  <span className="font-medium">{agingMix1_30Pct.toFixed(0)}%</span>
                </div>
              )}
              {agingMix31_60Pct > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">31-60 days past due</span>
                  <span className="font-medium text-yellow-600">{agingMix31_60Pct.toFixed(0)}%</span>
                </div>
              )}
              {agingMix61_90Pct > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">61-90 days past due</span>
                  <span className="font-medium text-orange-600">{agingMix61_90Pct.toFixed(0)}%</span>
                </div>
              )}
              {(agingMix91_120Pct || 0) + (agingMix121PlusPct || 0) > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">91+ days past due</span>
                  <span className="font-medium text-red-600">
                    {((agingMix91_120Pct || 0) + (agingMix121PlusPct || 0)).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Score Breakdown */}
        <div>
          <h4 className="font-semibold mb-2 text-sm">Score Breakdown</h4>
          <div className="space-y-2">
            {breakdown.length > 0 ? (
              breakdown.map((item, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  {item.impact === "positive" && <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />}
                  {item.impact === "negative" && <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />}
                  {item.impact === "neutral" && <Minus className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />}
                  <span className="text-muted-foreground">{item.text}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No detailed breakdown available</p>
            )}
          </div>
        </div>

        {/* Risk Explanation */}
        <div className={`p-4 rounded-lg ${getScoreBg()}`}>
          <p className="text-sm font-medium">
            {tier.toLowerCase() === "low" && "This account consistently pays on time with minimal risk."}
            {tier.toLowerCase() === "medium" && "This account occasionally pays late but is generally reliable."}
            {tier.toLowerCase() === "high" && "This account has a history of late payments and requires close monitoring."}
            {tier.toLowerCase() === "critical" && "This account requires immediate attention - severe payment issues detected."}
            {!["low", "medium", "high", "critical"].includes(tier.toLowerCase()) && "Still learning this account's payment behavior."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
