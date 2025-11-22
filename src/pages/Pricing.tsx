import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";

const Pricing = () => {
  const navigate = useNavigate();

  const plans = [
    {
      name: "Starter",
      price: "$49",
      period: "/month",
      description: "Perfect for small businesses getting started with collections automation",
      features: [
        "Up to 50 invoices per month",
        "AI email & SMS drafting",
        "Basic invoice management",
        "Stripe payment link integration",
        "Email support",
        "Human approval workflow"
      ],
      cta: "Start Starter Plan",
      planType: "starter"
    },
    {
      name: "Growth",
      price: "$149",
      period: "/month",
      description: "For growing teams that need CRM integration and advanced features",
      features: [
        "Up to 200 invoices per month",
        "Everything in Starter, plus:",
        "CRM integration (Salesforce)",
        "Customer-aware AI messaging",
        "Advanced analytics & reporting",
        "Priority email support",
        "Custom cadence workflows"
      ],
      cta: "Start Growth Plan",
      planType: "growth",
      popular: true
    },
    {
      name: "Professional",
      price: "$399",
      period: "/month",
      description: "Enterprise-grade collections for high-volume teams",
      features: [
        "Unlimited invoices",
        "Everything in Growth, plus:",
        "Multi-user accounts & permissions",
        "Custom integrations (API access)",
        "Dedicated account manager",
        "Phone & priority support",
        "Custom AI tone training",
        "White-label options"
      ],
      cta: "Start Professional Plan",
      planType: "professional"
    }
  ];

  return (
    <MarketingLayout>
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <h1 className="text-5xl font-bold mb-6">
            Simple, Transparent <span className="text-primary">Pricing</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-12">
            Choose the plan that fits your business size. All plans include our core AI features and human-in-the-loop approvals.
          </p>
        </div>

        <div className="container mx-auto max-w-7xl px-4">
          <div className="grid md:grid-cols-3 gap-8">
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
                      <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  size="lg"
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => navigate(`/signup?plan=${plan.planType}`)}
                >
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

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
