import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, RefreshCcw, Link2, Clock } from "lucide-react";

const INTEGRATIONS = [
  {
    name: "Stripe",
    desc: "Auto-sync invoices, payments & customers",
    status: "connected",
    lastSync: "2 min ago",
    records: "75 invoices · 25 customers",
    color: "bg-violet-500/10 text-violet-600",
  },
  {
    name: "QuickBooks Online",
    desc: "Import AR data & reconcile payments",
    status: "connected",
    lastSync: "15 min ago",
    records: "68 invoices · 22 customers",
    color: "bg-green-500/10 text-green-600",
  },
  {
    name: "CSV / Excel Upload",
    desc: "Bulk import accounts, invoices & payments",
    status: "available",
    lastSync: null,
    records: "Manual upload",
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    name: "Salesforce CRM",
    desc: "Sync CRM accounts & support cases",
    status: "available",
    lastSync: null,
    records: "Enterprise tier",
    color: "bg-sky-500/10 text-sky-600",
  },
];

export const DemoIntegrations = () => {
  const { nextStep } = useDemoContext();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
        <p className="text-muted-foreground">
          Connect your billing & CRM systems — data flows automatically
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {INTEGRATIONS.map((intg, i) => (
          <motion.div
            key={intg.name}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className={intg.status === "connected" ? "border-accent/30" : ""}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${intg.color}`}>
                      <Link2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{intg.name}</p>
                      <p className="text-xs text-muted-foreground">{intg.desc}</p>
                    </div>
                  </div>
                  <Badge variant={intg.status === "connected" ? "default" : "outline"} className="text-[10px]">
                    {intg.status === "connected" ? (
                      <><CheckCircle2 className="h-3 w-3 mr-1" /> Connected</>
                    ) : "Available"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{intg.records}</span>
                  {intg.lastSync && (
                    <span className="flex items-center gap-1">
                      <RefreshCcw className="h-3 w-3" /> Synced {intg.lastSync}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Auto-Sync Scheduling</p>
              <p className="text-xs text-muted-foreground">
                Configure daily automatic syncs to keep your AR data current without manual intervention
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={nextStep}>
          Next: Data Import <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
