import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { ArrowRight, Users, FileText, Brain, Send, DollarSign, BarChart3, Database, Link, CalendarRange, History, Download, Sparkles, BrainCircuit } from "lucide-react";
import { DemoTutorialCallout } from "./DemoTutorialCallout";

const FEATURE_STEPS = [
  { icon: Users, label: "Account Setup", desc: "25 customer accounts loaded", step: "setup_accounts" as const },
  { icon: FileText, label: "Invoice Portfolio", desc: "75 invoices across aging buckets", step: "setup_invoices" as const },
  { icon: Link, label: "Integrations", desc: "Stripe & QuickBooks sync", step: "integrations" as const },
  { icon: Database, label: "Data Import", desc: "CSV, Excel, API import", step: "data_import" as const },
  { icon: BarChart3, label: "Revenue Risk Intelligence", desc: "ECL scoring & cash flow forecasting", step: "revenue_risk" as const },
  { icon: Brain, label: "AI Agent Orchestration", desc: "Six agents adapt to invoice aging", step: "collection_intelligence" as const },
  { icon: BrainCircuit, label: "Inbound AI Agent", desc: "Autonomous debtor response handling", step: "inbound_ai" as const },
  { icon: Sparkles, label: "Agentic Outreach", desc: "AI-generated, tone-matched drafts", step: "activate" as const },
  { icon: Send, label: "Human-in-the-Loop Review", desc: "Approve or refine before sending", step: "drafts" as const },
  { icon: CalendarRange, label: "Outreach Cadence", desc: "Automated 7-day recovery plan", step: "outreach_forecast" as const },
  { icon: Send, label: "Autonomous Sending", desc: "Consistent, always-on outreach", step: "sending" as const },
  { icon: History, label: "Engagement Intelligence", desc: "Track opens, clicks & replies", step: "outreach_history" as const },
  { icon: DollarSign, label: "Revenue Recovery", desc: "Cash flow impact in real time", step: "payments" as const },
  { icon: Download, label: "Data Export", desc: "Reports & reconciliation", step: "data_export" as const },
];

export const DemoWelcome = () => {
  const { nextStep, demoEmail, goToStep } = useDemoContext();

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="text-center space-y-3">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-4xl font-bold text-foreground"
        >
          Your AI-Agentic Revenue Recovery Platform
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-muted-foreground text-lg"
        >
          {demoEmail ? `Great to have you! ` : ""}See how intelligent AI agents replace manual follow-ups with consistent, always-on revenue procurement — strengthening cash flow without adding headcount.
        </motion.p>
      </div>

      <DemoTutorialCallout
        title="How AI-Agentic Recovery Works"
        description="Each step showcases how Recouply.ai's six AI agents orchestrate revenue recovery — from risk intelligence to autonomous outreach to cash flow results."
        variant="info"
        steps={[
          { title: "AI agents handle the repetitive work", description: "Each agent adapts tone and cadence to invoice aging — no human bottlenecks, consistent outreach every time." },
          { title: "Interact with realistic data", description: "25 customer accounts and 75 invoices are pre-loaded. Activate agents, trigger outreach, and watch revenue recover." },
          { title: "See the cash flow impact", description: "Track how agentic automation translates directly into healthier cash flow and predictable revenue procurement." },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {FEATURE_STEPS.map(({ icon: Icon, label, desc, step }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.04 }}
          >
            <Card
              className="h-full hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => goToStep(step)}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <span className="text-xs font-mono text-muted-foreground/50">{i + 1}</span>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-center pt-4"
      >
        <Button size="lg" onClick={nextStep} className="text-lg px-8 py-6">
          Let's Start — Set Up Accounts <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </motion.div>
    </div>
  );
};
