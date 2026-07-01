import { motion } from "framer-motion";
import { FileText, ScanLine, Calculator, RefreshCw, ShieldAlert, GitBranch, CheckCircle2, ClipboardList } from "lucide-react";

const features = [
  { icon: ScanLine, title: "AI Smart OCR", body: "Ingest any PDF, scanned document, or drive folder — clean structured data in seconds." },
  { icon: Calculator, title: "Commercial Term Extraction", body: "ARR, MRR, ACV, TCV, Professional Services, billing schedules — extracted and reconciled." },
  { icon: RefreshCw, title: "Renewal Intelligence", body: "Notice-period detection, auto-renewal flags, opt-out reminders, custom triggers." },
  { icon: ShieldAlert, title: "Revenue Exposure", body: "Clause-level risk scoring across obligations, SLAs, and revenue commitments." },
  { icon: GitBranch, title: "Workflow Automation", body: "Task generation, approval routing, and cross-team handoffs from every clause." },
  { icon: CheckCircle2, title: "Confidence Scoring", body: "Every extracted field ships with a confidence score and editable AI result." },
];

export default function ContractIntelligenceSection() {
  return (
    <section className="relative bg-secondary/40 py-28">
      <div className="container mx-auto px-6">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.15fr] lg:gap-16 items-center">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Contract Intelligence</div>
            <h2 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
              Understand every commercial agreement.
            </h2>
            <p className="mt-5 text-lg text-muted-foreground">
              Turn every contract into structured revenue data — obligations, renewals, billing
              schedules, and exposure — before finance ever touches an invoice.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {features.map((f) => (
                <motion.div
                  key={f.title}
                  whileHover={{ y: -2 }}
                  className="rounded-xl border border-border/70 bg-card p-4 transition-shadow hover:shadow-md"
                >
                  <f.icon className="h-5 w-5 text-primary" />
                  <div className="mt-2 text-sm font-semibold">{f.title}</div>
                  <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.body}</div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Contract intelligence mock */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative rounded-2xl border border-border bg-card p-6 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Acme_MSA_2026.pdf</div>
                  <div className="text-xs text-muted-foreground">Extracted · 98% confidence</div>
                </div>
              </div>
              <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
                Auto-Renew
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                { k: "ARR", v: "$480,000" },
                { k: "TCV", v: "$1,440,000" },
                { k: "Term", v: "36 months" },
                { k: "Renewal", v: "Jan 14, 2027" },
                { k: "Notice Period", v: "90 days" },
                { k: "Payment", v: "Net 30" },
              ].map((r, i) => (
                <motion.div
                  key={r.k}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.05 * i }}
                  className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2.5"
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.k}</div>
                  <div className="mt-0.5 text-sm font-semibold">{r.v}</div>
                </motion.div>
              ))}
            </div>

            <div className="mt-5 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-start gap-2">
                <ClipboardList className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <div className="text-xs font-semibold">Task auto-generated</div>
                  <div className="text-xs text-muted-foreground">
                    Send opt-out reminder to Acme Corp — 90 days before Jan 14, 2027.
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
