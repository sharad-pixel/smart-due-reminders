import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const checkpoints = [
  "Export only what you choose",
  "Validate balances and aging",
  "Remove duplicates",
  "Confirm invoice status accuracy",
  "Approve a clean import file",
];

const DataVettingBadge = () => {
  const navigate = useNavigate();

  return (
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 p-8 md:p-12"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold">
              Don't Trust Your Data Yet? We'll Help You Vet It First.
            </h2>
          </div>

          <p className="text-muted-foreground text-lg mb-4 max-w-3xl">
            Before syncing accounting data into any new platform, finance teams want confidence. 
            Recouply.ai offers structured onboarding and data vetting services to ensure only clean, 
            approved, and validated invoice data enters the system.
          </p>

          <p className="text-foreground font-medium mb-6">
            You stay in control of what gets uploaded.
          </p>

          <div className="grid sm:grid-cols-2 gap-3 mb-8">
            {checkpoints.map((item, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground italic mb-8">
            Founder-led oversight available.
          </p>

          <Button
            size="lg"
            onClick={() => {
              navigate("/professional-services");
            }}
            className="gap-2"
          >
            Learn About Data Vetting Services
            <ArrowRight className="h-4 w-4" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default DataVettingBadge;
