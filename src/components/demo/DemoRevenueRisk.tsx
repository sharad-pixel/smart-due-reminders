import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowRight, ShieldAlert, TrendingDown, BarChart3, AlertTriangle, Brain } from "lucide-react";
import { DemoTutorialCallout } from "./DemoTutorialCallout";

export const DemoRevenueRisk = () => {
  const { invoices, customers, stats, nextStep } = useDemoContext();
  const overdue = invoices.filter(i => i.status === "overdue");

  // Calculate risk tiers from real customer data
  const lowRisk = customers.filter(c => c.risk_tier === "low");
  const moderate = customers.filter(c => c.risk_tier === "moderate");
  const atRisk = customers.filter(c => c.risk_tier === "at_risk");
  const highRisk = customers.filter(c => c.risk_tier === "high");

  const riskTiers = [
    { tier: "Low Risk", score: "80–100", count: lowRisk.length, color: "text-accent", pct: `${Math.round(lowRisk.length / customers.length * 100)}%` },
    { tier: "Moderate", score: "60–79", count: moderate.length, color: "text-yellow-500", pct: `${Math.round(moderate.length / customers.length * 100)}%` },
    { tier: "At Risk", score: "40–59", count: atRisk.length, color: "text-orange-500", pct: `${Math.round(atRisk.length / customers.length * 100)}%` },
    { tier: "High Risk", score: "<40", count: highRisk.length, color: "text-destructive", pct: `${Math.round(highRisk.length / customers.length * 100)}%` },
  ];

  const eclTotal = Math.round(stats.totalOverdue * 0.22);
  const avgScore = Math.round(customers.reduce((s, c) => s + c.risk_score, 0) / customers.length);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Step 5: Revenue Risk & ECL Analysis</h1>
        <p className="text-muted-foreground">Collectability scoring using ASC 326 / IFRS 9 methodology</p>
      </div>

      <DemoTutorialCallout
        title="Understanding Revenue Risk"
        description="All numbers below are calculated from the 25 customer accounts and 75 invoices loaded in this demo. Risk tiers come from the per-account scores you saw in Step 1."
        platformPath="Analytics → Revenue Risk"
        steps={[
          { title: "ECL calculation", description: "Expected Credit Loss is calculated per aging bucket: Current (1%), 1-30 (5%), 31-60 (12%), 61-90 (25%), 91-120 (40%), 120+ (65%)." },
          { title: "Risk tier assignment", description: `Your portfolio: ${lowRisk.length} Low Risk, ${moderate.length} Moderate, ${atRisk.length} At Risk, ${highRisk.length} High Risk accounts.` },
          { title: "Collectability scoring", description: "Each invoice's collectability score (shown in the invoice table) feeds into the portfolio-level ECL calculation." },
          { title: "What-if projections", description: "The 'Do Nothing' cost shows how much you'd lose if no collection action is taken — based on historical write-off rates." },
        ]}
        proTip="Your average portfolio risk score is " + avgScore + "/100. A healthy portfolio stays above 70."
      />

      {/* Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-destructive/20">
            <CardContent className="p-5 text-center">
              <ShieldAlert className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-2xl font-bold text-destructive">${eclTotal.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Expected Credit Loss (ECL)</p>
              <p className="text-xs text-muted-foreground mt-1">22% of ${stats.totalOverdue.toLocaleString()} overdue</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-5 text-center">
              <TrendingDown className="h-8 w-8 text-orange-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{atRisk.length + highRisk.length}</p>
              <p className="text-sm text-muted-foreground">At-Risk + High-Risk Accounts</p>
              <p className="text-xs text-muted-foreground mt-1">{atRisk.map(c => c.company_name).slice(0, 2).join(", ")}…</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="p-5 text-center">
              <BarChart3 className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{avgScore}</p>
              <p className="text-sm text-muted-foreground">Avg Portfolio Risk Score</p>
              <p className="text-xs text-muted-foreground mt-1">{avgScore >= 70 ? "Healthy range" : "Below target — action needed"}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Risk distribution */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-4">Risk Distribution by Account</h3>
          <div className="space-y-3">
            {riskTiers.map((tier, i) => (
              <motion.div key={tier.tier} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.1 }} className="flex items-center gap-4">
                <div className="w-24 text-sm font-medium text-foreground">{tier.tier}</div>
                <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: tier.pct }} transition={{ delay: 0.5 + i * 0.1, duration: 0.6 }} className="h-full rounded-full bg-primary/70" />
                </div>
                <Badge variant="outline" className={`${tier.color} text-xs w-20 justify-center`}>{tier.count} accts</Badge>
                <span className="text-xs text-muted-foreground w-12 text-right">{tier.score}</span>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Highest risk invoices with real scores */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Highest Risk Invoices
          </h3>
          <div className="space-y-2">
            {overdue.sort((a, b) => a.collectability_score - b.collectability_score).slice(0, 5).map(inv => (
              <div key={inv.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  inv.collectability_score < 30 ? "bg-destructive/10 text-destructive" :
                  inv.collectability_score < 50 ? "bg-orange-500/10 text-orange-500" :
                  "bg-yellow-500/10 text-yellow-600"
                }`}>{inv.collectability_score}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{inv.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{inv.invoice_number} · {inv.days_past_due} days · {inv.contact_name}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-semibold text-destructive">${inv.amount.toLocaleString()}</span>
                  <div className="flex items-start gap-1 mt-0.5">
                    <Brain className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground max-w-[180px]">{inv.ai_recommendation}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={nextStep}>Next: Collection Intelligence <ArrowRight className="ml-2 h-4 w-4" /></Button>
      </div>
    </div>
  );
};
