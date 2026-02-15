import { AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

const concerns = [
  "Incorrect balances",
  "Duplicate invoices",
  "Aging mismatches",
  'Incorrect status flags (Paid, Disputed, In Payment Plan)',
  "Inconsistent exports from source systems",
  "Data governance concerns",
];

const TrustBarrierSection = () => (
  <section className="py-20 px-4">
    <div className="container mx-auto max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
        <h2 className="text-3xl font-bold mb-4">Why Companies Hesitate to Sync Receivables Data</h2>
        <p className="text-muted-foreground text-lg mb-8">Finance teams often worry about:</p>

        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {concerns.map((c, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-xl border bg-card">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <span className="text-foreground">{c}</span>
            </div>
          ))}
        </div>

        <p className="text-foreground font-medium mb-2">These concerns are valid.</p>
        <p className="text-muted-foreground">
          Recouply.ai offers a structured approach before automation begins.
        </p>
      </motion.div>
    </div>
  </section>
);

export default TrustBarrierSection;
