import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowRight, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";

export const DemoSetupInvoices = () => {
  const { invoices, stats, agingBuckets, nextStep } = useDemoContext();

  const bucketLabels: Record<string, string> = {
    current: "Current", "1-30": "1–30 DPD", "31-60": "31–60 DPD",
    "61-90": "61–90 DPD", "91-120": "91–120 DPD", "120+": "120+ DPD",
  };

  const statusColors: Record<string, string> = {
    current: "text-accent", "1-30": "text-yellow-500", "31-60": "text-orange-500",
    "61-90": "text-red-500", "91-120": "text-red-600", "120+": "text-destructive",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Invoice Portfolio</h1>
        <p className="text-muted-foreground">
          {stats.totalInvoices} invoices · ${stats.totalAll.toLocaleString()} total · <span className="text-destructive font-semibold">${stats.totalOverdue.toLocaleString()} overdue</span>
        </p>
      </div>

      {/* Aging summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(agingBuckets).map(([bucket, data], i) => (
          <motion.div
            key={bucket}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
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

      {/* Invoice table sample */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="text-left p-3 font-medium text-muted-foreground">Invoice #</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Customer</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Days Past Due</th>
                </tr>
              </thead>
              <tbody>
                {invoices.slice(0, 12).map((inv, i) => (
                  <motion.tr
                    key={inv.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.03 }}
                    className="border-b border-border/50 hover:bg-muted/20"
                  >
                    <td className="p-3 font-mono text-xs">{inv.invoice_number}</td>
                    <td className="p-3 text-foreground">{inv.customer_name}</td>
                    <td className="p-3 text-right font-medium">${inv.amount.toLocaleString()}</td>
                    <td className="p-3 text-center">
                      <Badge variant={inv.status === "overdue" ? "destructive" : "secondary"} className="text-[10px]">
                        {inv.status === "overdue" ? (
                          <><AlertTriangle className="h-3 w-3 mr-1" /> Overdue</>
                        ) : (
                          <><CheckCircle2 className="h-3 w-3 mr-1" /> Open</>
                        )}
                      </Badge>
                    </td>
                    <td className="p-3 text-right text-muted-foreground">{inv.days_past_due || "—"}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {invoices.length > 12 && (
            <div className="p-3 text-center text-sm text-muted-foreground border-t border-border">
              + {invoices.length - 12} more invoices
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
