import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Check, Mail, Zap } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";
import SaaSBenefits from "@/components/SaaSBenefits";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect } from "react";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { personaConfig } from "@/lib/personaConfig";

const plans = [
  {
    name: "Starter",
    price: "$99",
    period: "/month",
    invoiceLimit: "Up to 100 active invoices/month",
    description: "Perfect for small businesses with light AR volume.",
    cta: "Start Free Trial",
    planType: "starter",
    popular: false
  },
  {
    name: "Growth",
    price: "$199",
    period: "/month",
    invoiceLimit: "Up to 300 active invoices/month",
    description: "Ideal for scaling teams needing automated AR workflows.",
    cta: "Start Free Trial",
    planType: "growth",
    popular: true
  },
  {
    name: "Pro",
    price: "$499",
    period: "/month",
    invoiceLimit: "Up to 500 active invoices/month",
    description: "Built for high-volume AR operations ready for advanced automation.",
    cta: "Start Free Trial",
    planType: "pro",
    popular: false
  },
  {
    name: "Enterprise / Custom",
    price: "Custom",
    period: "",
    invoiceLimit: "500+ active invoices/month",
    description: "Everything in Pro, plus: Custom RCA integrations, CS case intelligence, multi-system sync, and advanced agent personalization using customer relationship data.",
    cta: "Contact Sales",
    planType: "enterprise",
    popular: false
  }
];

const platformFeatures = [
  "Six AI agents working 24/7",
  "Full automation capabilities",
  "CashOps dashboard & analytics",
  "Unlimited contacts / debtors",
  "Email & SMS outreach",
  "Promise-to-Pay tracking",
  "Team collaboration tools",
  "Priority support"
];

const enterpriseFeatures = [
  "Custom Salesforce RCA & Revenue platform integrations",
  "Real-time CS Case feed (Salesforce, Zendesk, Intercom)",
  "AI agents trained on invoice + case + relationship context",
  "Contextual tone shifting based on open cases & churn risk",
  "Dedicated integration workshop, API mapping & tuning"
];

const icpBenefits = [
  {
    title: "Small Businesses",
    description: "Six AI agents handling reminders 24/7, payment links in every message, friendly tone to preserve repeat business",
    link: "/solutions/small-businesses"
  },
  {
    title: "Professional Services",
    description: "Eliminate uncomfortable invoice reminders for agencies, consultants, legal practices, and accounting firms",
    link: "/solutions/professional-services"
  },
  {
    title: "SaaS Companies",
    description: "Reduce ARR leakage with intelligent AI agents, automate invoice reminders for lean finance teams, CRM-aware messaging",
    link: "/solutions/saas"
  },
  {
    title: "SMB & Local Services",
    description: "Simple AI-powered CashOps, intelligence that compounds over time, maintain customer relationships",
    link: "/solutions/small-businesses"
  }
];

