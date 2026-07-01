import { motion } from "framer-motion";
import { AlertTriangle, TrendingUp, Calendar, FileWarning, Clock, Sparkles, Target, FileCheck2 } from "lucide-react";

const recs = [
  { icon: AlertTriangle, tone: "destructive", title: "Customer payment risk increased", body: "Globex — risk score rose from 42 to 71 after missed reminder engagement." },
  { icon: Calendar, tone: "primary", title: "Contract renews in 47 days", body: "Acme Corp · $480K ARR · notice period expires Oct 26." },
  { icon: FileCheck2, tone: "accent", title: "Professional Services nearing completion", body: "Northwind PS engagement 92% delivered — trigger final invoice." },
  { icon: FileWarning, tone: "warning", title: "Revenue obligation requires approval", body: "Umbrella Inc. custom pricing amendment ready for CFO sign-off." },
  { icon: Clock, tone: "primary", title: "Customer likely to pay 12 days late", body: "Contoso — model predicts DPD 42 based on last 6 invoices." },
  { icon: TrendingUp, tone: "accent", title: "Expansion opportunity identified", body: "Initech usage +180% — expansion likelihood 87%." },
  { icon: Sparkles, tone: "primary", title: "Aging trend detected", body: "31–60 bucket +8% WoW across mid-market segment." },
  { icon: Target, tone: "warning", title: "Contract missing billing schedule", body: "3 signed agreements missing structured billing — invoice risk." },
];

const toneMap: Record<string, string> = {
  primary: "text-primary bg-primary/10 border-primary/30",
  accent: "text-accent bg-accent/10 border-accent/30",
  destructive: "text-destructive bg-destructive/10 border-destructive/30",
  warning: "text-warning bg-warning/10 border-warning/30",
};

export default function AIRecommendationsSection() {
  return (
    <section className="relative bg-secondary/40 py-28">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">AI Intelligence</div>
          <h2 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            AI that understands revenue.
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Not chatbots. Not templates. Purpose-built agents that read your contracts, watch your
            AR, and surface the actions that move cash.
          </p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {recs.map((r, i) => (
            <motion.div
              key={r.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              whileHover={{ y: -4 }}
              className="group relative rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-xl"
            >
              <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${toneMap[r.tone]}`}>
                <r.icon className="h-4 w-4" />
              </div>
              <div className="mt-3 text-sm font-semibold leading-snug">{r.title}</div>
              <div className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{r.body}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
