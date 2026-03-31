import { useState } from "react";
import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, RefreshCcw, Link2, Clock } from "lucide-react";
import { DemoTutorialCallout, TryItPrompt } from "./DemoTutorialCallout";

const INTEGRATIONS = [
  { name: "Stripe", desc: "Auto-sync invoices, payments & customers", status: "connected", lastSync: "2 min ago", records: "75 invoices · 25 customers", color: "bg-violet-500/10 text-violet-600" },
  { name: "QuickBooks Online", desc: "Import AR data & reconcile payments", status: "connected", lastSync: "15 min ago", records: "68 invoices · 22 customers", color: "bg-green-500/10 text-green-600" },
  { name: "CSV / Excel Upload", desc: "Bulk import accounts, invoices & payments", status: "available", lastSync: null, records: "Manual upload", color: "bg-blue-500/10 text-blue-600" },
  { name: "Salesforce CRM", desc: "Sync CRM accounts & support cases", status: "available", lastSync: null, records: "Enterprise tier", color: "bg-sky-500/10 text-sky-600" },
];

export const DemoIntegrations = () => {
  const { nextStep } = useDemoContext();
  const [simConnected, setSimConnected] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Step 3: Integrations</h1>
        <p className="text-muted-foreground">Connect your billing & CRM systems — data flows automatically</p>
      </div>

      <DemoTutorialCallout
        title="How Integrations Work"
        description="Connect once, sync forever. Recouply pulls invoices, customers, and payments from your billing system and keeps everything in sync."
        platformPath="Settings → Integrations"
        steps={[
          { title: "One-click OAuth connection", description: "Click 'Connect' next to Stripe or QuickBooks. You'll authorize via OAuth — no API keys needed.", action: "Click Connect on Stripe" },
          { title: "Automatic data sync", description: "After connecting, Recouply imports all open and overdue invoices, customer records, and payment history." },
          { title: "Bi-directional sync", description: "Payments recorded in your billing system automatically update invoice status in Recouply. No manual reconciliation needed." },
          { title: "CSV fallback", description: "If you don't use Stripe or QuickBooks, upload a CSV/Excel file with your AR data. Recouply maps columns automatically." },
        ]}
        proTip="Schedule automatic syncs (daily/hourly) to keep your AR data current without any manual intervention."
      />

      <FeatureScreenshot
        src={integrationsImg}
        alt="Recouply integrations settings"
        caption="The Integrations panel — connect Stripe, QuickBooks, CSV upload, and CRM systems"
      />

      <TryItPrompt
        label="Simulate connecting an integration"
        description="In production, you'd click 'Connect' and authorize via OAuth. Here, click to simulate a successful connection."
        completed={simConnected}
        onAction={() => setSimConnected(true)}
        actionLabel="Simulate Connect"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {INTEGRATIONS.map((intg, i) => (
          <motion.div key={intg.name} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className={intg.status === "connected" || (simConnected && intg.name === "CSV / Excel Upload") ? "border-accent/30" : ""}>
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
                  <Badge variant={intg.status === "connected" || (simConnected && intg.name === "CSV / Excel Upload") ? "default" : "outline"} className="text-[10px]">
                    {intg.status === "connected" || (simConnected && intg.name === "CSV / Excel Upload") ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Connected</> : "Available"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{intg.records}</span>
                  {intg.lastSync && <span className="flex items-center gap-1"><RefreshCcw className="h-3 w-3" /> Synced {intg.lastSync}</span>}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Auto-Sync Scheduling</p>
              <p className="text-xs text-muted-foreground">Configure daily automatic syncs to keep your AR data current without manual intervention</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={nextStep}>Next: Data Import <ArrowRight className="ml-2 h-4 w-4" /></Button>
      </div>
    </div>
  );
};
