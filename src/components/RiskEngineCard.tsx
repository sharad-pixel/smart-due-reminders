import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, TrendingUp, TrendingDown, Minus, AlertTriangle, Shield, ShieldAlert, ShieldCheck, HelpCircle } from "lucide-react";
import { usePaymentScore } from "@/hooks/usePaymentScore";
import { format } from "date-fns";

interface RiskEngineCardProps {
  debtorId: string;
  paymentScore: number | null;
  riskTier: string | null;
  riskStatusNote: string | null;
  riskLastCalculatedAt: string | null;
  avgDaysToPay?: number | null;
  maxDaysPastDue?: number | null;
  openInvoicesCount?: number | null;
  disputedInvoicesCount?: number | null;
}

export const RiskEngineCard = ({
  debtorId,
  paymentScore,
  riskTier,
  riskStatusNote,
  riskLastCalculatedAt,
  avgDaysToPay,
  maxDaysPastDue,
  openInvoicesCount,
  disputedInvoicesCount,
}: RiskEngineCardProps) => {
  const { calculateScore } = usePaymentScore(debtorId);

  const isStillLearning = riskTier === "Still learning" || !riskTier;

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 85) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    if (score >= 50) return "text-orange-500";
    return "text-red-600";
  };

  const getScoreBg = (score: number | null) => {
    if (score === null) return "bg-muted";
    if (score >= 85) return "bg-green-500";
    if (score >= 70) return "bg-yellow-500";
    if (score >= 50) return "bg-orange-500";
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
    if (!tier || tier === "Still learning") return <HelpCircle className="h-5 w-5 text-muted-foreground" />;
    if (tier === "Low") return <ShieldCheck className="h-5 w-5 text-green-600" />;
    if (tier === "Medium") return <Shield className="h-5 w-5 text-yellow-600" />;
    if (tier === "High") return <ShieldAlert className="h-5 w-5 text-orange-500" />;
    return <AlertTriangle className="h-5 w-5 text-red-600" />;
  };

  const handleRecalculate = () => {
    calculateScore.mutate({ debtor_id: debtorId });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {getRiskIcon(riskTier)}
            Risk Assessment
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRecalculate}
                  disabled={calculateScore.isPending}
                >
                  <RefreshCw className={`h-4 w-4 ${calculateScore.isPending ? "animate-spin" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Recalculate Risk Score</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Risk Tier Badge */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Risk Tier</span>
          {getRiskBadge(riskTier)}
        </div>

        {/* Payment Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Payment Score</span>
            <span className={`text-2xl font-bold ${getScoreColor(paymentScore)}`}>
              {paymentScore !== null ? paymentScore : "—"}
              <span className="text-sm font-normal text-muted-foreground">/100</span>
            </span>
          </div>
          <Progress 
            value={paymentScore ?? 0} 
            className={`h-2 ${isStillLearning ? "[&>div]:bg-muted" : ""}`}
          />
        </div>

        {/* Status Note */}
        {riskStatusNote && (
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">{riskStatusNote}</p>
          </div>
        )}

        {/* Key Metrics */}
        {!isStillLearning && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Avg Days to Pay</p>
              <p className="text-sm font-medium flex items-center gap-1">
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
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Max Days Past Due</p>
              <p className="text-sm font-medium">
                {maxDaysPastDue !== null ? `${maxDaysPastDue} days` : "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Open Invoices</p>
              <p className="text-sm font-medium">{openInvoicesCount ?? 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Disputed</p>
              <p className="text-sm font-medium">{disputedInvoicesCount ?? 0}</p>
            </div>
          </div>
        )}

        {/* Last Calculated */}
        {riskLastCalculatedAt && (
          <p className="text-xs text-muted-foreground pt-2 border-t">
            Last updated: {format(new Date(riskLastCalculatedAt), "MMM d, yyyy 'at' h:mm a")}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default RiskEngineCard;
