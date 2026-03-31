import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowRight, Brain, TrendingUp, AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";

const INTELLIGENCE_REPORTS = [
  {
    account: "Apex SaaS Co",
    riskLevel: "Moderate",
    riskColor: "text-yellow-500",
    score: 65,
    insights: [
      "Payment trend: Slowing — avg 12 days late over last 3 invoices",
      "No inbound communication in 45 days",
      "3 open invoices totaling $12,450",
    ],
    recommendation: "Escalate to James (31-60 day agent) with professional follow-up cadence",
  },
  {
    account: "GrowthStack Inc",
    riskLevel: "High Risk",
    riskColor: "text-destructive",
    score: 28,
    insights: [
      "Payment trend: Deteriorating — 2 invoices 90+ days overdue",
      "Last payment received 4 months ago",
      "Dispute filed on INV-2024023",
    ],
    recommendation: "Assign Katy (61-90 day agent). Address dispute first, then escalate remaining balance",
  },
  {
    account: "BrightPath Agency",
    riskLevel: "Low Risk",
    riskColor: "text-accent",
    score: 88,
    insights: [
      "Payment trend: Consistent — typically pays within 7 days of reminder",
      "Responded to last outreach within 2 hours",
      "1 invoice slightly past due ($2,340)",
    ],
    recommendation: "Sam (friendly agent) with single gentle reminder — high likelihood of immediate payment",
  },
];

export const DemoCollectionIntelligence = () => {
  const { nextStep, stats } = useDemoContext();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Collection Intelligence</h1>
        <p className="text-muted-foreground">
          AI-powered account analysis — risk scoring, sentiment, and strategy recommendations
        </p>
      </div>

      {/* AI Summary */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Brain className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Portfolio Intelligence Summary</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Analyzing {stats.overdueCount} overdue invoices across 25 accounts.{" "}
                  <span className="text-destructive font-medium">5 accounts</span> require immediate attention.{" "}
                  <span className="text-accent font-medium">12 accounts</span> have high recovery probability with gentle outreach.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Intelligence reports */}
      <div className="space-y-4">
        {INTELLIGENCE_REPORTS.map((report, i) => (
          <motion.div
            key={report.account}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.15 }}
          >
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      report.score < 40 ? "bg-destructive/10 text-destructive" :
                      report.score < 70 ? "bg-yellow-500/10 text-yellow-600" :
                      "bg-accent/10 text-accent"
                    }`}>
                      {report.score}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{report.account}</p>
                      <Badge variant="outline" className={`${report.riskColor} text-[10px]`}>
                        {report.riskLevel}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 mb-3">
                  {report.insights.map((insight, j) => (
                    <div key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                      {insight.includes("Deteriorating") || insight.includes("Dispute") ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                      ) : insight.includes("Consistent") || insight.includes("Responded") ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                      ) : (
                        <TrendingUp className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                      {insight}
                    </div>
                  ))}
                </div>

                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                  <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground">{report.recommendation}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={nextStep}>
          Next: Activate AI Outreach <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
