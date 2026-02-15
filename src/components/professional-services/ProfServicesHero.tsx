import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { founderConfig } from "@/lib/founderConfig";

const ProfServicesHero = () => {
  const trackClick = () => {
    try {
      (window as any).gtag?.("event", "professional_services_click", { action: "request_data_review" });
    } catch {}
  };

  return (
    <section className="py-24 px-4 bg-gradient-to-b from-primary/5 to-background relative overflow-hidden">
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, hsl(var(--primary)) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="container mx-auto max-w-4xl text-center relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Badge variant="outline" className="mb-6 gap-2 px-4 py-1.5 text-sm border-primary/30">
            <Shield className="h-3.5 w-3.5" />
            Governance-First Onboarding
          </Badge>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Enterprise-Level Data Integrity.{" "}
            <span className="text-primary">Founder-Led Onboarding.</span>
          </h1>

          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            For companies that require full control and validation before importing receivables data.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="gap-2"
              onClick={() => {
                trackClick();
                window.open(founderConfig.calendly, "_blank");
              }}
            >
              Request Data Review
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-6 italic">
            Trusted onboarding for finance-led teams
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default ProfServicesHero;
