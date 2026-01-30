import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, User, Brain, Zap, DollarSign, Clock } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import { PLAN_CONFIGS, INVOICE_PRICING } from "@/lib/subscriptionConfig";

const SoloPro = () => {
  const navigate = useNavigate();

  const features = [
    "All 6 AI collection agents working 24/7",
    "Stripe & QuickBooks integrations included",
    "Email campaigns with embedded payment links",
    "Full automation suite—no feature limits",
    "Collection intelligence dashboard",
    "Risk-aware workflows that learn over time"
  ];

  const benefits = [
    {
      icon: DollarSign,
      title: "Affordable Power",
      description: `Just $${PLAN_CONFIGS.solo_pro.monthlyPrice}/month for 25 active invoices—full platform access at a fraction of team plans.`
    },
    {
      icon: Zap,
      title: "No Feature Limits",
      description: "Access every AI agent, integration, and automation. Same capabilities as larger plans, sized for solo operators."
    },
    {
      icon: Clock,
      title: "Consumption-Based",
      description: `Only $${INVOICE_PRICING.perInvoice} per additional invoice when you exceed your monthly limit. Pay for what you use.`
    }
  ];

  return (
    <MarketingLayout>
      <SEOHead
        title="Solo Pro Plan for Independent Operators | Recouply.ai"
        description="Full-powered AI collection platform for sole proprietors and independent operators. $49/month for 25 invoices with all 6 AI agents and complete automation."
        keywords="solo collections software, independent operator billing, freelancer invoice collection, sole proprietor AR automation"
        canonical="https://recouply.ai/solutions/solo-pro"
      />
      
      {/* Hero Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-6">
            <User className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">For Solo Operators</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Full Platform Power at a Solo Price
          </h1>
          <p className="text-xl text-muted-foreground mb-4">
            Six AI agents, complete automation, and all integrations—designed for independent operators 
            who need enterprise-grade collection intelligence without the enterprise price tag.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <div className="text-3xl font-bold text-primary">
              ${PLAN_CONFIGS.solo_pro.monthlyPrice}<span className="text-lg font-normal text-muted-foreground">/month</span>
            </div>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">25 invoices included</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate("/signup?plan=solo_pro")}
              size="lg"
            >
              Start 7-Day Free Trial
            </Button>
            <Button 
              onClick={() => window.open("https://calendly.com/sharad-recouply/30min", "_blank")}
              variant="outline"
              size="lg"
            >
              Book a Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Who It's For */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold mb-6">Built for Independent Operators</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-muted-foreground">
              You're running your own show—whether as a freelancer, consultant, contractor, or sole proprietor. 
              You don't have a finance team or collections department. You handle everything yourself, 
              including the uncomfortable task of chasing unpaid invoices.
            </p>
            <p className="text-muted-foreground">
              Solo Pro gives you the same AI-powered collection intelligence used by larger businesses, 
              right-sized for your operation. No feature limitations. No compromises. Just powerful automation 
              at a price that makes sense for one-person shops.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold mb-8 text-center">Why Solo Pro?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {benefits.map((benefit, idx) => (
              <Card key={idx}>
                <CardContent className="pt-6">
                  <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                    <benefit.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold mb-6">Everything You Need, Nothing You Don't</h2>
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-xl font-semibold mb-4">Full Platform Access Includes:</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Intelligence Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <Card className="bg-gradient-to-br from-primary/5 to-secondary/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Brain className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Intelligence That Grows With You</h3>
                  <p className="text-muted-foreground">
                    Every AI agent learns from your customer interactions, payment patterns, and message effectiveness. 
                    Over time, your collection intelligence becomes more accurate and your recovery rates improve—automatically. 
                    Start solo, scale when you're ready.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Pricing Details */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold mb-6 text-center">Simple, Transparent Pricing</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-4xl font-bold text-primary mb-2">${PLAN_CONFIGS.solo_pro.monthlyPrice}</div>
                <div className="text-muted-foreground mb-4">per month</div>
                <ul className="text-sm text-left space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    25 active invoices included
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    All 6 AI collection agents
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Full platform access
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-4xl font-bold text-muted-foreground mb-2">${INVOICE_PRICING.perInvoice}</div>
                <div className="text-muted-foreground mb-4">per additional invoice</div>
                <ul className="text-sm text-left space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Pay only when you exceed 25
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Calculated monthly
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Scale seamlessly as you grow
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary/5">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Put Six AI Agents to Work?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join independent operators using enterprise-grade collection intelligence at a solo price.
          </p>
          <Button 
            onClick={() => navigate("/signup?plan=solo_pro")}
            size="lg"
          >
            Start Your 7-Day Free Trial
          </Button>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default SoloPro;
