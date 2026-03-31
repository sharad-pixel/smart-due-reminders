import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowRight, ShieldAlert, TrendingDown, BarChart3, AlertTriangle } from "lucide-react";

export const DemoRevenueRisk = () => {
  const { invoices, stats, nextStep } = useDemoContext();
  const overdue = invoices.filter(i => i.status === "overdue");

  // Simulated risk scores
  const riskTiers = [
    { tier: "Low Risk", score: "80–100", count: 12, color: "text-accent", bg: "bg-accent/10", pct: "16%" },
    { tier: "Moderate", score: "60–79", count: 18, color: "text-yellow-500", bg: "bg-yellow-500/10", pct: "24%" },
    { tier: "At Risk", score: "40–59", count: 10, color: "text-orange-500", bg: "bg-orange-500/10", pct: "13%" },
    { tier: "High Risk", score: "<40", count: 5, color: "text-destructive", bg: "bg-destructive/10", pct: "7%" },
  ];

  const eclTotal = Math.round(stats.totalOverdue * 0.22);
  const atRiskAccounts = 15;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Revenue Risk & ECL Analysis</h1>
        <p className="text-muted-foreground">
          Collectability scoring using ASC 326 / IFRS 9 methodology
        </p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-destructive/20">
            <CardContent className="p-5 text-center">
              <ShieldAlert className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-2xl font-bold text-destructive">${eclTotal.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Expected Credit Loss (ECL)</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-5 text-center">
              <TrendingDown className="h-8 w-8 text-orange-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{atRiskAccounts}</p>
              <p className="text-sm text-muted-foreground">At-Risk Accounts</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="p-5 text-center">
              <BarChart3 className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">67</p>
              <p className="text-sm text-muted-foreground">Avg Collectability Score</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Risk distribution */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-4">Risk Distribution</h3>
          <div className="space-y-3">
            {riskTiers.map((tier, i) => (
              <motion.div
                key={tier.tier}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-4"
              >
                <div className="w-24 text-sm font-medium text-foreground">{tier.tier}</div>
                <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: tier.pct }}
                    transition={{ delay: 0.5 + i * 0.1, duration: 0.6 }}
                    className={`h-full rounded-full ${tier.bg.replace("/10", "")}`}
                    style={{ backgroundColor: `hsl(var(--${tier.tier === "Low Risk" ? "accent" : tier.tier === "High Risk" ? "destructive" : "primary"}))`, opacity: 0.7 }}
                  />
                </div>
                <Badge variant="outline" className={`${tier.color} text-xs w-16 justify-center`}>
                  {tier.count} accts
                </Badge>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sample at-risk invoices */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Highest Risk Invoices
          </h3>
          <div className="space-y-2">
            {overdue.sort((a, b) => b.days_past_due - a.days_past_due).slice(0, 5).map(inv => {
              const score = Math.max(10, 100 - inv.days_past_due);
              return (
                <div key={inv.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    score < 40 ? "bg-destructive/10 text-destructive" : "bg-orange-500/10 text-orange-500"
                  }`}>
                    {score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{inv.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{inv.invoice_number} · {inv.days_past_due} days overdue</p>
                  </div>
                  <span className="text-sm font-semibold text-destructive">${inv.amount.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={nextStep}>
          Next: Collection Intelligence <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
