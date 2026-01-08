import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { PLAN_CONFIGS, INVOICE_PRICING, SEAT_PRICING, formatPrice } from "@/lib/subscriptionConfig";

// Use centralized pricing config
const plans = [
  { nameKey: "pricing.starter", price: PLAN_CONFIGS.starter.monthlyPrice, invoices: "100", highlight: false },
  { nameKey: "pricing.growth", price: PLAN_CONFIGS.growth.monthlyPrice, invoices: "300", highlight: true },
  { nameKey: "pricing.professional", price: PLAN_CONFIGS.professional.monthlyPrice, invoices: "500", highlight: false },
];

const PricingTeaser = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-24 px-4 bg-gradient-to-b from-background to-muted/20 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto max-w-5xl relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            <Sparkles className="h-4 w-4" />
            {t("pricing.badge")}
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            {t("pricing.title")}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            {t("pricing.subtitle", { price: PLAN_CONFIGS.starter.monthlyPrice })}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan, index) => (
            <div
              key={plan.nameKey}
              className={`transition-all duration-700 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              <div className={`relative bg-card rounded-2xl border p-6 h-full ${
                plan.highlight 
                  ? "border-primary/50 shadow-xl shadow-primary/10" 
                  : "border-border/50 shadow-lg"
              }`}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                      {t("pricing.mostPopular")}
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold mb-2">{t(plan.nameKey)}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">{t("pricing.perMonth")}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t("pricing.upToInvoices")} {plan.invoices}
                  </p>
                </div>

                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-accent flex-shrink-0" />
                    {t("pricing.allAgents")}
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-accent flex-shrink-0" />
                    {t("pricing.automatedFollowups")}
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-accent flex-shrink-0" />
                    {t("pricing.emailResponses")}
                  </li>
                </ul>

                <Button 
                  variant={plan.highlight ? "default" : "outline"} 
                  className="w-full"
                  onClick={() => navigate("/pricing")}
                >
                  {t("common.getStarted")}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground mb-4">
            {t("pricing.perInvoice")}: <span className="font-semibold">{formatPrice(INVOICE_PRICING.perInvoice, { showCents: true })}</span> | {t("pricing.additionalUsers")}: <span className="font-semibold">{formatPrice(SEAT_PRICING.monthlyPrice)}/{t("pricing.userMonth")}</span>
          </p>
          <Button variant="ghost" onClick={() => navigate("/pricing")} className="group">
            {t("common.viewPricing")}
            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default PricingTeaser;
