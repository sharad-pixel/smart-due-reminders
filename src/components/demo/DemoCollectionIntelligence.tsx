import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowRight, Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Lightbulb, Clock, DollarSign } from "lucide-react";
import { DemoTutorialCallout } from "./DemoTutorialCallout";

export const DemoCollectionIntelligence = () => {
  const { nextStep, customers, invoices, paymentHistory, stats } = useDemoContext();

  // Build intelligence reports from actual enriched customer data
  const intelligenceReports = customers
    .filter(c => c.risk_tier !== "low")
    .sort((a, b) => a.risk_score - b.risk_score)
    .slice(0, 6)
    .map(c => {
      const custInvoices = invoices.filter(inv => inv.customer_id === c.id);
      const overdueInvs = custInvoices.filter(inv => inv.status === "overdue");
      const custPayments = paymentHistory.filter(p => p.customer_id === c.id);
      const totalOverdue = overdueInvs.reduce((s, inv) => s + inv.amount, 0);
      const avgLate = custPayments.length > 0 ? Math.round(custPayments.reduce((s, p) => s + p.days_late, 0) / custPayments.length) : null;

      const insights: string[] = [];
      if (avgLate !== null) insights.push(`Avg payment: ${avgLate} days late over ${custPayments.length} recent payments`);
      else insights.push("No recent payment history — high risk indicator");
      insights.push(`${overdueInvs.length} overdue invoice${overdueInvs.length !== 1 ? "s" : ""} totaling $${totalOverdue.toLocaleString()}`);
      insights.push(`Payment terms: ${c.payment_terms} · Actual avg: ${c.avg_days_to_pay} days`);

      const persona = c.risk_score < 40 ? "Katy/Troy" : c.risk_score < 60 ? "James" : "Sam";
      const recommendation = c.notes;

      return {
        customer: c,
        insights,
        persona,
        recommendation,
        overdueCount: overdueInvs.length,
        totalOverdue,
        lastPayment: custPayments.length > 0 ? custPayments.sort((a, b) => b.paid_date.localeCompare(a.paid_date))[0] : null,
      };
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Step 6: Collection Intelligence</h1>
        <p className="text-muted-foreground">AI-powered account analysis with real payment history and behavioral scoring</p>
      </div>

      <DemoTutorialCallout
        title="How Collection Intelligence Works"
        description="Below are live intelligence reports generated from each account's enriched data — payment history, risk score, outstanding balances, and AI-recommended actions."
        platformPath="Intelligence → Account Analysis"
        steps={[
          { title: "Payment behavior analysis", description: "AI tracks how many days late each customer typically pays and whether the trend is improving or worsening." },
          { title: "Risk score breakdown", description: "Scores factor in: aging bucket distribution (40%), payment consistency (30%), communication responsiveness (20%), and account size (10%)." },
          { title: "Agent assignment logic", description: "Low Risk → Sam (friendly), Moderate → James (professional), At Risk → Katy (firm), High Risk → Troy/Rocco (escalation)." },
          { title: "Actionable recommendations", description: "Each report includes the AI's suggested next step — generated from the account notes and scoring model." },
        ]}
        proTip="These reports update daily in production. The data below is generated from the same 25 accounts and payment histories you explored in earlier steps."
      />

      {/* Summary stats */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Brain className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Portfolio Intelligence Summary</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Analyzing {stats.overdueCount} overdue invoices.{" "}
                  <span className="text-destructive font-medium">{customers.filter(c => c.risk_tier === "high").length} high-risk</span> and{" "}
                  <span className="text-orange-500 font-medium">{customers.filter(c => c.risk_tier === "at_risk").length} at-risk</span> accounts flagged.{" "}
                  <span className="text-accent font-medium">{customers.filter(c => c.risk_tier === "low").length} accounts</span> have high recovery probability.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Intelligence reports from real data */}
      <div className="space-y-4">
        {intelligenceReports.map((report, i) => {
          const c = report.customer;
          return (
            <motion.div key={c.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }}>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold ${
                        c.risk_score < 40 ? "bg-destructive/10 text-destructive" :
                        c.risk_score < 60 ? "bg-orange-500/10 text-orange-600" :
                        "bg-yellow-500/10 text-yellow-600"
                      }`}>{c.risk_score}</div>
                      <div>
                        <p className="font-semibold text-foreground">{c.company_name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] ${
                            c.risk_tier === "high" ? "text-destructive" :
                            c.risk_tier === "at_risk" ? "text-orange-500" : "text-yellow-500"
                          }`}>{c.risk_tier === "at_risk" ? "At Risk" : c.risk_tier === "high" ? "High Risk" : "Moderate"}</Badge>
                          <span className="text-[10px] text-muted-foreground">{c.name} · {c.industry}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-destructive">${report.totalOverdue.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">{report.overdueCount} overdue</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-3">
                    {report.insights.map((insight, j) => (
                      <div key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                        {j === 0 ? (
                          c.avg_days_to_pay > 35 ? <TrendingDown className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" /> : <TrendingUp className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                        ) : j === 1 ? (
                          <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                        {insight}
                      </div>
                    ))}
                    {report.lastPayment && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                        Last payment: ${report.lastPayment.amount.toLocaleString()} on {report.lastPayment.paid_date} via {report.lastPayment.method}
                      </div>
                    )}
                    {!report.lastPayment && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                        No payments on record — potential bad debt
                      </div>
                    )}
                  </div>

                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                    <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-foreground">Recommended: Assign {report.persona} agent</p>
                      <p className="text-xs text-muted-foreground">{report.recommendation}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={nextStep}>Next: Activate AI Outreach <ArrowRight className="ml-2 h-4 w-4" /></Button>
      </div>
    </div>
  );
};
