import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Target, 
  MessageSquare, 
  Phone, 
  Mail, 
  Smartphone,
  Sparkles,
  Clock,
  Shield,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Zap
} from "lucide-react";
import { CampaignAccountsList } from "./CampaignAccountsList";
import type { CampaignStrategy, CampaignSummary, AccountSummary } from "@/hooks/useCollectionCampaigns";

interface CampaignStrategyCardProps {
  strategy: CampaignStrategy;
  summary: CampaignSummary;
  accounts?: AccountSummary[];
  onGenerateDraft?: (accountId: string) => void;
  onInitiateOutreach?: (accountId: string, channel: string) => void;
  isGenerating?: boolean;
}

export function CampaignStrategyCard({ 
  strategy, 
  summary, 
  accounts = [],
  onGenerateDraft,
  onInitiateOutreach,
  isGenerating
}: CampaignStrategyCardProps) {
  const getToneBadge = (tone: string) => {
    const styles = {
      friendly: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      firm: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      urgent: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      legal: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return styles[tone as keyof typeof styles] || styles.firm;
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email": return <Mail className="h-4 w-4" />;
      case "phone": return <Phone className="h-4 w-4" />;
      case "sms": return <Smartphone className="h-4 w-4" />;
      case "multi-channel": return <MessageSquare className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-orange-600";
  };

  // Calculate payment prediction based on accounts
  const calculatePaymentPrediction = () => {
    if (accounts.length === 0) return null;
    
    const avgRisk = summary.avgRiskScore;
    const totalBalance = summary.totalBalance;
    
    // Estimate based on risk - inverse relationship
    const expectedRecoveryRate = Math.max(0.2, Math.min(0.85, (100 - avgRisk) / 100));
    const expectedAmount = totalBalance * expectedRecoveryRate;
    const expectedDays = avgRisk <= 30 ? 30 : avgRisk <= 55 ? 45 : avgRisk <= 75 ? 60 : 90;
    
    return {
      expectedAmount: Math.round(expectedAmount),
      expectedDays,
      probability: Math.round((100 - avgRisk) * 0.9),
    };
  };

  const paymentPrediction = calculatePaymentPrediction();

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AI Strategy Recommendation</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Confidence:</span>
            <span className={`font-bold ${getConfidenceColor(strategy.confidenceScore)}`}>
              {strategy.confidenceScore}%
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Campaign Name */}
        <div>
          <h3 className="text-xl font-semibold">{strategy.campaignName}</h3>
          <p className="text-muted-foreground mt-1">{strategy.executiveSummary}</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-background rounded-lg p-3 border">
            <p className="text-sm text-muted-foreground">Target Accounts</p>
            <p className="text-2xl font-bold">{summary.totalAccounts}</p>
          </div>
          <div className="bg-background rounded-lg p-3 border">
            <p className="text-sm text-muted-foreground">Total Balance</p>
            <p className="text-2xl font-bold">${summary.totalBalance.toLocaleString()}</p>
          </div>
          <div className="bg-background rounded-lg p-3 border">
            <p className="text-sm text-muted-foreground">Avg Risk Score</p>
            <p className="text-2xl font-bold">{summary.avgRiskScore.toFixed(0)}</p>
          </div>
          <div className="bg-background rounded-lg p-3 border">
            <p className="text-sm text-muted-foreground">Avg Days Past Due</p>
            <p className="text-2xl font-bold">{summary.avgDaysPastDue.toFixed(0)}</p>
          </div>
        </div>

        {/* Payment Prediction */}
        {paymentPrediction && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-green-800 dark:text-green-200">AI Payment Prediction</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-green-600 dark:text-green-400">Expected Recovery</p>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">
                  ${paymentPrediction.expectedAmount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-green-600 dark:text-green-400">Expected Timeline</p>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">
                  {paymentPrediction.expectedDays} days
                </p>
              </div>
              <div>
                <p className="text-xs text-green-600 dark:text-green-400">Success Probability</p>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">
                  {paymentPrediction.probability}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="font-medium">Recommended Tone</span>
            </div>
            <Badge className={`${getToneBadge(strategy.recommendedTone)} capitalize`}>
              {strategy.recommendedTone}
            </Badge>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {getChannelIcon(strategy.recommendedChannel)}
              <span className="font-medium">Recommended Channel</span>
            </div>
            <Badge variant="outline" className="capitalize">
              {strategy.recommendedChannel.replace("-", " ")}
            </Badge>
          </div>
        </div>

        {/* Multi-Channel Sequence (if applicable) */}
        {strategy.recommendedChannel === "multi-channel" && (
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="font-medium">Recommended Channel Sequence</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Mail className="h-3 w-3" /> Email
              </Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="outline" className="gap-1">
                <Phone className="h-3 w-3" /> Phone
              </Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="outline" className="gap-1">
                <Smartphone className="h-3 w-3" /> SMS
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Start with email, follow up with phone after 3 days if no response, then SMS for final reminder
            </p>
          </div>
        )}

        {/* Strategy Points */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="font-medium">Key Strategy Points</span>
          </div>
          <ul className="space-y-2">
            {strategy.strategyPoints.map((point, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="text-primary mt-1">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Timeline & Risk */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-medium">Expected Timeline</span>
            </div>
            <p className="text-sm text-muted-foreground">{strategy.expectedTimeline}</p>
          </div>
          {strategy.riskMitigation && strategy.riskMitigation.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="font-medium">Risk Mitigation</span>
              </div>
              <ul className="text-sm text-muted-foreground">
                {strategy.riskMitigation.map((risk, index) => (
                  <li key={index}>• {risk}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Risk Distribution */}
        <div className="space-y-3">
          <span className="font-medium">Risk Distribution</span>
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center p-2 rounded bg-green-100 dark:bg-green-900/30">
              <p className="text-xs text-green-700 dark:text-green-300">Low</p>
              <p className="font-bold text-green-800 dark:text-green-200">{summary.riskDistribution.low}</p>
            </div>
            <div className="text-center p-2 rounded bg-yellow-100 dark:bg-yellow-900/30">
              <p className="text-xs text-yellow-700 dark:text-yellow-300">Medium</p>
              <p className="font-bold text-yellow-800 dark:text-yellow-200">{summary.riskDistribution.medium}</p>
            </div>
            <div className="text-center p-2 rounded bg-orange-100 dark:bg-orange-900/30">
              <p className="text-xs text-orange-700 dark:text-orange-300">High</p>
              <p className="font-bold text-orange-800 dark:text-orange-200">{summary.riskDistribution.high}</p>
            </div>
            <div className="text-center p-2 rounded bg-red-100 dark:bg-red-900/30">
              <p className="text-xs text-red-700 dark:text-red-300">Critical</p>
              <p className="font-bold text-red-800 dark:text-red-200">{summary.riskDistribution.critical}</p>
            </div>
          </div>
        </div>

        {/* Expandable Accounts List */}
        {accounts.length > 0 && (
          <CampaignAccountsList
            accounts={accounts}
            recommendedTone={strategy.recommendedTone}
            recommendedChannel={strategy.recommendedChannel}
            onGenerateDraft={onGenerateDraft}
            onInitiateOutreach={onInitiateOutreach}
            isGenerating={isGenerating}
          />
        )}
      </CardContent>
    </Card>
  );
}