const Pricing = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Recouply.ai Pricing – AI-Powered CashOps for SMB + SaaS";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Simple, transparent pricing based on active invoice volume. All plans include full platform access with six AI agents recovering revenue 24/7.');
    }
  }, []);

  const handlePlanClick = (planType: string) => {
    if (planType === "enterprise") {
      navigate("/contact-us");
    } else {
      navigate(`/signup?plan=${planType}`);
    }
  };

  return (
    <MarketingLayout>
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
            Simple, Volume-Based Pricing
          </div>
          <h1 className="text-5xl font-bold mb-6">
            Transparent <span className="text-primary">Pricing</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-4">
            All plans include full platform access. Choose based on your monthly active invoice volume.
          </p>
          <p className="text-lg text-primary font-medium mb-4">
            Six AI agents recovering your revenue 24/7—included in every plan.
          </p>
          <p className="text-sm text-muted-foreground mb-12">
            Pricing is based on active invoices per month. All plans include full access to AI agents, automation, dashboards, and support.
          </p>
        </div>

        <div className="container mx-auto max-w-7xl px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`bg-card rounded-xl border p-6 flex flex-col relative ${
                  plan.popular ? "ring-2 ring-primary shadow-xl scale-[1.02]" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-sm font-medium px-4 py-1 rounded-full flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Most Popular
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-2 mt-2">{plan.name}</h3>
                <div className="mb-2">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-sm font-medium text-primary mb-2">{plan.invoiceLimit}</p>
                <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>
                
                <div className="border-t pt-4 mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">
                    {plan.planType === "enterprise" ? "Case Intelligence & Custom Integrations" : "Full Platform Access"}
                  </p>
                  <ul className="space-y-2 mb-4 flex-1">
                    {(plan.planType === "enterprise" ? enterpriseFeatures : platformFeatures.slice(0, 4)).map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-xs">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {plan.planType !== "enterprise" && (
                  <p className="text-xs text-muted-foreground mb-4 bg-muted/50 p-2 rounded">
                    +$1.00 per additional active invoice beyond plan limits
                  </p>
                )}

                <Button
                  size="lg"
                  className="w-full mt-auto"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handlePlanClick(plan.planType)}
                >
                  {plan.planType === "enterprise" ? (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      {plan.cta}
                    </>
                  ) : (
                    plan.cta
                  )}
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground bg-muted/30 inline-block px-6 py-3 rounded-lg">
              Overage charges are calculated monthly based on actual active invoice usage.
            </p>
          </div>
        </div>
      </section>

      {/* ICP-Relevant Benefits */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-4">
            Built for Your Industry
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Recouply.ai's six AI agents are optimized for businesses across multiple verticals
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {icpBenefits.map((benefit, idx) => (
              <Card 
                key={idx} 
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(benefit.link)}
              >
                <CardContent className="pt-6">
                  <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* SaaS Benefits */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-4">
            Perfect for SaaS Companies
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            All plans include SaaS-optimized features to reduce ARR leakage with AI agents that learn and improve
          </p>
          <SaaSBenefits />
        </div>
      </section>

      {/* AI Personas Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-muted/10 to-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-4">
            <div className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
              AI-Powered CashOps
            </div>
          </div>
          <h2 className="text-3xl font-bold text-center mb-4">
            Meet Your Six AI Agents
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Every plan includes access to six specialized AI agents that work 24/7—learning and improving with every interaction
          </p>
          <TooltipProvider delayDuration={100}>
            <div className="flex justify-center items-center gap-8 flex-wrap mb-8">
              {Object.values(personaConfig).map((persona, index) => (
                <Tooltip key={persona.name}>
                  <TooltipTrigger asChild>
                    <div 
                      className="hover-scale cursor-pointer animate-fade-in transition-all duration-300"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="p-4 rounded-2xl bg-card border-2 border-transparent hover:border-primary/20 hover:shadow-xl transition-all duration-300">
                        <PersonaAvatar persona={persona} size="xl" />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="bottom" 
                    className="max-w-xs p-4 animate-scale-in bg-card border-2"
                    sideOffset={10}
                  >
                    <div className="space-y-2">
                      <h4 className="font-bold text-lg">{persona.name}</h4>
                      <p className="text-sm font-medium" style={{ color: persona.color }}>
                        {persona.description}
                      </p>
                      <p className="text-xs text-muted-foreground italic">
                        "{persona.tone}"
                      </p>
                      <div className="pt-2 border-t mt-2">
                        <p className="text-xs font-semibold mb-1">Coverage:</p>
                        <p className="text-xs text-muted-foreground">
                          {persona.bucketMin}-{persona.bucketMax || "+"} Days Past Due
                        </p>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                <span className="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                Hover over each agent to learn their specialty
              </p>
            </div>
          </TooltipProvider>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">What counts as an "active invoice"?</h3>
              <p className="text-muted-foreground">
                An active invoice is any invoice with status "Open" or "In Payment Plan" during the billing month. Paid, settled, or canceled invoices do not count toward your limit.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What happens if I exceed my invoice limit?</h3>
              <p className="text-muted-foreground">
                You'll be charged $1.00 per additional active invoice beyond your plan limit. Overage charges are calculated monthly based on actual usage—no surprise bills.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Can I upgrade or downgrade anytime?</h3>
              <p className="text-muted-foreground">
                Yes, all plans are month-to-month with no long-term commitment. Upgrade or downgrade anytime from your account settings.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Do all plans include the same features?</h3>
              <p className="text-muted-foreground">
                Yes! All plans include full platform access—six AI agents, automation, dashboards, analytics, and support. The only difference is invoice volume.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Is there a free trial?</h3>
              <p className="text-muted-foreground">
                Yes! All plans come with a 14-day free trial. No credit card required to start.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-muted-foreground">
                We accept all major credit cards through Stripe. Enterprise customers can request invoicing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-4xl font-bold mb-4">Ready to Put Six AI Agents to Work?</h2>
          <p className="text-lg mb-4 opacity-90">
            Start your free trial today. Full platform access with AI agents recovering your revenue 24/7.
          </p>
          <p className="text-md mb-8 opacity-80">
            "AI-powered CashOps means predictable payments, automated follow-up, and intelligence that compounds over time."
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate("/signup")}
              className="text-lg px-8"
            >
              Start Free Trial
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => window.open("https://calendly.com/sharad-recouply/30min", "_blank")}
              className="text-lg px-8 bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10"
            >
              Book a Demo
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Pricing;