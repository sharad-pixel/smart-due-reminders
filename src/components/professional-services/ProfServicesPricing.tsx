import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { founderConfig } from "@/lib/founderConfig";

const includes = [
  "Data review sessions",
  "Validation checklist",
  "Controlled import configuration",
  "Go-live validation",
];

const ProfServicesPricing = () => {
  const trackClick = () => {
    try {
      (window as any).gtag?.("event", "professional_services_click", { action: "schedule_consultation" });
    } catch {}
  };

  return (
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-3xl text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <h2 className="text-3xl font-bold mb-2">Data Vetting & Onboarding Package</h2>
          <Badge variant="outline" className="mb-8">Flat-Fee Engagement</Badge>

          <div className="rounded-2xl border bg-card p-8 md:p-12 mb-8">
            <p className="text-5xl font-bold text-primary mb-2">$2,500</p>
            <p className="text-muted-foreground mb-8">Starting price · Custom pricing based on invoice volume and complexity</p>

            <div className="grid sm:grid-cols-2 gap-3 text-left max-w-md mx-auto mb-8">
              {includes.map((item, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>

            <Button
              size="lg"
              className="gap-2"
              onClick={() => {
                trackClick();
                window.open(founderConfig.calendly, "_blank");
              }}
            >
              Schedule Consultation
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground italic">
            Trusted onboarding for finance-led teams
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default ProfServicesPricing;
