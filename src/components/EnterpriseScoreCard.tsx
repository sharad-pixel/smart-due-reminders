import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  HeartPulse, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  Clock,
  DollarSign,
  MessageSquare,
  BarChart3,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ScoreComponents {
  payment_history_score: number;
  dpd_score: number;
  outstanding_balance_score: number;
  ai_sentiment_health_score: number;
  dpd_risk: number;
  negative_payment_trend: number;
  ai_sentiment_risk: number;
  balance_concentration_risk: number;
  data_sufficient: boolean;
  on_time_payment_pct: number;
  avg_days_late: number;
  broken_promises_count: number;
  max_dpd: number;
  total_outstanding: number;
  high_aging_concentration_pct: number;
  engagement_rate: number;
  penalties: { reason: string; amount: number; category: string }[];
}

interface EnterpriseScoreCardProps {
  collectionsHealthScore: number | null;
  collectionsRiskScore: number | null;
  healthTier: string | null;
  riskTierDetailed: string | null;
  aiSentimentCategory: string | null;
  scoreComponents: ScoreComponents | null;
  lastScoreChangeReason: string | null;
  compact?: boolean;
}

// Color configurations based on tiers
const getHealthColor = (tier: string | null): string => {
  switch (tier) {
    case 'Healthy': return 'text-green-500';
    case 'Watch': return 'text-yellow-500';
    case 'At Risk': return 'text-orange-500';
    case 'Critical': return 'text-red-500';
    default: return 'text-muted-foreground';
  }
};

const getHealthBgColor = (tier: string | null): string => {
  switch (tier) {
    case 'Healthy': return 'bg-green-500/10 border-green-500/30';
    case 'Watch': return 'bg-yellow-500/10 border-yellow-500/30';
    case 'At Risk': return 'bg-orange-500/10 border-orange-500/30';
    case 'Critical': return 'bg-red-500/10 border-red-500/30';
    default: return 'bg-muted/50 border-border';
  }
};

const getRiskColor = (tier: string | null): string => {
  switch (tier) {
    case 'Low Risk': return 'text-green-500';
    case 'Medium Risk': return 'text-yellow-500';
    case 'High Risk': return 'text-orange-500';
    case 'Critical Risk': return 'text-red-500';
    default: return 'text-muted-foreground';
  }
};

const getRiskBgColor = (tier: string | null): string => {
  switch (tier) {
    case 'Low Risk': return 'bg-green-500/10 border-green-500/30';
    case 'Medium Risk': return 'bg-yellow-500/10 border-yellow-500/30';
    case 'High Risk': return 'bg-orange-500/10 border-orange-500/30';
    case 'Critical Risk': return 'bg-red-500/10 border-red-500/30';
    default: return 'bg-muted/50 border-border';
  }
};

