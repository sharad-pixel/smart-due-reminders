import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Check, Mail } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";
import SaaSBenefits from "@/components/SaaSBenefits";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect } from "react";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { personaConfig } from "@/lib/personaConfig";

const Pricing = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // SEO metadata
    document.title = "Recouply.ai Pricing – AI-Powered CashOps for SMB + SaaS";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Choose a Recouply.ai plan for SMBs, auto, home services, and SaaS companies. Six AI agents recovering revenue 24/7—getting smarter with every invoice.');
    }
  }, []);

  const plans = [
    {
      name: "Starter",
      price: "$99",
      period: "/month",
      description: "Perfect for small businesses getting started with AI-powered CashOps",
      features: [
        "50 invoices per month included",
        "$1.00 per additional invoice",
        "Single user only 🚫",
        "Six AI agents working 24/7",
        "Manual SMS sending",
        "CashOps dashboard analytics",
        "Unlimited contacts / debtors"
      ],
      cta: "Start Free Trial",
      planType: "starter"
    },
    {
      name: "Growth",
      price: "$199",
      period: "/month",
      description: "For growing businesses that need full AI automation",
      features: [
        "200 invoices per month included",
        "$1.00 per additional invoice",
        "Single user only 🚫",
        "AI agents with continuous learning",
        "Auto-SMS",
        "Promise-to-Pay tracking",
        "Basic CRM integration"
      ],
      cta: "Start Free Trial",
      planType: "growth",
      popular: true
    },
    {
      name: "Professional",
      price: "$399",
      period: "/month",
      description: "Enterprise-grade CashOps with team collaboration",
      features: [
        "500 invoices per month included",
        "$1.00 per additional invoice",
        "✅ Admin + up to 5 team members",
        "Full role-based access control",
        "Manage permissions for each team member",
        "CRM-context-aware AI agents",
        "Invoice line items",
        "Advanced automations",
        "Priority AI queue"
      ],
      cta: "Start Free Trial",
      planType: "professional"
    },
    {
      name: "Bespoke",
      price: "Starting at $1,500",
      period: "/month",
      description: "High-volume SaaS companies with custom needs",
      features: [
        "High-volume invoicing",
        "✅ Full team & role management",
        "SSO / security options",
        "API access",
        "Dedicated support",
        "Custom CRM integrations",
        "White-label options"
      ],
      cta: "Contact Us",
      planType: "bespoke"
    }
  ];

  const icpBenefits = [
    {
      title: "Home Services",
      description: "Six AI agents handling reminders 24/7, payment links in every message, friendly tone to preserve repeat business",
      link: "/solutions/home-services"
    },
    {
      title: "Auto & Dealerships",
      description: "Recover unpaid service invoices with AI agents that learn and improve, service advisor approved follow-up",
      link: "/solutions/home-services"
    },
    {
      title: "SaaS Companies",
      description: "Reduce ARR leakage with intelligent AI agents, automate invoice reminders for lean finance teams, CRM-aware messaging",
      link: "/solutions/saas"
    },
    {
      title: "SMB & Local Services",
      description: "Simple AI-powered CashOps, intelligence that compounds over time, maintain customer relationships",
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
            Choose the plan that fits your business size. All plans include six AI agents working 24/7, human-in-the-loop approvals, and intelligence that gets smarter over time.
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

      {/* Feature Comparison Table */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-4">
            Team & Role Features Comparison
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Choose the right plan for your team's collaboration needs
          </p>
          <Card>
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-4 px-4">Feature</th>
                      <th className="text-center py-4 px-4">Starter</th>
                      <th className="text-center py-4 px-4">Growth</th>
                      <th className="text-center py-4 px-4">Professional</th>
                      <th className="text-center py-4 px-4">Custom</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-4 px-4 font-medium">Multi-user (Team)</td>
                      <td className="text-center py-4 px-4">❌</td>
                      <td className="text-center py-4 px-4">❌</td>
                      <td className="text-center py-4 px-4">✅ (Up to 5)</td>
                      <td className="text-center py-4 px-4">✅ (Unlimited)</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-4 px-4 font-medium">Role-based access</td>
                      <td className="text-center py-4 px-4">❌</td>
                      <td className="text-center py-4 px-4">❌</td>
                      <td className="text-center py-4 px-4">✅</td>
                      <td className="text-center py-4 px-4">✅</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-4 px-4 font-medium">Invoice line items</td>
                      <td className="text-center py-4 px-4">❌</td>
                      <td className="text-center py-4 px-4">❌</td>
                      <td className="text-center py-4 px-4">✅</td>
                      <td className="text-center py-4 px-4">✅</td>
                    </tr>
                    <tr>
                      <td className="py-4 px-4 font-medium">CRM-aware AI agents</td>
                      <td className="text-center py-4 px-4">❌</td>
                      <td className="text-center py-4 px-4">Basic</td>
                      <td className="text-center py-4 px-4">✅</td>
                      <td className="text-center py-4 px-4">✅</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
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
                No. Recouply.ai is AI-powered CashOps software. You pay a flat monthly fee, and 100% of collected payments go directly to you.
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
          <h2 className="text-4xl font-bold mb-4">Ready to Put Six AI Agents to Work?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Start your free trial today. Six AI agents recovering your revenue 24/7—getting smarter with every invoice.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button
              size="lg"
              onClick={() => navigate("/signup")}
              className="text-lg px-8"
            >
              Start Free Trial
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => window.open("https://calendly.com/sharad-recouply/30min", "_blank")}
              className="text-lg px-8"
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