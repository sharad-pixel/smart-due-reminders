import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Check, Mail } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";
import SaaSBenefits from "@/components/SaaSBenefits";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect } from "react";

const Pricing = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // SEO metadata
    document.title = "Recouply.ai Pricing – AI Collections for SMB + SaaS";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Choose a Recouply.ai plan for SMBs, auto, home services, and SaaS companies. Automate collections, reduce overdue invoices, and lower DSO with AI—no collection agency required.');
    }
  }, []);

  const plans = [
    {
      name: "Starter",
      price: "$39",
      period: "/month",
      description: "Perfect for small businesses getting started with collections automation",
      features: [
        "Up to 50 invoices per month",
        "AI email reminders",
        "Manual SMS sending",
        "Stripe payment link embedding",
        "Dashboard analytics",
        "Unlimited debtors",
        "Human approval workflow"
      ],
      cta: "Start Free Trial",
      planType: "starter"
    },
    {
      name: "Growth",
      price: "$99",
      period: "/month",
      description: "For growing teams that need full automation and CRM features",
      features: [
        "Up to 200 invoices per month",
        "Full AI cadence automation",
        "Automated SMS sending",
        "Promise-to-pay tracking",
        "Customer-aware AI outreach",
        "Multi-user support",
        "All Starter features"
      ],
      cta: "Start Free Trial",
      planType: "growth",
      popular: true
    },
    {
      name: "Professional",
      price: "$199",
      period: "/month",
      description: "Enterprise-grade collections for high-volume teams",
      features: [
        "Unlimited invoices",
        "Team permissions",
        "Priority AI throughput",
        "Advanced CRM context integration",
        "Dedicated support",
        "Automations/Schedulers",
        "All Growth features"
      ],
      cta: "Start Free Trial",
      planType: "professional"
    },
    {
      name: "Bespoke",
      price: "Custom",
      period: "",
      description: "Tailored for SaaS companies with 50-500 employees and high-volume invoicing",
      features: [
        "High-volume invoicing",
        "Dedicated onboarding",
        "API access",
        "Custom cadence logic",
        "Custom CRM integrations",
        "SLA-based support",
        "White-label options"
      ],
      cta: "Contact Us",
      planType: "bespoke"
    }
  ];

  const icpBenefits = [
    {
      title: "Home Services",
      description: "Fewer awkward reminder calls, payment links in every message, friendly tone to preserve repeat business",
      link: "/solutions/home-services"
    },
    {
      title: "Auto & Dealerships",
      description: "Recover unpaid service invoices, friendly SMS reminders, service advisor approved follow-up",
      link: "/solutions/home-services"
    },
    {
      title: "SaaS Companies",
      description: "Reduce ARR leakage, automate invoice reminders for lean finance teams, CRM-aware messaging",
      link: "/solutions/saas"
    },
    {
      title: "SMB & Local Services",
      description: "Simple AR automation, no accounting expertise required, maintain customer relationships",
      link: "/solutions/home-services"
    }
  ];

  const handlePlanClick = (planType: string) => {
    if (planType === "bespoke") {
      navigate("/contact-us");
    } else {
      navigate(`/signup?plan=${planType}`);
    }
  };

  return (
    <MarketingLayout>
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <h1 className="text-5xl font-bold mb-6">
            Simple, Transparent <span className="text-primary">Pricing</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-12">
            Choose the plan that fits your business size. All plans include 14-day free trial and our core AI features with human-in-the-loop approvals.
          </p>
        </div>

        <div className="container mx-auto max-w-7xl px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`bg-card rounded-lg border p-8 flex flex-col ${
                  plan.popular ? "ring-2 ring-primary shadow-lg scale-105" : ""
                }`}
              >
                {plan.popular && (
                  <div className="bg-primary text-primary-foreground text-sm font-medium px-3 py-1 rounded-full self-start mb-4">
                    Most Popular
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      {plan.planType === "bespoke" ? (
                        <Mail className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      ) : (
                        <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      )}
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  size="lg"
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handlePlanClick(plan.planType)}
                >
                  {plan.cta}
                </Button>
              </div>
            ))}
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
            Recouply.ai is optimized for businesses across multiple verticals
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
            All plans include SaaS-optimized features to reduce ARR leakage
          </p>
          <SaaSBenefits />
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">What happens if I exceed my invoice limit?</h3>
              <p className="text-muted-foreground">
                You can upgrade to the next tier at any time. We'll prorate the difference and ensure there's no interruption to your service.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Can I cancel anytime?</h3>
              <p className="text-muted-foreground">
                Yes, all plans are month-to-month with no long-term commitment. Cancel anytime from your account settings.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Do you take a percentage of collected payments?</h3>
              <p className="text-muted-foreground">
                No. We're software, not a collection agency. You pay a flat monthly fee, and 100% of collected payments go directly to you.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Is there a free trial?</h3>
              <p className="text-muted-foreground">
                Yes! All self-serve plans come with a 14-day free trial. No credit card required to start.
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
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Start your free trial today. No credit card required. Cancel anytime.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/signup")}
            className="text-lg px-8"
          >
            Start Free Trial
          </Button>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Pricing;
