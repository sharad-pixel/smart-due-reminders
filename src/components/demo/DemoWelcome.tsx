import { useDemoContext } from "@/contexts/DemoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { ArrowRight, Users, FileText, Brain, Send, DollarSign, BarChart3, Database, Link, CalendarRange, History, Download, Sparkles, BrainCircuit, PlayCircle, FileSignature } from "lucide-react";
import { DemoTutorialCallout } from "./DemoTutorialCallout";
import { Link as RouterLink } from "react-router-dom";
import sharadAvatar from "@/assets/founder-sharad.jpg";
import { founderConfig } from "@/lib/founderConfig";

const FEATURE_STEPS = [
  { icon: Users, label: "Account Setup", desc: "25 customer accounts loaded", step: "setup_accounts" as const },
  { icon: FileText, label: "Invoice Portfolio", desc: "75 invoices across aging buckets", step: "setup_invoices" as const },
  { icon: Link, label: "Integrations", desc: "Stripe & QuickBooks sync", step: "integrations" as const },
  { icon: Database, label: "Data Import", desc: "CSV, Excel, API import", step: "data_import" as const },
  { icon: BarChart3, label: "Revenue Risk Intelligence", desc: "ECL scoring & risk-based prioritization", step: "revenue_risk" as const },
  { icon: Brain, label: "AI Collections Workflows", desc: "Six agents adapt to invoice aging", step: "collection_intelligence" as const },
  { icon: BrainCircuit, label: "Inbound AI Agent", desc: "Autonomous customer response handling", step: "inbound_ai" as const },
  { icon: Sparkles, label: "AI-Powered Outreach", desc: "AI-generated, tone-matched drafts", step: "activate" as const },
  { icon: Send, label: "Human-in-the-Loop Review", desc: "Approve or refine before sending", step: "drafts" as const },
  { icon: CalendarRange, label: "Outreach Cadence", desc: "Risk-aware 7-day recovery plan", step: "outreach_forecast" as const },
  { icon: Send, label: "Autonomous Sending", desc: "Consistent, always-on outreach", step: "sending" as const },
  { icon: History, label: "Full Audit Trail", desc: "Track opens, clicks, replies & outcomes", step: "outreach_history" as const },
  { icon: DollarSign, label: "Cash Recovery", desc: "Revenue impact in real time", step: "payments" as const },
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
          Welcome to Recouply.ai — let me show you around.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-muted-foreground text-lg"
        >
          {demoEmail ? `Great to have you! ` : ""}This demo walks you through how AI-powered <strong>Collections Intelligence</strong> and <strong>Contract Intelligence</strong> work side-by-side — replacing manual follow-ups and lost renewals with one source of truth.
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent">
          <CardContent className="p-5 flex gap-4 items-start">
            <img
              src={sharadAvatar}
              alt={`${founderConfig.name}, ${founderConfig.title}`}
              className="h-14 w-14 rounded-full object-cover border-2 border-primary/30 shrink-0"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground mb-1">
                A personal note from {founderConfig.name}, {founderConfig.title}
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Hey — Sharad here. After 15+ years building revenue and billing systems at Workday, ServiceTitan, and Contentful, I built Recouply to give finance teams two superpowers in one platform: <strong>Collections Intelligence</strong> and <strong>Contract Intelligence</strong>. Click through the demo, and email me at{' '}
                <a href={`mailto:${founderConfig.email}`} className="underline hover:text-foreground">{founderConfig.email}</a> with anything you want to see next.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <DemoTutorialCallout
        title="How Recouply Works — Collections + Contract Intelligence"
        description="Six AI collections agents orchestrate risk-based outreach, while Contract Intelligence keeps every engagement, template, and renewal tracked from day one. Every action is auditable, every send is yours to approve."
        variant="info"
        steps={[
          { title: "AI agents handle repeatable workflows", description: "Each agent adapts tone and cadence to invoice aging — consistent outreach, risk-aware prioritization, full audit trail." },
          { title: "Interact with realistic data", description: "25 customer accounts and 75 invoices are pre-loaded. Activate agents, trigger outreach, and watch cash recover." },
          { title: "See the cash impact", description: "Track how AI-powered collections workflows translate directly into reduced DSO, mitigated risk, and stronger cash position." },
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
        className="text-center pt-4 space-y-3"
      >
        <Button size="lg" onClick={nextStep} className="text-lg px-8 py-6">
          Let's Start — Set Up Accounts <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
        <div>
          <RouterLink to="/onboarding?step=training">
            <Button variant="ghost" size="sm" className="text-muted-foreground gap-2">
              <PlayCircle className="h-4 w-4" />
              Watch Training Videos
            </Button>
          </RouterLink>
        </div>
      </motion.div>
    </div>
  );
};
