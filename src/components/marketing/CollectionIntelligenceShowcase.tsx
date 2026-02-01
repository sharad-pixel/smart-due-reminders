import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, 
  TrendingUp, 
  TrendingDown,
  Clock,
  DollarSign,
  Mail,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  Activity,
  BarChart3,
  Users,
  FileText,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ScoreCard {
  companyName: string;
  intelligenceScore: number;
  healthTier: "Healthy" | "Watch" | "At Risk" | "Critical";
  metrics: {
    invoiceActivity: { open: number; overdue: number; paid30Days: number };
    pastDueBalance: number;
    avgDaysToPay: number;
    totalTouchpoints: number;
    inboundEmails: number;
    sentiment: "Positive" | "Neutral" | "Delaying" | "Hostile";
    paymentTrend: "improving" | "stable" | "declining";
    responseRate: number;
  };
}

const sampleAccounts: ScoreCard[] = [
  {
    companyName: "TechVentures Inc.",
    intelligenceScore: 87,
    healthTier: "Healthy",
    metrics: {
      invoiceActivity: { open: 2, overdue: 0, paid30Days: 5 },
      pastDueBalance: 0,
      avgDaysToPay: 18,
      totalTouchpoints: 12,
      inboundEmails: 4,
      sentiment: "Positive",
      paymentTrend: "improving",
      responseRate: 92,
    },
  },
  {
    companyName: "Global Retail Co.",
    intelligenceScore: 62,
    healthTier: "Watch",
    metrics: {
      invoiceActivity: { open: 5, overdue: 2, paid30Days: 3 },
      pastDueBalance: 15400,
      avgDaysToPay: 38,
      totalTouchpoints: 8,
      inboundEmails: 2,
      sentiment: "Neutral",
      paymentTrend: "stable",
      responseRate: 65,
    },
  },
  {
    companyName: "Sterling Industries",
    intelligenceScore: 34,
    healthTier: "Critical",
    metrics: {
      invoiceActivity: { open: 8, overdue: 6, paid30Days: 1 },
      pastDueBalance: 89500,
      avgDaysToPay: 72,
      totalTouchpoints: 24,
      inboundEmails: 1,
      sentiment: "Delaying",
      paymentTrend: "declining",
      responseRate: 28,
    },
  },
];

const getHealthColor = (tier: ScoreCard["healthTier"]) => {
  switch (tier) {
    case "Healthy": return "text-green-500";
    case "Watch": return "text-yellow-500";
    case "At Risk": return "text-orange-500";
    case "Critical": return "text-red-500";
  }
};

const getHealthBg = (tier: ScoreCard["healthTier"]) => {
  switch (tier) {
    case "Healthy": return "bg-green-500/10 border-green-500/30";
    case "Watch": return "bg-yellow-500/10 border-yellow-500/30";
    case "At Risk": return "bg-orange-500/10 border-orange-500/30";
    case "Critical": return "bg-red-500/10 border-red-500/30";
  }
};

const getScoreColor = (score: number) => {
  if (score >= 75) return "bg-green-500";
  if (score >= 50) return "bg-yellow-500";
  if (score >= 25) return "bg-orange-500";
  return "bg-red-500";
};

const getSentimentColor = (sentiment: ScoreCard["metrics"]["sentiment"]) => {
  switch (sentiment) {
    case "Positive": return "text-green-500";
    case "Neutral": return "text-muted-foreground";
    case "Delaying": return "text-yellow-500";
    case "Hostile": return "text-red-500";
  }
};

const getTrendIcon = (trend: ScoreCard["metrics"]["paymentTrend"]) => {
  switch (trend) {
    case "improving": return <TrendingUp className="h-3 w-3 text-green-500" />;
    case "stable": return <Activity className="h-3 w-3 text-yellow-500" />;
    case "declining": return <TrendingDown className="h-3 w-3 text-red-500" />;
  }
};

const scoringFactors = [
  { icon: FileText, label: "Invoice Activity", description: "Open, overdue, and payment velocity" },
  { icon: DollarSign, label: "Past Due Balance", description: "Outstanding amount and aging distribution" },
  { icon: Clock, label: "Payment Practices", description: "Average days to pay and trends" },
  { icon: Mail, label: "Inbound Emails", description: "Response frequency and engagement" },
  { icon: MessageSquare, label: "Sentiment Analysis", description: "AI-analyzed tone of communications" },
  { icon: Zap, label: "Touchpoint History", description: "Collection activity effectiveness" },
];

