import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, PlayCircle, ShieldCheck, Sparkles, FileText, Brain, LineChart, Receipt, Wallet, LayoutDashboard } from "lucide-react";

const pipelineSteps = [
  { icon: FileText, label: "Contract Uploaded" },
  { icon: Brain, label: "AI OCR + Term Extraction" },
  { icon: LineChart, label: "Revenue Metrics Calculated" },
  { icon: Receipt, label: "Invoices Linked" },
  { icon: Sparkles, label: "Collection Intelligence Activated" },
  { icon: Wallet, label: "Cash Captured" },
  { icon: LayoutDashboard, label: "Executive Dashboard Updated" },
];

export default function EnterpriseHero() {
  return (
    <section className="dark relative overflow-hidden bg-background text-foreground">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/20 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.06]" />
      </div>

      <div className="container relative mx-auto px-6 pt-28 pb-24 lg:pt-36 lg:pb-32">
        <div className="grid gap-16 lg:grid-cols-[1.05fr_1fr] lg:gap-12 items-center">
          {/* Left */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Revenue Intelligence Platform · Contract → Cash
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
              AI-powered Contract Intelligence and Collection Intelligence that transform
              commercial agreements into revenue insights — and customer activity into
              predictable cash flow.
            </motion.p>

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

          {/* Right — animated pipeline dashboard */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="relative"
          >
            <div className="relative rounded-2xl border border-border/60 bg-card/40 p-6 shadow-2xl shadow-primary/10 backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                  Live · Contract-to-Cash Pipeline
                </div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                  Recouply OS
                </span>
              </div>

              <ol className="relative space-y-2.5">
                <div className="absolute left-[19px] top-3 bottom-3 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-accent/40" />
                {pipelineSteps.map((s, i) => (
                  <motion.li
                    key={s.label}
                    initial={{ opacity: 0.4 }}
                    animate={{ opacity: [0.4, 1, 1, 0.5] }}
                    transition={{
                      duration: pipelineSteps.length * 1.2,
                      times: [
                        i / pipelineSteps.length,
                        (i + 0.15) / pipelineSteps.length,
                        (i + 0.85) / pipelineSteps.length,
                        (i + 1) / pipelineSteps.length,
                      ],
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="relative flex items-center gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2.5"
                  >
                    <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
                      <s.icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{s.label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Step {i + 1} of {pipelineSteps.length}
                      </div>
                    </div>
                    <motion.span
                      initial={{ width: "0%" }}
                      animate={{ width: ["0%", "100%", "100%", "0%"] }}
                      transition={{
                        duration: pipelineSteps.length * 1.2,
                        times: [
                          i / pipelineSteps.length,
                          (i + 0.15) / pipelineSteps.length,
                          (i + 0.85) / pipelineSteps.length,
                          (i + 1) / pipelineSteps.length,
                        ],
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-primary/10 to-accent/5 pointer-events-none"
                    />
                  </motion.li>
                ))}
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

            {/* floating glow cards */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -left-6 -bottom-6 hidden rounded-xl border border-border/60 bg-card/70 px-4 py-3 text-xs shadow-xl backdrop-blur md:block"
            >
              <div className="font-semibold">Renewal detected</div>
              <div className="text-muted-foreground">Acme Corp · 47 days</div>
            </motion.div>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-4 top-8 hidden rounded-xl border border-border/60 bg-card/70 px-4 py-3 text-xs shadow-xl backdrop-blur md:block"
            >
              <div className="font-semibold text-accent">+$284K expected</div>
              <div className="text-muted-foreground">Next 30 days</div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
