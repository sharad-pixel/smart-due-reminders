import { motion, useInView, animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";

function Counter({ to, suffix = "", prefix = "" }: { to: number; suffix?: string; prefix?: string }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration: 1.6,
      ease: "easeOut",
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [inView, to]);

  return (
    <span ref={ref}>
      {prefix}
      {Math.round(value).toLocaleString()}
      {suffix}
    </span>
  );
}

const metrics = [
  { value: 47, suffix: "%", label: "Lower DSO" },
  { value: 81, suffix: "%", label: "Less Manual Collections" },
  { value: 98, suffix: "%", label: "Invoice Visibility" },
  { value: 94, suffix: "%", label: "Reduction in Manual Follow-up" },
];

export default function CustomerResultsMetrics() {
  return (
    <section className="relative bg-background py-28">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Results</div>
          <h2 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            Measurable revenue outcomes.
          </h2>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm"
            >
              <div className="text-5xl sm:text-6xl font-semibold tracking-tight bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent">
                <Counter to={m.value} suffix={m.suffix} />
              </div>
              <div className="mt-3 text-sm font-medium text-muted-foreground">{m.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-card to-accent/5 p-8 text-center">
          <div className="text-3xl sm:text-4xl font-semibold">Millions in revenue protected.</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Across SaaS, professional services, and enterprise finance teams.
          </div>
        </div>
      </div>
    </section>
  );
}
