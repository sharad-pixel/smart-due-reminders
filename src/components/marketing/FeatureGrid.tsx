import { Card, CardContent } from "@/components/ui/card";
import { Users, Mail, Target, AlertTriangle, DollarSign, Clock, BarChart3, Brain } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  { icon: Brain, title: "AI-Powered Collections Workflows", description: "6 specialized AI agents orchestrate follow-ups, escalations, and negotiations — all tracked in your CRM", micro: "Consistent execution, zero manual effort on repeatable tasks" },
  { icon: Mail, title: "Intelligent Email Triage", description: "AI reads inbound replies, detects intent, and drafts context-aware responses", micro: "Dispute? Payment promise? Your agents already know" },
  { icon: Target, title: "Risk-Based Prioritization", description: "Real-time collectability scores powered by payment behavior and engagement signals", micro: "ASC 326 / IFRS 9 aligned ECL calculations" },
  { icon: AlertTriangle, title: "Predictive Early Warnings", description: "AI surfaces at-risk accounts before payments age — proactive, not reactive", micro: "Engagement-adjusted probability of default modeling" },
  { icon: DollarSign, title: "AI Payment Negotiation", description: "Agent-led payment plan proposals with human approval gates at every step", micro: "Automated settlement offers calibrated to risk tier" },
  { icon: Clock, title: "Risk-Aware Escalation Engine", description: "AI-powered collections workflows that adapt timing to customer behavior and risk tier", micro: "From friendly reminder to final notice — systematically" },
  { icon: BarChart3, title: "Centralized AR Dashboard", description: "Real-time portfolio health, DSO trends, and AI-generated action items — your single source of truth", micro: "One view of your entire collections pipeline" },
  { icon: Users, title: "Complete Audit Trail", description: "Full history of every agent action, decision, outreach, and outcome — your system of record", micro: "Full governance, compliance, and accountability" },
];

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" },
  }),
};

const FeatureGrid = () => {
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
          <div className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            Collections & Risk CRM
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            AI-Powered Collections Workflows That Drive Cash Outcomes
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Six specialized AI agents orchestrate every stage of collections — from first reminder to final resolution, with a complete audit trail
          </p>
          <p className="text-sm text-muted-foreground/80 max-w-xl mx-auto mt-3">
            Human oversight at every decision point. AI-powered execution on every repeatable workflow.
          </p>
        </motion.div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={idx}
                custom={idx}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={cardVariants}
              >
                <Card className="bg-card hover:shadow-xl transition-all duration-300 hover:border-primary/30 group h-full hover:-translate-y-1">
                  <CardContent className="p-6">
                    <motion.div
                      className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                      whileHover={{ scale: 1.15, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <Icon className="h-6 w-6 text-primary" />
                    </motion.div>
                    <h4 className="font-semibold mb-2 group-hover:text-primary transition-colors">{feature.title}</h4>
                    <p className="text-sm text-muted-foreground mb-2">{feature.description}</p>
                    <p className="text-xs text-primary/70 font-medium">{feature.micro}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeatureGrid;
