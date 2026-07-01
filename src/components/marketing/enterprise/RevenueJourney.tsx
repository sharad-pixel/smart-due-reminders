import { motion } from "framer-motion";
import { FileText, Brain, Receipt, Sparkles, Wallet, LayoutDashboard } from "lucide-react";

const stops = [
  { icon: FileText, label: "Contract", sub: "Signed agreement" },
  { icon: Brain, label: "Revenue Intelligence", sub: "Terms · ARR · Renewals" },
  { icon: Receipt, label: "Invoice", sub: "Auto-generated" },
  { icon: Sparkles, label: "Collection Intelligence", sub: "AI-prioritized" },
  { icon: Wallet, label: "Cash", sub: "Captured & reconciled" },
  { icon: LayoutDashboard, label: "Executive Insights", sub: "Forecast · Risk · DSO" },
];

export default function RevenueJourney() {
  return (
    <section className="relative bg-background py-28">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The Revenue Lifecycle</div>
          <h2 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]">
            Every dollar starts with a <span className="text-primary">contract</span>.
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Recouply is the connective intelligence between what you sold and what you'll collect —
            one platform, one source of truth, from signature to cash.
          </p>
        </div>

        <div className="mt-16 relative">
          {/* connector line */}
          <div className="absolute left-0 right-0 top-8 hidden lg:block">
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>

          <div className="grid gap-6 lg:grid-cols-6">
            {stops.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="relative"
              >
                <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
                  <s.icon className="h-6 w-6 text-primary" />
                  <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                </div>
                <div className="mt-4 text-center">
                  <div className="text-sm font-semibold">{s.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.sub}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
