import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, TrendingUp, TrendingDown, Clock, DollarSign, Mail, MessageSquare, Activity, FileText, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ScoreCard {
  companyName: string;
  intelligenceScore: number;
  healthTier: "Healthy" | "Watch" | "At Risk" | "Critical";
  agentAction: string;
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
    agentAction: "Agent: Standard cadence — next follow-up in 5 days",
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
    agentAction: "Agent: Increased touchpoint frequency — payment plan offered",
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
    agentAction: "Agent: Escalation triggered — senior AR notified automatically",
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
  { icon: DollarSign, label: "Revenue at Risk", description: "Outstanding amount and ECL calculation" },
  { icon: Clock, label: "Payment Practices", description: "Paydex-style scoring and trends" },
  { icon: Mail, label: "Engagement Signals", description: "Response frequency and debtor intent" },
  { icon: MessageSquare, label: "Sentiment Analysis", description: "AI-analyzed tone of communications" },
  { icon: Zap, label: "Agent Effectiveness", description: "Which strategies recover revenue fastest" },
  { icon: TrendingUp, label: "Expansion Risk", description: "Credit risk assessment before account growth" },
];

const cardVariants = {
  hidden: { opacity: 0, y: 30, rotateX: 5 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: "easeOut" },
  }),
};

const factorVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.06, duration: 0.3 },
  }),
};

const CollectionIntelligenceShowcase = () => {
  return (
    <section className="py-24 px-4 bg-gradient-to-b from-background via-primary/5 to-background">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Brain className="h-4 w-4" />
            Agentic Revenue Risk Assessment
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            AI Agents Score, Prioritize & Act on Every Account
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Autonomous risk assessment across your entire portfolio — agents score accounts in real-time, 
            route high-risk debtors for escalation, and trigger recovery workflows automatically.
          </p>
        </motion.div>

        {/* Scoring Factors */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-16">
          {scoringFactors.map((factor, idx) => (
            <motion.div
              key={idx}
              custom={idx}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={factorVariants}
              whileHover={{ y: -4, scale: 1.03 }}
              className="p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-colors text-center group cursor-default"
            >
              <motion.div
                className="mx-auto w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3"
                whileHover={{ rotate: 10 }}
              >
                <factor.icon className="h-5 w-5 text-primary" />
              </motion.div>
              <h4 className="font-medium text-sm mb-1">{factor.label}</h4>
              <p className="text-xs text-muted-foreground">{factor.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Account Scorecards */}
        <div className="grid md:grid-cols-3 gap-6">
          {sampleAccounts.map((account, idx) => (
            <motion.div
              key={idx}
              custom={idx}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={cardVariants}
            >
              <Card
                className={cn(
                  "overflow-hidden border-2 transition-all hover:shadow-lg hover:-translate-y-1 h-full",
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
                      <motion.div
                        className={cn("text-3xl font-bold", getHealthColor(account.healthTier))}
                        initial={{ scale: 0 }}
                        whileInView={{ scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 + idx * 0.15, type: "spring", stiffness: 200 }}
                      >
                        {account.intelligenceScore}
                      </motion.div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Collectability Score</span>
                        <span>{account.intelligenceScore}/100</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div 
                          className={cn("h-full rounded-full", getScoreColor(account.intelligenceScore))}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${account.intelligenceScore}%` }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.5 + idx * 0.1, duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="p-4 space-y-3">
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

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span>Revenue at Risk</span>
                      </div>
                      <span className={cn(
                        "text-sm font-medium",
                        account.metrics.pastDueBalance > 0 ? "text-red-500" : "text-green-500"
                      )}>
                        ${account.metrics.pastDueBalance.toLocaleString()}
                      </span>
                    </div>

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

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Zap className="h-4 w-4 text-muted-foreground" />
                        <span>Agent Touchpoints</span>
                      </div>
                      <span className="text-sm font-medium">{account.metrics.totalTouchpoints}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>Debtor Replies</span>
                      </div>
                      <span className="text-sm font-medium">{account.metrics.inboundEmails}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span>Sentiment</span>
                      </div>
                      <span className={cn("text-sm font-medium", getSentimentColor(account.metrics.sentiment))}>
                        {account.metrics.sentiment}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-border/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Response Rate</span>
                        <span className="text-xs font-medium">{account.metrics.responseRate}%</span>
                      </div>
                      <Progress value={account.metrics.responseRate} className="h-1.5" />
                    </div>
                  </div>

                  {/* Agent Action Footer */}
                  <div className="px-4 pb-4">
                    <div className={cn(
                      "p-3 rounded-lg text-sm",
                      account.healthTier === "Healthy" && "bg-green-500/10 text-green-700 dark:text-green-300",
                      account.healthTier === "Watch" && "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
                      account.healthTier === "At Risk" && "bg-orange-500/10 text-orange-700 dark:text-orange-300",
                      account.healthTier === "Critical" && "bg-red-500/10 text-red-700 dark:text-red-300"
                    )}>
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 flex-shrink-0" />
                        <span>{account.agentAction}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Bottom Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: "6+", label: "Risk Signals Per Account" },
            { value: "Real-time", label: "Agent Score Updates" },
            { value: "ECL", label: "Revenue Risk Modeling" },
            { value: "100%", label: "Autonomous Scoring" },
          ].map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.4 }}
            >
              <div className="text-4xl font-bold text-primary mb-2">{stat.value}</div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CollectionIntelligenceShowcase;
