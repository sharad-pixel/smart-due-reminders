import { Brain, Mail, Zap, CheckCircle, TrendingUp, Shield } from "lucide-react";
import { motion } from "framer-motion";

const differentiators = [
  { icon: Brain, title: "Autonomous Account Intelligence", description: "AI agents synthesize payment history, communication patterns, and risk signals into real-time decisions — not just dashboards" },
  { icon: Mail, title: "Agentic Communication Layer", description: "Agents read, understand, and respond to debtor emails with context-aware drafts — escalating only when human judgment is needed" },
  { icon: Zap, title: "Self-Optimizing Workflows", description: "Every collection outcome feeds back into the system — agents learn which strategies recover revenue fastest" },
  { icon: CheckCircle, title: "Revenue Risk Assessment Engine", description: "Continuous ECL scoring, Paydex-style ratings, and engagement-adjusted PD modeling across your entire portfolio" },
  { icon: TrendingUp, title: "Compounding Intelligence", description: "Each touchpoint makes every agent smarter — risk predictions sharpen, timing improves, recovery rates climb" },
  { icon: Shield, title: "Predictive Risk Orchestration", description: "Agents flag at-risk accounts before humans notice — triggering proactive outreach before revenue is lost" },
];

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.1, duration: 0.4, ease: "easeOut" },
  }),
};

const WhyDifferent = () => {
  return (
    <section className="py-24 px-4 bg-background">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-block px-4 py-1 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-4">
            Agentic Revenue Intelligence
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            AI Agents That Think, Act & Learn
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Not just automation — agentic AI that autonomously orchestrates revenue recovery with human-controlled guardrails
          </p>
          <p className="text-sm text-muted-foreground/80 max-w-xl mx-auto mt-3">
            Your single source of truth for all revenue recovery activity
          </p>
          
          <motion.div
            className="mt-8 max-w-3xl mx-auto bg-muted/30 rounded-2xl p-6 border border-border/50"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <p className="text-muted-foreground">
              Recouply.ai deploys autonomous AI agents as your always-on revenue recovery team — every action, message, and outcome is orchestrated, tracked, and optimized in one centralized system.
            </p>
            <p className="text-sm text-muted-foreground/80 mt-3 font-medium">
              No handoffs. No scattered inboxes. No lost context. Just agents recovering revenue.
            </p>
          </motion.div>
        </motion.div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {differentiators.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={idx}
                custom={idx}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={itemVariants}
                whileHover={{ x: 6 }}
                className="flex gap-4 group cursor-default"
              >
                <div className="flex-shrink-0">
                  <motion.div
                    className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center"
                    whileHover={{ scale: 1.15, rotate: -5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <Icon className="h-6 w-6 text-primary" />
                  </motion.div>
                </div>
                <div>
                  <h4 className="font-semibold mb-1 group-hover:text-primary transition-colors">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhyDifferent;
