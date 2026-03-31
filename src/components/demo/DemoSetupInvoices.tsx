import { useState } from "react";
import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, AlertTriangle, CheckCircle2, Brain, ChevronDown, FileText } from "lucide-react";
import { DemoTutorialCallout, TryItPrompt } from "./DemoTutorialCallout";

export const DemoSetupInvoices = () => {
  const { invoices, stats, agingBuckets, nextStep } = useDemoContext();
  const [expandedInvId, setExpandedInvId] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  const bucketLabels: Record<string, string> = {
    current: "Current", "1-30": "1–30 DPD", "31-60": "31–60 DPD",
    "61-90": "61–90 DPD", "91-120": "91–120 DPD", "120+": "120+ DPD",
  };

  const statusColors: Record<string, string> = {
    current: "text-accent", "1-30": "text-yellow-500", "31-60": "text-orange-500",
    "61-90": "text-red-500", "91-120": "text-red-600", "120+": "text-destructive",
  };

  const displayInvoices = showMore ? invoices.slice(0, 25) : invoices.slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Step 2: Invoice Portfolio</h1>
        <p className="text-muted-foreground">
          {stats.totalInvoices} invoices · ${stats.totalAll.toLocaleString()} total · <span className="text-destructive font-semibold">${stats.totalOverdue.toLocaleString()} overdue</span>
        </p>
      </div>

      <DemoTutorialCallout
        title="Understanding Your Invoice Portfolio"
        description="Each invoice below has full line-item detail, collectability score, PO number, and AI recommendations. Click any row to expand."
        platformPath="Dashboard → Invoices"
        steps={[
          { title: "Aging buckets auto-calculate", description: "Invoices move between buckets daily. Current → 1-30 → 31-60 → 61-90 → 91-120 → 120+ days past due." },
          { title: "Collectability score (0–100)", description: "Each invoice gets a score: 90+ = very likely to collect, 50-89 = needs attention, <50 = at risk of write-off." },
          { title: "AI recommendation per invoice", description: "Every overdue invoice has an AI-generated next action — e.g. 'Escalate to James agent' or 'Offer payment plan'." },
          { title: "Line-item detail", description: "Click any invoice row to see the full breakdown: line items, PO number, preferred payment method, and more.", action: "Click an invoice row to expand" },
        ]}
        proTip="Invoices older than 90 days have a 50%+ chance of going uncollected. Recouply prioritizes these for immediate escalation."
      />

      <TryItPrompt
        label="Explore Invoice Details"
        description="Click any invoice row to expand and see line items, collectability score, and AI recommendation."
        completed={expandedInvId !== null}
      />

      {/* Aging summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(agingBuckets).map(([bucket, data], i) => (
          <motion.div key={bucket} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className={`text-center ${bucket !== "current" && data.count > 0 ? "border-destructive/20" : ""}`}>
              <CardContent className="p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{bucketLabels[bucket]}</p>
                <p className={`text-xl font-bold ${statusColors[bucket]}`}>{data.count}</p>
                <p className="text-xs text-muted-foreground">${Math.round(data.total).toLocaleString()}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Invoice table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="text-left p-3 font-medium text-muted-foreground">Invoice #</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Customer / Contact</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Score</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">DPD</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {displayInvoices.map((inv, i) => {
                  const isExpanded = expandedInvId === inv.id;
                  return (
                    <motion.tr
                      key={inv.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 + i * 0.02 }}
                      className="border-b border-border/50 hover:bg-muted/20 cursor-pointer"
                      onClick={() => setExpandedInvId(isExpanded ? null : inv.id)}
                    >
                      <td className="p-3 font-mono text-xs">{inv.invoice_number}</td>
                      <td className="p-3">
                        <p className="text-foreground text-sm">{inv.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{inv.contact_name} · {inv.contact_email}</p>
                        {isExpanded && (
                          <AnimatePresence>
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-2">
                              {/* Line items */}
                              <div className="bg-muted/30 rounded-lg p-3">
                                <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5"><FileText className="h-3 w-3" /> Line Items</p>
                                {inv.line_items.map((li, j) => (
                                  <div key={j} className="flex justify-between text-xs text-muted-foreground py-0.5">
                                    <span>{li.description} × {li.qty}</span>
                                    <span className="font-medium">${li.total.toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                              {/* Metadata */}
                              <div className="flex flex-wrap gap-2 text-[10px]">
                                {inv.po_number && <Badge variant="outline">PO: {inv.po_number}</Badge>}
                                {inv.payment_method && <Badge variant="outline">Pay via: {inv.payment_method}</Badge>}
                                <Badge variant="outline">Issued: {inv.issue_date}</Badge>
                                <Badge variant="outline">Due: {inv.due_date}</Badge>
                              </div>
                              {/* AI Recommendation */}
                              {inv.status === "overdue" && (
                                <div className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                                  <Brain className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                                  <p className="text-xs text-foreground">{inv.ai_recommendation}</p>
                                </div>
                              )}
                            </motion.div>
                          </AnimatePresence>
                        )}
                      </td>
                      <td className="p-3 text-right font-medium">${inv.amount.toLocaleString()}</td>
                      <td className="p-3 text-center">
                        <div className={`inline-flex h-7 w-7 rounded-full items-center justify-center text-xs font-bold ${
                          inv.collectability_score >= 80 ? "bg-accent/10 text-accent" :
                          inv.collectability_score >= 50 ? "bg-yellow-500/10 text-yellow-600" :
                          "bg-destructive/10 text-destructive"
                        }`}>{inv.collectability_score}</div>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={inv.status === "overdue" ? "destructive" : "secondary"} className="text-[10px]">
                          {inv.status === "overdue" ? <><AlertTriangle className="h-3 w-3 mr-1" /> Overdue</> : <><CheckCircle2 className="h-3 w-3 mr-1" /> Open</>}
                        </Badge>
                      </td>
                      <td className="p-3 text-right text-muted-foreground">{inv.days_past_due || "—"}</td>
                      <td className="p-3">
                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!showMore && invoices.length > 10 && (
            <button onClick={() => setShowMore(true)} className="w-full p-3 text-center text-sm text-primary hover:bg-muted/30 border-t border-border transition-colors">
              Show {Math.min(invoices.length, 25) - 10} more invoices
            </button>
          )}
          {showMore && invoices.length > 25 && (
            <div className="p-3 text-center text-sm text-muted-foreground border-t border-border">
              + {invoices.length - 25} more invoices in full platform
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={nextStep}>
          Next: Integrations <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
