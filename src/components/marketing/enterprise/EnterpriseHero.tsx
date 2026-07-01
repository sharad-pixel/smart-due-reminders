import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight, PlayCircle, ShieldCheck, Sparkles, FileText, Brain, LineChart, Receipt, Wallet, LayoutDashboard, Check } from "lucide-react";

const pipelineSteps = [
  { icon: FileText, label: "Contract ingested", detail: "PDF, email, or Drive" },
  { icon: Brain, label: "AI extracts terms", detail: "ARR, MRR, renewal, notice" },
  { icon: LineChart, label: "Revenue booked", detail: "ASC 606 aligned" },
  { icon: Receipt, label: "Invoice issued", detail: "Branded, portal-linked" },
  { icon: Sparkles, label: "Collections activated", detail: "AI prioritized outreach" },
  { icon: Wallet, label: "Cash captured", detail: "Reconciled to invoice" },
  { icon: LayoutDashboard, label: "Executive insight", detail: "Forecast updated" },
];

const lifecycleStages = [
  { label: "Contract", accent: "primary" },
  { label: "Revenue", accent: "primary" },
  { label: "Invoice", accent: "primary" },
  { label: "Collections", accent: "accent" },
  { label: "Cash", accent: "accent" },
];

export default function EnterpriseHero() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveStep((s) => (s + 1) % pipelineSteps.length);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="dark relative overflow-hidden bg-background text-foreground">
      {/* ambient background — softened */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-primary/10 blur-[160px]" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-accent/[0.06] blur-[140px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.04]" />
      </div>

      <div className="container relative mx-auto px-6 pt-28 pb-24 lg:pt-36 lg:pb-32">
        <div className="grid gap-16 lg:grid-cols-[1.05fr_1fr] lg:gap-12 items-center">
          {/* Left */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Revenue Intelligence — from contract to cash
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05 }}
              className="mt-6 text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl leading-[1.02]"
            >
              Know what you sold.
              <br />
              <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                Know what you'll collect.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed"
            >
              Revenue Intelligence, from contract to cash. AI-native Contract Intelligence
              and Collection Intelligence — one system that reads every clause, tracks every
              obligation, and turns every receivable into predictable cash.
            </motion.p>

            {/* Contract → Cash lifecycle strip */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-7 rounded-xl border border-border/50 bg-card/30 px-4 py-3 backdrop-blur"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-2.5">
                The Contract-to-Cash lifecycle
              </div>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm">
                {lifecycleStages.map((stage, i) => (
                  <div key={stage.label} className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-medium ${
                        stage.accent === "accent"
                          ? "border-accent/30 bg-accent/5 text-accent"
                          : "border-primary/30 bg-primary/5 text-primary"
                      }`}
                    >
                      {stage.label}
                    </span>
                    {i < lifecycleStages.length - 1 && (
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">
                One system of record from the day a contract is signed to the day cash clears — with AI reasoning across every stage.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link
                to="/contact-us?topic=enterprise-demo"
                className="group inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:shadow-primary/40"
              >
                Book Enterprise Demo
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/demo"
                className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-5 py-3 text-sm font-semibold text-foreground backdrop-blur transition hover:bg-card/70"
              >
                <PlayCircle className="h-4 w-4" />
                Watch Product Tour
              </Link>
            </motion.div>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-10 grid gap-3 sm:grid-cols-3 text-sm text-muted-foreground"
            >
              {[
                { icon: Brain, label: "AI Smart Contract Ingestion" },
                { icon: Sparkles, label: "AI Collection Intelligence" },
                { icon: ShieldCheck, label: "Enterprise Security" },
              ].map((t) => (
                <li key={t.label} className="flex items-center gap-2">
                  <t.icon className="h-4 w-4 text-primary" />
                  {t.label}
                </li>
              ))}
            </motion.ul>
          </div>

          {/* Right — Contract-to-Cash pipeline (lightened) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative"
          >
            <div className="relative rounded-2xl border border-border/60 bg-card/40 p-6 shadow-2xl shadow-primary/5 backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  Live · Contract-to-Cash Pipeline
                </div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                  Recouply OS
                </span>
              </div>

              <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
                Every signed agreement enters the same pipeline — ingested, priced, invoiced, collected, and reported — with an auditable trail at every step.
              </p>

              <ol className="relative space-y-2">
                <div className="absolute left-[19px] top-3 bottom-3 w-px bg-gradient-to-b from-primary/30 via-primary/10 to-accent/20" />
                {pipelineSteps.map((s, i) => {
                  const isActive = i === activeStep;
                  const isDone = i < activeStep;
                  return (
                    <li
                      key={s.label}
                      className={`relative flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors duration-500 ${
                        isActive
                          ? "border-primary/40 bg-primary/[0.06]"
                          : "border-border/40 bg-background/30"
                      }`}
                    >
                      <span
                        className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-500 ${
                          isActive
                            ? "bg-primary/20 text-primary"
                            : isDone
                            ? "bg-accent/15 text-accent"
                            : "bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        {isDone ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium transition-colors ${isActive || isDone ? "text-foreground" : "text-foreground/70"}`}>
                          {s.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">{s.detail}</div>
                      </div>
                      {isActive && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.4 }}
                          className="text-[10px] font-semibold uppercase tracking-wider text-primary"
                        >
                          Active
                        </motion.span>
                      )}
                    </li>
                  );
                })}
              </ol>

              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border/40 pt-4 text-center">
                {[
                  { k: "ARR Under Mgmt", v: "$142M" },
                  { k: "DSO", v: "-47%" },
                  { k: "Auto Actions", v: "12,480" },
                ].map((m) => (
                  <div key={m.k}>
                    <div className="text-lg font-semibold">{m.v}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.k}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* floating glow cards — gentler */}
            <div className="absolute -left-6 -bottom-6 hidden rounded-xl border border-border/60 bg-card/70 px-4 py-3 text-xs shadow-xl backdrop-blur md:block">
              <div className="font-semibold">Renewal detected</div>
              <div className="text-muted-foreground">Acme Corp · 47 days</div>
            </div>
            <div className="absolute -right-4 top-8 hidden rounded-xl border border-border/60 bg-card/70 px-4 py-3 text-xs shadow-xl backdrop-blur md:block">
              <div className="font-semibold text-accent">+$284K expected</div>
              <div className="text-muted-foreground">Next 30 days</div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
