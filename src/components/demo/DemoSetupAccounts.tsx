import { useState } from "react";
import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowRight, Building2, Mail, Phone, Shield, Clock, DollarSign, ChevronDown } from "lucide-react";
import { DemoTutorialCallout, TryItPrompt } from "./DemoTutorialCallout";
import { formatPhone } from "@/lib/formatPhone";

export const DemoSetupAccounts = () => {
  const { customers, nextStep } = useDemoContext();
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const visibleCustomers = showAll ? customers : customers.slice(0, 9);

  const riskColors: Record<string, string> = {
    low: "bg-accent/10 text-accent border-accent/20",
    moderate: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    at_risk: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    high: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const riskLabels: Record<string, string> = {
    low: "Low Risk", moderate: "Moderate", at_risk: "At Risk", high: "High Risk",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Step 1: Account Setup</h1>
          <p className="text-muted-foreground">
            Import and manage your customer accounts — the foundation of your collection workflow
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">{customers.length} accounts</Badge>
      </div>

      <DemoTutorialCallout
        title="How Accounts Work in Recouply"
        description="Each account represents a customer with outstanding invoices. Every card below shows real data fields you'd see in production."
        platformPath="Dashboard → Accounts"
        steps={[
          { title: "Contact details", description: "Each account has a primary contact with name, email, and phone. Click any card below to expand the full profile." },
          { title: "Risk scoring (0–100)", description: "AI scores each account based on payment history, aging, and behavior. Green = Low Risk (80+), Yellow = Moderate (60-79), Orange = At Risk (40-59), Red = High Risk (<40)." },
          { title: "Payment terms & history", description: "See each account's terms (Net 15/30/45), average days to pay, lifetime revenue, and last payment date." },
          { title: "AI notes", description: "Recouply auto-generates account notes with recommendations — e.g. 'Paying slower since Q3 — monitor closely'." },
        ]}
        proTip="Click any account card below to expand it and see the full data profile — this is exactly what you'd see in the real platform."
      />

      <TryItPrompt
        label="Explore Demo Accounts"
        description={`${customers.length} realistic customer accounts are pre-loaded below. Click any card to see the full profile with risk scores, payment history, and AI notes.`}
        completed={showAll}
        onAction={() => setShowAll(true)}
        actionLabel="Show All Accounts"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-1">
        {visibleCustomers.map((c, i) => {
          const isExpanded = expandedId === c.id;
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(i * 0.03, 0.5) }}
            >
              <Card
                className="hover:border-primary/20 transition-colors cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : c.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm text-foreground truncate">{c.company_name}</p>
                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{c.name}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="outline" className="text-[10px]">{c.industry}</Badge>
                        <Badge variant="outline" className={`text-[10px] ${riskColors[c.risk_tier]}`}>
                          <Shield className="h-2.5 w-2.5 mr-0.5" /> {c.risk_score}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-3 pt-3 border-t border-border space-y-2"
                    >
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Mail className="h-3 w-3" /> {c.email}
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="h-3 w-3" /> {formatPhone(c.phone)}
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3 w-3" /> {c.payment_terms} · Avg {c.avg_days_to_pay}d
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <DollarSign className="h-3 w-3" /> LTV ${c.total_lifetime_revenue.toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-medium ${riskColors[c.risk_tier].split(" ")[1]}`}>{riskLabels[c.risk_tier]}</span>
                        <span className="text-muted-foreground">
                          Last paid: {c.last_payment_date || "No recent payment"}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground italic bg-muted/30 rounded p-2">
                        AI Note: {c.notes}
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <DemoTutorialCallout
        title="In the real platform"
        description="Accounts sync automatically from Stripe, QuickBooks, or CSV upload. Each account gets a unique Recouply Account ID (RAID) for cross-system tracking."
        variant="tip"
      />

      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={nextStep}>
          Next: View Invoices <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
