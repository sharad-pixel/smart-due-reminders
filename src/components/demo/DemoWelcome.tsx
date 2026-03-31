import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { ArrowRight, Users, FileText, Brain, Send, DollarSign, BarChart3, Database, Link, CalendarRange, History, Download, Sparkles } from "lucide-react";
import { DemoTutorialCallout } from "./DemoTutorialCallout";

const FEATURE_STEPS = [
  { icon: Users, label: "Account Setup", desc: "25 customer accounts loaded", step: "setup_accounts" as const },
  { icon: FileText, label: "Invoice Portfolio", desc: "75 invoices across aging buckets", step: "setup_invoices" as const },
  { icon: Link, label: "Integrations", desc: "Stripe & QuickBooks sync", step: "integrations" as const },
  { icon: Database, label: "Data Import", desc: "CSV, Excel, API import", step: "data_import" as const },
  { icon: BarChart3, label: "Revenue Risk", desc: "ECL & collectability scores", step: "revenue_risk" as const },
  { icon: Brain, label: "Collection Intelligence", desc: "AI-powered account analysis", step: "collection_intelligence" as const },
  { icon: Sparkles, label: "AI Activation", desc: "Generate outreach drafts", step: "activate" as const },
  { icon: Send, label: "Draft Review", desc: "Review & approve messages", step: "drafts" as const },
  { icon: CalendarRange, label: "Outreach Forecast", desc: "7-day communication plan", step: "outreach_forecast" as const },
  { icon: Send, label: "Live Sending", desc: "Watch emails go out", step: "sending" as const },
  { icon: History, label: "Outreach History", desc: "Track opens & replies", step: "outreach_history" as const },
  { icon: DollarSign, label: "Payment Recovery", desc: "Watch payments come in", step: "payments" as const },
  { icon: Download, label: "Data Export", desc: "Reports & analytics", step: "data_export" as const },
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
          Welcome to Your Guided Onboarding
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-muted-foreground text-lg"
        >
          {demoEmail ? `Great to have you! ` : ""}Walk through every feature step by step with interactive tutorials and real data.
        </motion.p>
      </div>

      <DemoTutorialCallout
        title="How This Onboarding Works"
        description="Each step below represents a core feature of Recouply.ai. You'll see mockup screenshots of the real interface, step-by-step instructions, and interactive 'Try It' prompts with pre-loaded demo data."
        variant="info"
        steps={[
          { title: "Follow the guided path", description: "Click 'Next' to progress through each feature in order, or jump to any step using the sidebar." },
          { title: "Interact with demo data", description: "25 realistic customer accounts and 75 invoices are pre-loaded. Simulate imports, activate AI agents, and watch payments come in." },
          { title: "Learn by doing", description: "Each step has expandable tutorials with detailed instructions for the real platform." },
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
