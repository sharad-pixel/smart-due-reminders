import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { PLAN_CONFIGS, CREDIT_PRICING, LIVE_CONTRACTS_PRICING, SEAT_PRICING, formatPrice } from "@/lib/subscriptionConfig";

// Credit-economy plans (Launch shown via "See all plans" link)
const plans = [
  {
    name: PLAN_CONFIGS.starter.displayName,
    price: PLAN_CONFIGS.starter.monthlyPrice,
    credits: PLAN_CONFIGS.starter.creditAllotment,
    contracts: PLAN_CONFIGS.starter.includedContracts,
    highlight: false,
  },
  {
    name: PLAN_CONFIGS.growth.displayName,
    price: PLAN_CONFIGS.growth.monthlyPrice,
    credits: PLAN_CONFIGS.growth.creditAllotment,
    contracts: PLAN_CONFIGS.growth.includedContracts,
    highlight: true,
  },
  {
    name: PLAN_CONFIGS.professional.displayName,
    price: PLAN_CONFIGS.professional.monthlyPrice,
    credits: PLAN_CONFIGS.professional.creditAllotment,
    contracts: PLAN_CONFIGS.professional.includedContracts,
    highlight: false,
  },
];

const PricingTeaser = () => {
  const navigate = useNavigate();
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
            Simple Pricing
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Revenue Intelligence — from contract to cash — for less than one employee
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Recouply.ai scales with you — start at ${PLAN_CONFIGS.launch.monthlyPrice}/mo with {PLAN_CONFIGS.launch.creditAllotment} credits included. Add Live Contracts at ${LIVE_CONTRACTS_PRICING.pricePerContractPerMonth.toFixed(2)}/contract/mo.{" "}
            <button
              onClick={() => navigate("/pricing")}
              className="text-primary font-semibold hover:underline underline-offset-4"
            >
              See all plans →
            </button>
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
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
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {plan.credits} credits/mo{plan.contracts > 0 ? ` · ${plan.contracts} live contracts` : ""}
                  </p>
                </div>

                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-accent flex-shrink-0" />
                    All 6 AI recovery agents
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-accent flex-shrink-0" />
                    Stripe, QuickBooks & Smart Ingestion
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-accent flex-shrink-0" />
                    AI-powered collections workflows
                  </li>
                </ul>

                <Button 
                  variant={plan.highlight ? "default" : "outline"} 
                  className="w-full"
                  onClick={() => navigate("/pricing")}
                >
                  Start Recovering
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground mb-4">
            Overage credits: <span className="font-semibold">{formatPrice(CREDIT_PRICING.prepaidPerCredit, { showCents: true })} pre-paid / {formatPrice(CREDIT_PRICING.overagePerCredit, { showCents: true })} on-demand</span> · Extra seats: <span className="font-semibold">{formatPrice(SEAT_PRICING.monthlyPrice)}/user/mo</span> · Live Contracts: <span className="font-semibold">{formatPrice(LIVE_CONTRACTS_PRICING.pricePerContractPerMonth, { showCents: true })}/contract/mo</span>
          </p>
          <Button variant="ghost" onClick={() => navigate("/pricing")} className="group">
            View Full Pricing Details
            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default PricingTeaser;
