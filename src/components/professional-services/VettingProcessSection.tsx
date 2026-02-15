import { motion } from "framer-motion";
import { FileSearch, Filter, ShieldCheck, CheckSquare, BarChart3 } from "lucide-react";

const steps = [
  {
    icon: FileSearch,
    title: "Source System Review",
    desc: "Review Stripe, QuickBooks, NetSuite, or custom exports.",
  },
  {
    icon: Filter,
    title: "Controlled Export",
    desc: "Define the exact fields and filters for invoice extraction.",
  },
  {
    icon: ShieldCheck,
    title: "Data Validation",
    desc: "Invoice IDs · Status consistency · Aging calculations · Balance reconciliation · Duplicate detection",
  },
  {
    icon: CheckSquare,
    title: "Clean Import Approval",
    desc: "Approve a vetted dataset before loading into Recouply.",
  },
  {
    icon: BarChart3,
    title: "Go-Live Validation",
    desc: "Post-import review and confirmation of totals.",
  },
];

const VettingProcessSection = () => (
  <section className="py-20 px-4 bg-card/50">
    <div className="container mx-auto max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
        <h2 className="text-3xl font-bold mb-12 text-center">Our Controlled Data Onboarding Framework</h2>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-primary/20 hidden md:block" />

          <div className="space-y-8">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="flex items-start gap-6"
              >
                <div className="relative z-10 flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="pt-1">
                  <p className="text-xs font-semibold text-primary mb-1 uppercase tracking-wider">Step {i + 1}</p>
                  <h3 className="text-lg font-bold mb-1">{step.title}</h3>
                  <p className="text-muted-foreground">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);

export default VettingProcessSection;
