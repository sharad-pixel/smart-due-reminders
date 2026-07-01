import { motion } from "framer-motion";
import {
  FileSignature,
  ShieldCheck,
  Gauge,
  Radar,
  Wallet,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

const pipeline = [
  {
    icon: FileSignature,
    title: "Every contract ingested",
    detail: "OCR + AI extraction of price, term, ramps, PS, renewals, notice, credit terms.",
  },
  {
    icon: Gauge,
    title: "Collectability scored",
    detail: "Each obligation gets a Collectability Score using terms, history, and risk signals.",
  },
  {
    icon: Radar,
    title: "Risk monitored",
    detail: "Missed milestones, aging, dispute signals, and payment behavior trigger alerts.",
  },
  {
    icon: Wallet,
    title: "Cash intelligently recovered",
    detail: "AI Collection agents run prioritized, on-brand outreach with human approval.",
  },
];

const guarantees = [
  "Every clause, price, and payment term captured — no revenue leakage from missed language",
  "Every invoice mapped back to its contract obligation — full ASC 606 audit trail",
  "Every account scored for collectability — before it becomes a bad-debt surprise",
  "Every overdue dollar worked by an AI agent — with human oversight at every decision",
];

export default function CollectabilityAssuranceSection() {
  return (
    <section className="relative bg-gradient-to-b from-background via-primary/[0.03] to-background py-28">
      <div className="absolute inset-0 -z-10 opacity-40 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.12),transparent_55%),radial-gradient(circle_at_80%_80%,hsl(var(--accent)/0.12),transparent_55%)]" />

      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> Collectability Assurance
          </div>
          <h2 className="mt-5 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            Every contract gets a
            <br />
            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              collectability guarantee.
            </span>
          </h2>
          <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
            Contract-to-Cash Intelligence links every clause to every cash outcome. Contract
            Intelligence reads the terms. Collection Intelligence works the receivable. In
            between, a live Collectability Score ensures no obligation slips through unmonitored.
          </p>
        </div>

        {/* Pipeline */}
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pipeline.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="relative rounded-2xl border border-border/60 bg-card/70 p-5 backdrop-blur"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Step {i + 1}
                </div>
                <h3 className="mt-1 text-base font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  {step.detail}
                </p>
                {i < pipeline.length - 1 && (
                  <ArrowRight className="hidden lg:block absolute top-1/2 -right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Guarantee card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-14 mx-auto max-w-4xl rounded-2xl border border-primary/30 bg-card/80 p-8 shadow-[0_20px_60px_-30px_hsl(var(--primary)/0.4)] backdrop-blur"
        >
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <h3 className="text-lg font-semibold">
              The Recouply Collectability Assurance
            </h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Four commitments we make on every contract that enters the platform:
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {guarantees.map((g) => (
              <li key={g} className="flex items-start gap-2.5 text-sm">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-accent shrink-0" />
                <span className="text-foreground/90">{g}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
