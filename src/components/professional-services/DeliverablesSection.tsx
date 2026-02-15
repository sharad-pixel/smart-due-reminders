import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

const deliverables = [
  "Clean, approved import file",
  "Structured invoice categorization",
  "Verified aging accuracy",
  "Status integrity validation",
  "Reconciliation summary",
  "Governance recommendations",
];

const DeliverablesSection = () => (
  <section className="py-20 px-4 bg-card/50">
    <div className="container mx-auto max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
        <h2 className="text-3xl font-bold mb-8 text-center">What You Receive</h2>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {deliverables.map((d, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-3 p-4 rounded-xl border bg-background"
            >
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="text-sm font-medium">{d}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  </section>
);

export default DeliverablesSection;
