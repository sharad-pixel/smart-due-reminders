import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { PLAN_CONFIGS, INVOICE_PRICING, SEAT_PRICING, formatPrice } from "@/lib/subscriptionConfig";

// Use centralized pricing config - Business plans only (excludes Solo Pro for teaser)
const plans = [
  { name: "Starter", price: PLAN_CONFIGS.starter.monthlyPrice, invoices: "100", highlight: false },
  { name: "Growth", price: PLAN_CONFIGS.growth.monthlyPrice, invoices: "300", highlight: true },
  { name: "Professional", price: PLAN_CONFIGS.professional.monthlyPrice, invoices: "500", highlight: false },
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
            Automate Collections for Less Than One Employee
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Starts at ${PLAN_CONFIGS.solo_pro.monthlyPrice}/mo for independents. Business plans from ${PLAN_CONFIGS.starter.monthlyPrice}/mo.
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
                    Up to {plan.invoices} invoices
                  </p>
                </div>

                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-accent flex-shrink-0" />
                    All 6 AI collection agents
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-accent flex-shrink-0" />
                    Stripe & QuickBooks integrations
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-accent flex-shrink-0" />
                    Full automation suite
                  </li>
                </ul>

                <Button 
                  variant={plan.highlight ? "default" : "outline"} 
                  className="w-full"
                  onClick={() => navigate("/pricing")}
                >
                  Start Collecting
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground mb-4">
            Per invoice: <span className="font-semibold">{formatPrice(INVOICE_PRICING.perInvoice, { showCents: true })}</span> | Additional users: <span className="font-semibold">{formatPrice(SEAT_PRICING.monthlyPrice)}/user/month</span>
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
