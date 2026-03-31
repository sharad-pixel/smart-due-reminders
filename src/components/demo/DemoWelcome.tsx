import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { ArrowRight, Users, FileText, Brain, Send, DollarSign, BarChart3, Database, Link, CalendarRange, History, Download } from "lucide-react";

const FEATURE_STEPS = [
  { icon: Users, label: "Account Setup", desc: "25 customer accounts loaded" },
  { icon: FileText, label: "Invoice Portfolio", desc: "75 invoices across aging buckets" },
  { icon: Link, label: "Integrations", desc: "Stripe & QuickBooks sync" },
  { icon: Database, label: "Data Import", desc: "CSV, Excel, API import" },
  { icon: BarChart3, label: "Revenue Risk", desc: "ECL & collectability scores" },
  { icon: Brain, label: "Collection Intelligence", desc: "AI-powered account analysis" },
  { icon: Send, label: "AI Outreach", desc: "Draft, forecast & send" },
  { icon: CalendarRange, label: "Outreach Forecast", desc: "Predict future communications" },
  { icon: History, label: "Outreach History", desc: "Full activity timeline" },
  { icon: DollarSign, label: "Payment Recovery", desc: "Watch payments come in" },
  { icon: Download, label: "Data Export", desc: "Reports & analytics export" },
];

export const DemoWelcome = () => {
  const { nextStep, demoEmail } = useDemoContext();

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="text-center space-y-3">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-4xl font-bold text-foreground"
        >
          Welcome to Your Demo Dashboard
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-muted-foreground text-lg"
        >
          {demoEmail ? `Great to have you, ` : ""}Here's what you'll experience step by step:
        </motion.p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {FEATURE_STEPS.map(({ icon: Icon, label, desc }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
          >
            <Card className="h-full hover:border-primary/30 transition-colors">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <span className="text-xs font-mono text-muted-foreground/50 ml-auto">{i + 1}</span>
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