const CollectionIntelligenceShowcase = () => {
  return (
    <section className="py-24 px-4 bg-gradient-to-b from-background via-primary/5 to-background">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Brain className="h-4 w-4" />
            Powered by AR Intelligence
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Accounts Receivable Intelligence Scorecards
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Every AR account gets an AI-powered intelligence score based on real collection data points, 
            enabling smarter prioritization and automated workflows.
          </p>
        </div>

        {/* Scoring Factors */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-16">
          {scoringFactors.map((factor, idx) => (
            <div 
              key={idx}
              className="p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-colors text-center group"
            >
              <div className="mx-auto w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <factor.icon className="h-5 w-5 text-primary" />
              </div>
              <h4 className="font-medium text-sm mb-1">{factor.label}</h4>
              <p className="text-xs text-muted-foreground">{factor.description}</p>
            </div>
          ))}
        </div>

        {/* Account Scorecards */}
        <div className="grid md:grid-cols-3 gap-6">
          {sampleAccounts.map((account, idx) => (
            <Card 
              key={idx} 
              className={cn(
                "overflow-hidden border-2 transition-all hover:shadow-lg",
                getHealthBg(account.healthTier)
              )}
            >
              <CardContent className="p-0">
                {/* Header */}
                <div className="p-4 border-b border-border/50">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{account.companyName}</h3>
                      <Badge 
                        variant="outline" 
                        className={cn("mt-1", getHealthColor(account.healthTier))}
                      >
                        {account.healthTier}
                      </Badge>
                    </div>
                    <div className={cn(
                      "text-3xl font-bold",
                      getHealthColor(account.healthTier)
                    )}>
                      {account.intelligenceScore}
                    </div>
                  </div>
                  
                  {/* Score Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Intelligence Score</span>
                      <span>{account.intelligenceScore}/100</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all", getScoreColor(account.intelligenceScore))}
                        style={{ width: `${account.intelligenceScore}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="p-4 space-y-3">
                  {/* Invoice Activity */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>Invoices</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-500">{account.metrics.invoiceActivity.paid30Days} paid</span>
                      <span className="text-muted-foreground">·</span>
                      <span className={account.metrics.invoiceActivity.overdue > 0 ? "text-red-500" : "text-muted-foreground"}>
                        {account.metrics.invoiceActivity.overdue} overdue
                      </span>
                    </div>
                  </div>

                  {/* Past Due Balance */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>Past Due</span>
                    </div>
                    <span className={cn(
                      "text-sm font-medium",
                      account.metrics.pastDueBalance > 0 ? "text-red-500" : "text-green-500"
                    )}>
                      ${account.metrics.pastDueBalance.toLocaleString()}
                    </span>
                  </div>

                  {/* Avg Days to Pay */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>Avg Days to Pay</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium">{account.metrics.avgDaysToPay}</span>
                      {getTrendIcon(account.metrics.paymentTrend)}
                    </div>
                  </div>

                  {/* Touchpoints */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <span>Touchpoints</span>
                    </div>
                    <span className="text-sm font-medium">{account.metrics.totalTouchpoints}</span>
                  </div>

                  {/* Inbound Emails */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>Inbound Replies</span>
                    </div>
                    <span className="text-sm font-medium">{account.metrics.inboundEmails}</span>
                  </div>

                  {/* Sentiment */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span>Sentiment</span>
                    </div>
                    <span className={cn("text-sm font-medium", getSentimentColor(account.metrics.sentiment))}>
                      {account.metrics.sentiment}
                    </span>
                  </div>

                  {/* Response Rate */}
                  <div className="pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Response Rate</span>
                      <span className="text-xs font-medium">{account.metrics.responseRate}%</span>
                    </div>
                    <Progress value={account.metrics.responseRate} className="h-1.5" />
                  </div>
                </div>

                {/* Footer Insight */}
                <div className="px-4 pb-4">
                  <div className={cn(
                    "p-3 rounded-lg text-sm",
                    account.healthTier === "Healthy" && "bg-green-500/10 text-green-700 dark:text-green-300",
                    account.healthTier === "Watch" && "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
                    account.healthTier === "At Risk" && "bg-orange-500/10 text-orange-700 dark:text-orange-300",
                    account.healthTier === "Critical" && "bg-red-500/10 text-red-700 dark:text-red-300"
                  )}>
                    {account.healthTier === "Healthy" && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        <span>Reliable payer. Standard follow-up cadence.</span>
                      </div>
                    )}
                    {account.healthTier === "Watch" && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span>Monitor closely. Increase touchpoint frequency.</span>
                      </div>
                    )}
                    {account.healthTier === "At Risk" && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>Escalate to senior AR. Consider payment plan.</span>
                      </div>
                    )}
                    {account.healthTier === "Critical" && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>Immediate action required. High write-off risk.</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-4xl font-bold text-primary mb-2">6+</div>
            <p className="text-sm text-muted-foreground">Data Points Analyzed</p>
          </div>
          <div>
            <div className="text-4xl font-bold text-primary mb-2">Real-time</div>
            <p className="text-sm text-muted-foreground">Score Updates</p>
          </div>
          <div>
            <div className="text-4xl font-bold text-primary mb-2">AI</div>
            <p className="text-sm text-muted-foreground">Sentiment Analysis</p>
          </div>
          <div>
            <div className="text-4xl font-bold text-primary mb-2">100%</div>
            <p className="text-sm text-muted-foreground">Automated Scoring</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CollectionIntelligenceShowcase;
