import { motion } from "framer-motion";
import { CheckCircle2, User } from "lucide-react";
import { founderConfig } from "@/lib/founderConfig";

const services = [
  "Direct dataset review",
  "Best-practice recommendations",
  "Field mapping validation",
  "Risk exposure analysis",
  "Governance guidance",
];

const FounderOversightSection = () => (
  <section className="py-20 px-4">
    <div className="container mx-auto max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-3xl font-bold">Founder-Led Onboarding & Data Governance</h2>
        </div>

        <p className="text-muted-foreground text-lg mb-2">
          {founderConfig.name}, {founderConfig.title} of {founderConfig.company}, brings {founderConfig.yearsExperience} years of receivables and operational experience.
        </p>
        <p className="text-foreground font-medium mb-8">Professional Services engagements include:</p>

        <div className="grid sm:grid-cols-2 gap-3 mb-8">
          {services.map((s, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
              <span>{s}</span>
            </div>
          ))}
        </div>

        <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-4">
          This is structured onboarding — not generic support.
        </p>
      </motion.div>
    </div>
  </section>
);

export default FounderOversightSection;
