import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FileSignature,
  Sparkles,
  CalendarClock,
  ShieldAlert,
  Receipt,
  ArrowRight,
  CheckCircle2,
  Bell,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

const PILLARS = [
  {
    icon: Sparkles,
    title: "Extract Contract Data",
    body: "AI reads every MSA, order form, and amendment — extracting payment terms, obligations, financials, and clauses into structured data your finance stack can act on.",
  },
  {
    icon: CalendarClock,
    title: "Renewal & Opt-Out Reminders",
    body: "Renewal dates, non-renewal notice windows, and opt-out deadlines become owner-level alerts so you never miss a key event.",
  },
  {
    icon: Receipt,
    title: "Custom Triggers & Automation",
    body: "Orchestrate automation off any captured data point — milestones, escalators, true-ups — inside the only platform designed as a Finance CRM.",
  },
];

export default function ContractIntelligenceTeaser() {
  return (
    <section className="relative py-20 overflow-hidden bg-gradient-to-b from-indigo-50/40 via-background to-background dark:from-indigo-950/20">
      {/* subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="container mx-auto px-4 max-w-6xl relative">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
          className="text-center mb-12 max-w-3xl mx-auto"
        >
          <Badge
            variant="outline"
            className="mb-4 bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40"
          >
            <FileSignature className="h-3 w-3 mr-1" /> Contract Intelligence · The Finance CRM
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            Extract contract data and{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-primary bg-clip-text text-transparent">
              orchestrate automation
            </span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Renewal and opt-out date reminders and custom triggers so you never miss a key event —
            all inside the only platform designed as a Finance CRM.
          </p>
        </motion.div>

        {/* Pillars */}
        <div className="grid md:grid-cols-3 gap-5 mb-12">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={i + 1}
              className="rounded-xl border bg-card p-5 hover:shadow-md hover:border-indigo-300/60 transition-all"
            >
              <div className="h-10 w-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-3 dark:bg-indigo-950/40">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold mb-1.5">{p.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
            </motion.div>
          ))}
        </div>

        {/* Mock workspace preview */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={4}
          className="grid lg:grid-cols-5 gap-6 items-stretch"
        >
          {/* Left: extraction stream */}
          <div className="lg:col-span-3 rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-semibold">
                  Acme_MSA_v3.pdf · extracted
                </span>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">
                100% parsed
              </Badge>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              {[
                { k: "TCV", v: "$1.24M" },
                { k: "ARR", v: "$412K" },
                { k: "MRR", v: "$34.3K" },
                { k: "ACV", v: "$412K" },
                { k: "Term", v: "36 mo · auto-renew" },
                { k: "Notice window", v: "90 days pre-renewal" },
                { k: "Price escalator", v: "+5% yr 2 / +5% yr 3" },
                { k: "Payment terms", v: "Net 45" },
              ].map((row) => (
                <div
                  key={row.k}
                  className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2"
                >
                  <span className="text-muted-foreground">{row.k}</span>
                  <span className="font-semibold text-foreground">{row.v}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Performance obligations by service
              </p>
              <div className="space-y-2">
                {[
                  { name: "Platform license", pct: 62, amt: "$255K" },
                  { name: "Implementation", pct: 22, amt: "$92K" },
                  { name: "Premium support", pct: 16, amt: "$65K" },
                ].map((s) => (
                  <div key={s.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{s.name}</span>
                      <span className="text-muted-foreground">{s.amt}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-primary"
                        style={{ width: `${s.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: alerts + triggers */}
          <div className="lg:col-span-2 rounded-2xl border bg-card p-5 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-semibold">Custom triggers</span>
            </div>
            <ul className="space-y-3 text-sm flex-1">
              {[
                {
                  icon: CalendarClock,
                  label: "Non-renewal notice in 14 days",
                  meta: "Notify CSM + Finance · Acme",
                  tone: "amber",
                },
                {
                  icon: ShieldAlert,
                  label: "Liability cap < 1x ARR",
                  meta: "Flag for Legal review",
                  tone: "rose",
                },
                {
                  icon: Receipt,
                  label: "Milestone invoice due — Phase 2",
                  meta: "Auto-recapture in Recouply",
                  tone: "indigo",
                },
                {
                  icon: CheckCircle2,
                  label: "Backlog: $187K not due in next 60d",
                  meta: "Scheduled for outreach",
                  tone: "emerald",
                },
              ].map((t) => {
                const toneMap: Record<string, string> = {
                  amber: "bg-amber-100 text-amber-700",
                  rose: "bg-rose-100 text-rose-700",
                  indigo: "bg-indigo-100 text-indigo-700",
                  emerald: "bg-emerald-100 text-emerald-700",
                };
                return (
                  <li key={t.label} className="flex items-start gap-3">
                    <div
                      className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${toneMap[t.tone]}`}
                    >
                      <t.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium leading-tight">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.meta}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Button asChild className="mt-5 w-full bg-indigo-700 hover:bg-indigo-800">
              <Link to="/contracts">
                Explore Contract Intelligence
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
