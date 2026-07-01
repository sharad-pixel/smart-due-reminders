import { motion } from "framer-motion";
import { Building2, TrendingUp, MessageSquare, AlertCircle, CheckCircle2, Clock } from "lucide-react";

const timeline = [
  { icon: MessageSquare, label: "AI reminder sent", time: "2 days ago", cls: "text-primary bg-primary/10" },
  { icon: CheckCircle2, label: "Promise to pay logged", time: "1 day ago", cls: "text-accent bg-accent/10" },
  { icon: Clock, label: "Payment due Nov 12", time: "in 3 days", cls: "text-muted-foreground bg-muted" },
];

const stages = ["Healthy", "At Risk", "Overdue", "Escalation", "Recovered"];

export default function CollectionIntelligenceSection() {
  return (
    <section className="relative bg-background py-28">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Collection Intelligence</div>
          <h2 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            Recover revenue intelligently.
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            One unified profile per customer — contracts, invoices, payment history, promises,
            risk, and AI recommendations. Every action prioritized. Every outreach on-brand.
          </p>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          {/* Customer 360 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-2xl border border-border bg-card p-6 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Northwind Systems</div>
                  <div className="text-xs text-muted-foreground">Enterprise · 4 contracts · 12 open invoices</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Risk Score</div>
                <div className="text-lg font-semibold text-accent">78 / 100</div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-4 gap-3">
              {[
                { k: "Open AR", v: "$284K" },
                { k: "Expected 30d", v: "$212K" },
                { k: "DPD Avg", v: "18d" },
                { k: "Health", v: "Improving" },
              ].map((s) => (
                <div key={s.k} className="rounded-lg border border-border/60 bg-secondary/40 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.k}</div>
                  <div className="mt-0.5 text-sm font-semibold">{s.v}</div>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Activity Timeline
              </div>
              <div className="space-y-2">
                {timeline.map((t, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-background px-3 py-2.5"
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-md ${t.cls}`}>
                      <t.icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1 text-sm">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.time}</div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 text-primary" />
                <div className="text-xs">
                  <span className="font-semibold">AI Recommendation:</span>{" "}
                  <span className="text-muted-foreground">
                    Send CFO-tier reminder with payment plan option. Northwind pays 92% faster when offered installments.
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Workflow stages */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold">Collection Workflow</div>
                <div className="text-xs text-muted-foreground">Live</div>
              </div>
              <div className="space-y-2">
                {stages.map((stage, i) => (
                  <motion.div
                    key={stage}
                    initial={{ opacity: 0.5 }}
                    animate={{ opacity: [0.5, 1, 0.6] }}
                    transition={{
                      duration: stages.length * 1.1,
                      times: [i / stages.length, (i + 0.4) / stages.length, (i + 1) / stages.length],
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2.5"
                  >
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <div className="flex-1 text-sm font-medium">{stage}</div>
                    <div className="text-xs text-muted-foreground">
                      {Math.round(120 / (i + 1))} accounts
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-accent/5 p-6">
              <div className="text-sm font-semibold">On-brand outreach at scale</div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Reminders, escalations, and payment plans generated in your voice — approved by
                humans, sent by AI. Every message logged for audit and compliance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