const getProgressColor = (score: number, isRisk: boolean = false): string => {
  if (isRisk) {
    // For risk, lower is better
    if (score <= 25) return 'bg-green-500';
    if (score <= 50) return 'bg-yellow-500';
    if (score <= 75) return 'bg-orange-500';
    return 'bg-red-500';
  } else {
    // For health, higher is better
    if (score >= 75) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    if (score >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  }
};

const getSentimentLabel = (category: string | null): { label: string; color: string } => {
  switch (category) {
    case 'payment_confirmed': return { label: 'Payment Confirmed', color: 'text-green-500' };
    case 'cooperative': return { label: 'Cooperative', color: 'text-green-400' };
    case 'neutral': return { label: 'Neutral', color: 'text-muted-foreground' };
    case 'delaying': return { label: 'Delaying', color: 'text-yellow-500' };
    case 'hardship': return { label: 'Financial Hardship', color: 'text-orange-500' };
    case 'hostile': return { label: 'Hostile', color: 'text-red-500' };
    case 'no_response': return { label: 'No Response', color: 'text-muted-foreground' };
    default: return { label: 'Unknown', color: 'text-muted-foreground' };
  }
};

export const EnterpriseScoreCard = ({
  collectionsHealthScore,
  collectionsRiskScore,
  healthTier,
  riskTierDetailed,
  aiSentimentCategory,
  scoreComponents,
  lastScoreChangeReason,
  compact = false
}: EnterpriseScoreCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const isStillLearning = healthTier === 'Still Learning' || !scoreComponents?.data_sufficient;

  if (isStillLearning) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Clock className="h-5 w-5" />
            <div>
              <p className="font-medium">Still Learning</p>
              <p className="text-sm">Insufficient history for scoring. More data needed.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border", getHealthBgColor(healthTier))}>
                <HeartPulse className={cn("h-4 w-4", getHealthColor(healthTier))} />
                <span className={cn("font-semibold", getHealthColor(healthTier))}>
                  {collectionsHealthScore}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Collections Health: {healthTier}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border", getRiskBgColor(riskTierDetailed))}>
                <AlertTriangle className={cn("h-4 w-4", getRiskColor(riskTierDetailed))} />
                <span className={cn("font-semibold", getRiskColor(riskTierDetailed))}>
                  {collectionsRiskScore}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Collections Risk: {riskTierDetailed}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  const sentimentInfo = getSentimentLabel(aiSentimentCategory);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Enterprise Scoring
          </CardTitle>
          {lastScoreChangeReason && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs">
                    <Info className="h-3 w-3 mr-1" />
                    Recent Change
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">{lastScoreChangeReason}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Score Display */}
        <div className="grid grid-cols-2 gap-4">
          {/* Health Score */}
          <div className={cn("p-4 rounded-lg border", getHealthBgColor(healthTier))}>
            <div className="flex items-center gap-2 mb-2">
              <HeartPulse className={cn("h-5 w-5", getHealthColor(healthTier))} />
              <span className="text-sm font-medium">Health Score</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-3xl font-bold", getHealthColor(healthTier))}>
                {collectionsHealthScore}
              </span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            <Badge variant="outline" className={cn("mt-2", getHealthColor(healthTier))}>
              {healthTier}
            </Badge>
          </div>

          {/* Risk Score */}
          <div className={cn("p-4 rounded-lg border", getRiskBgColor(riskTierDetailed))}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={cn("h-5 w-5", getRiskColor(riskTierDetailed))} />
              <span className="text-sm font-medium">Risk Score</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-3xl font-bold", getRiskColor(riskTierDetailed))}>
                {collectionsRiskScore}
              </span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            <Badge variant="outline" className={cn("mt-2", getRiskColor(riskTierDetailed))}>
              {riskTierDetailed}
            </Badge>
          </div>
        </div>

        {/* AI Sentiment */}
        {aiSentimentCategory && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">AI Sentiment</span>
            </div>
            <span className={cn("font-medium", sentimentInfo.color)}>
              {sentimentInfo.label}
            </span>
          </div>
        )}

        {/* Expandable Details */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span>Score Breakdown</span>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            {scoreComponents && (
              <>
                {/* Health Components */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <HeartPulse className="h-4 w-4 text-green-500" />
                    Health Components
                  </h4>
                  <ScoreComponentRow 
                    label="Payment History (35%)" 
                    score={scoreComponents.payment_history_score}
                    detail={`${scoreComponents.on_time_payment_pct}% on-time`}
                  />
                  <ScoreComponentRow 
                    label="Days Past Due (30%)" 
                    score={scoreComponents.dpd_score}
                    detail={`Max ${scoreComponents.max_dpd} DPD`}
                  />
                  <ScoreComponentRow 
                    label="Balance Health (20%)" 
                    score={scoreComponents.outstanding_balance_score}
                    detail={`${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(scoreComponents.total_outstanding)} outstanding`}
                  />
                  <ScoreComponentRow 
                    label="AI Sentiment (15%)" 
                    score={scoreComponents.ai_sentiment_health_score}
                    detail={aiSentimentCategory || 'No data'}
                  />
                </div>

                {/* Risk Components */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Risk Components
                  </h4>
                  <ScoreComponentRow 
                    label="DPD Risk (40%)" 
                    score={scoreComponents.dpd_risk}
                    isRisk
                  />
                  <ScoreComponentRow 
                    label="Payment Trend (25%)" 
                    score={scoreComponents.negative_payment_trend}
                    detail={scoreComponents.negative_payment_trend > 20 ? 'Worsening' : 'Stable'}
                    isRisk
                  />
                  <ScoreComponentRow 
                    label="Sentiment Risk (20%)" 
                    score={scoreComponents.ai_sentiment_risk}
                    isRisk
                  />
                  <ScoreComponentRow 
                    label="Concentration Risk (15%)" 
                    score={scoreComponents.balance_concentration_risk}
                    detail={`${scoreComponents.high_aging_concentration_pct}% in 60+ days`}
                    isRisk
                  />
                </div>

                {/* Key Issues */}
                {scoreComponents.penalties.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Key Issues</h4>
                    <div className="space-y-1">
                      {scoreComponents.penalties.slice(0, 5).map((penalty, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{penalty.reason}</span>
                          <Badge variant="outline" className="text-red-500 text-xs">
                            -{penalty.amount}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};

interface ScoreComponentRowProps {
  label: string;
  score: number;
  detail?: string;
  isRisk?: boolean;
}

const ScoreComponentRow = ({ label, score, detail, isRisk = false }: ScoreComponentRowProps) => {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
          <span className="font-medium">{score}</span>
        </div>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all", getProgressColor(score, isRisk))}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
};

export default EnterpriseScoreCard;