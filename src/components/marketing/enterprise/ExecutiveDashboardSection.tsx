import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const widgets = [
  { k: "Expected Cash · 30d", v: "$4.2M", trend: "+12%" },
  { k: "Revenue at Risk", v: "$382K", trend: "-8%", accent: true },
  { k: "Renewals · 90d", v: "27", trend: "$3.1M ARR" },
  { k: "Customer Health", v: "92", trend: "+3 pts" },
  { k: "Open Invoices", v: "1,284", trend: "$8.9M" },
  { k: "DSO", v: "38 days", trend: "-14 days" },
  { k: "ARR", v: "$142M", trend: "+18% YoY" },
  { k: "Collection Rate", v: "96.4%", trend: "+2.1%" },
];

function Sparkline({ tone = "primary" }: { tone?: "primary" | "accent" }) {
  const points = "0,20 15,14 30,17 45,10 60,12 75,6 90,9 105,4 120,2";
  return (
    <svg viewBox="0 0 120 24" className="mt-3 h-10 w-full">
      <defs>
        <linearGradient id={`g-${tone}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={tone === "accent" ? "hsl(var(--accent))" : "hsl(var(--primary))"} stopOpacity="0.35" />
          <stop offset="100%" stopColor={tone === "accent" ? "hsl(var(--accent))" : "hsl(var(--primary))"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={tone === "accent" ? "hsl(var(--accent))" : "hsl(var(--primary))"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <polygon fill={`url(#g-${tone})`} points={`${points} 120,24 0,24`} />
    </svg>
  );
}

function BarChart() {
  const bars = [40, 65, 48, 72, 55, 80, 68, 90, 74, 88, 96, 82];
  return (
    <div className="mt-2 flex items-end gap-1.5 h-24">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          whileInView={{ height: `${h}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: i * 0.04 }}
          className="flex-1 rounded-sm bg-gradient-to-t from-primary/60 to-primary"
        />
      ))}
    </div>
  );
}

export default function ExecutiveDashboardSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="dark relative overflow-hidden bg-background py-28 text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/3 h-[500px] w-[700px] rounded-full bg-primary/15 blur-[140px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.05]" />
      </div>

      <div className="container relative mx-auto px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Executive Revenue Intelligence</div>
          <h2 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]">
            One command center for revenue.
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Cash, risk, renewals, and health — synthesized in real time from contracts, invoices,
            and every customer interaction.
          </p>
        </div>

        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="mt-14 rounded-3xl border border-border/60 bg-card/40 p-6 shadow-2xl shadow-primary/10 backdrop-blur-xl"
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Revenue Operating Dashboard</div>
              <div className="text-xs text-muted-foreground">Live · Updated 2s ago</div>
            </div>
            <div className="flex gap-2">
              {["Q3 · 2026", "All Entities", "USD"].map((c) => (
                <span key={c} className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-[10px] text-muted-foreground">
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {widgets.map((w, i) => (
              <motion.div
                key={w.k}
                initial={{ opacity: 0, y: 10 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="rounded-xl border border-border/50 bg-background/40 p-4"
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{w.k}</div>
                <div className="mt-1 flex items-baseline justify-between">
                  <div className="text-xl font-semibold">{w.v}</div>
                  <div className={`text-[10px] font-medium ${w.accent ? "text-destructive" : "text-accent"}`}>
                    {w.trend}
                  </div>
                </div>
                <Sparkline tone={w.accent ? "accent" : "primary"} />
              </motion.div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-border/50 bg-background/40 p-4 lg:col-span-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Cash Forecast · Next 12 Weeks
                </div>
                <div className="text-xs text-accent">+18% vs plan</div>
              </div>
              <BarChart />
            </div>
            <div className="rounded-xl border border-border/50 bg-background/40 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Aging Buckets
              </div>
              <div className="mt-3 space-y-2">
                {[
                  { k: "Current", v: 62, c: "bg-accent" },
                  { k: "1–30", v: 22, c: "bg-primary" },
                  { k: "31–60", v: 10, c: "bg-warning" },
                  { k: "61+", v: 6, c: "bg-destructive" },
                ].map((b) => (
                  <div key={b.k}>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{b.k}</span>
                      <span className="font-medium">{b.v}%</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-border/50 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={inView ? { width: `${b.v}%` } : {}}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className={`h-full ${b.c}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
