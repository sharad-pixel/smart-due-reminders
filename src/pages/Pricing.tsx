import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Check, Mail, Zap } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";
import SaaSBenefits from "@/components/SaaSBenefits";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { personaConfig } from "@/lib/personaConfig";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PLAN_CONFIGS, SEAT_PRICING, ANNUAL_DISCOUNT_RATE, INVOICE_PRICING, formatPrice } from "@/lib/subscriptionConfig";
import { CostComparisonSection } from "@/components/marketing/CostComparisonSection";

/**
 * Pricing page with monthly/annual billing toggle
 * Annual billing = 20% discount on monthly pricing
 */

const plans = [
  {
    name: "Starter",
    monthlyPrice: PLAN_CONFIGS.starter.monthlyPrice,
    annualPrice: PLAN_CONFIGS.starter.annualPrice,
    equivalentMonthly: PLAN_CONFIGS.starter.equivalentMonthly,
    period: "/month",
    invoiceLimit: "Up to 100 active invoices/month",
    description: "Perfect for small businesses with light AR volume.",
    cta: "Start Free Trial",
    planType: "starter",
    popular: false
  },
  {
    name: "Growth",
    monthlyPrice: PLAN_CONFIGS.growth.monthlyPrice,
    annualPrice: PLAN_CONFIGS.growth.annualPrice,
    equivalentMonthly: PLAN_CONFIGS.growth.equivalentMonthly,
    period: "/month",
    invoiceLimit: "Up to 300 active invoices/month",
    description: "Ideal for scaling teams needing automated AR workflows.",
    cta: "Start Free Trial",
    planType: "growth",
    popular: true
  },
  {
    name: "Professional",
    monthlyPrice: PLAN_CONFIGS.professional.monthlyPrice,
    annualPrice: PLAN_CONFIGS.professional.annualPrice,
    equivalentMonthly: PLAN_CONFIGS.professional.equivalentMonthly,
    period: "/month",
    invoiceLimit: "Up to 500 active invoices/month",
    description: "Built for high-volume AR operations ready for advanced automation.",
    cta: "Start Free Trial",
    planType: "professional",
    popular: false
  },
  {
    name: "Enterprise / Custom",
    monthlyPrice: 0,
    annualPrice: 0,
    equivalentMonthly: 0,
    period: "",
    invoiceLimit: "500+ active invoices/month",
    description: "Everything in Professional, plus: Custom RCA integrations, CS case intelligence, multi-system sync, and advanced agent personalization using customer relationship data.",
    cta: "Contact Sales",
    planType: "enterprise",
    popular: false
  }
];

const platformFeatures = [
  "Six AI agents working 24/7",
  "Full automation capabilities",
  "Collections dashboard & analytics",
  "Unlimited contacts / accounts",
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
    description: "Simple AI-powered collections, intelligence that compounds over time, maintain customer relationships",
    link: "/solutions/small-businesses"
  }
];

const Pricing = () => {
  const navigate = useNavigate();
  const [isAnnual, setIsAnnual] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Recouply.ai Pricing – Collection Intelligence Platform for SMB + SaaS";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Simple, transparent pricing based on active invoice volume. All plans include full platform access with six AI agents recovering revenue 24/7.');
    }
    
    // Check if user has an active subscription
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_status, plan_type')
        .eq('id', session.user.id)
        .maybeSingle();
      
      if (profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing') {
        setHasActiveSubscription(true);
        setCurrentPlan(profile?.plan_type);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const handlePlanClick = async (planType: string) => {
    if (planType === "enterprise") {
      navigate("/contact-us");
      return;
    }
    
    setLoading(planType);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate(`/signup?plan=${planType}&billing=${isAnnual ? 'annual' : 'monthly'}`);
        return;
      }

      // If user has an active subscription, redirect to customer portal to manage/change plan
      if (hasActiveSubscription) {
        const { data, error } = await supabase.functions.invoke('customer-portal');
        
        if (error) throw error;
        
        if (data?.url) {
          window.open(data.url, '_blank');
        }
        return;
      }

      // New subscription checkout
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { 
          planId: planType,
          billingInterval: isAnnual ? 'year' : 'month'
        }
      });

      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout');
    } finally {
      setLoading(null);
    }
  };

  // Calculate discount percentage for display
  const discountPercent = Math.round(ANNUAL_DISCOUNT_RATE * 100);

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
          <p className="text-sm text-muted-foreground mb-8">
            Pricing is based on active invoices per month. All plans include full access to AI agents, automation, dashboards, and support.
          </p>
        </div>
      </section>

      {/* Cost Comparison: Human Collectors vs AI Agents */}
      <CostComparisonSection onCTAClick={() => handlePlanClick("growth")} />

      {/* Pricing Cards Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto text-center max-w-4xl mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Choose Your Plan
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Select the plan that matches your invoice volume. Scale up anytime.
          </p>
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4">
            <Label htmlFor="billing-toggle" className={!isAnnual ? "font-semibold" : "text-muted-foreground"}>
              Monthly
            </Label>
            <Switch
              id="billing-toggle"
              checked={isAnnual}
              onCheckedChange={setIsAnnual}
            />
            <Label htmlFor="billing-toggle" className={isAnnual ? "font-semibold" : "text-muted-foreground"}>
              Annual
            </Label>
            {isAnnual && (
              <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                Save {discountPercent}%
              </Badge>
            )}
          </div>
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
                  {plan.planType === "enterprise" ? (
                    <span className="text-4xl font-bold">Custom</span>
                  ) : isAnnual ? (
                    <>
                      <span className="text-4xl font-bold">{formatPrice(plan.annualPrice)}</span>
                      <span className="text-muted-foreground">/year</span>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-bold">{formatPrice(plan.monthlyPrice)}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </>
                  )}
                </div>
                {isAnnual && plan.planType !== "enterprise" && (
                  <div className="mb-2">
                    <p className="text-xs text-green-600 font-medium">
                      Billed annually ({discountPercent}% off)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Equivalent to {formatPrice(plan.equivalentMonthly)}/month
                    </p>
                  </div>
                )}
                {!isAnnual && plan.planType !== "enterprise" && (
                  <p className="text-xs text-muted-foreground mb-2">Billed monthly</p>
                )}
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
                  <div className="text-xs text-muted-foreground mb-4 bg-muted/50 p-2 rounded space-y-1">
                    <p>+{formatPrice(INVOICE_PRICING.perInvoice, { showCents: true })} per invoice</p>
                    <p>
                      +{formatPrice(isAnnual ? SEAT_PRICING.annualPrice : SEAT_PRICING.monthlyPrice)} per additional user/{isAnnual ? 'year' : 'month'}
                      {isAnnual && <span className="text-green-600 ml-1">({discountPercent}% off)</span>}
                    </p>
                  </div>
                )}

                <Button
                  size="lg"
                  className="w-full mt-auto"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handlePlanClick(plan.planType)}
                  disabled={loading === plan.planType}
                >
                  {loading === plan.planType ? 'Processing...' : plan.planType === "enterprise" ? (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      {plan.cta}
                    </>
                  ) : hasActiveSubscription ? (
                    currentPlan === plan.planType ? 'Current Plan' : 'Change Plan'
                  ) : (
                    plan.cta
                  )}
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground bg-background/50 inline-block px-6 py-3 rounded-lg">
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
              Collection Intelligence Platform
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

      {/* Pricing Philosophy & Credibility Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">Why We Price This Way</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Recouply.ai follows proven SaaS pricing models used by leading software platforms.
              We combine transparent base plans with seat-based and usage-based pricing so customers 
              only pay for what they use — and can scale without surprises.
            </p>
          </div>
          
          <div className="bg-card border rounded-xl p-6 md:p-8">
            <h3 className="text-lg font-semibold mb-4 text-center">Industry Research & Best Practices</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <a 
                href="https://www.togai.com/blog/price-transparency-customer-loyalty/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
              >
                <div className="w-2 h-2 mt-2 bg-primary rounded-full flex-shrink-0"></div>
                <div>
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">
                    Transparent SaaS pricing builds trust and loyalty
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">togai.com</p>
                </div>
              </a>
              
              <a 
                href="https://stripe.com/resources/more/usage-based-pricing-for-saas-how-to-make-the-most-of-this-pricing-model" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
              >
                <div className="w-2 h-2 mt-2 bg-primary rounded-full flex-shrink-0"></div>
                <div>
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">
                    Why usage-based pricing works for SaaS businesses
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">stripe.com</p>
                </div>
              </a>
              
              <a 
                href="https://tomtunguz.com/seat-vs-usage-based-pricing/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
              >
                <div className="w-2 h-2 mt-2 bg-primary rounded-full flex-shrink-0"></div>
                <div>
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">
                    Per-seat vs. usage-based pricing frameworks for SaaS
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">tomtunguz.com</p>
                </div>
              </a>
              
              <a 
                href="https://userpilot.com/blog/pricing-page-best-practices/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
              >
                <div className="w-2 h-2 mt-2 bg-primary rounded-full flex-shrink-0"></div>
                <div>
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">
                    SaaS pricing page best practices that improve conversion
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">userpilot.com</p>
                </div>
              </a>
              
              <a 
                href="https://www.vendr.com/blog/usage-based-pricing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors group md:col-span-2 md:max-w-md md:mx-auto"
              >
                <div className="w-2 h-2 mt-2 bg-primary rounded-full flex-shrink-0"></div>
                <div>
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">
                    Why SaaS companies adopt hybrid pricing models
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">vendr.com</p>
                </div>
              </a>
            </div>
          </div>
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
                You'll be charged {formatPrice(INVOICE_PRICING.perInvoice, { showCents: true })} per additional active invoice beyond your plan limit. Overage charges are calculated monthly based on actual usage—no surprise bills.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">How much do additional team members cost?</h3>
              <p className="text-muted-foreground">
                Each additional active user is billed at <strong>${SEAT_PRICING.monthlyPrice} per month</strong> (or <strong>${SEAT_PRICING.annualPrice} per year</strong> with annual billing—{Math.round(ANNUAL_DISCOUNT_RATE * 100)}% savings). The primary account owner is included free in your base plan. Additional team members (admins, members, viewers) are billable seats.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What's the difference between monthly and annual billing?</h3>
              <p className="text-muted-foreground">
                Annual billing gives you a <strong>{Math.round(ANNUAL_DISCOUNT_RATE * 100)}% discount</strong> on both your base plan and team seats. You're billed once per year instead of monthly. For example, the Starter plan is ${PLAN_CONFIGS.starter.monthlyPrice}/month or ${PLAN_CONFIGS.starter.annualPrice}/year (equivalent to ${PLAN_CONFIGS.starter.equivalentMonthly}/month).
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Can I upgrade or downgrade anytime?</h3>
              <p className="text-muted-foreground">
                Yes, all plans are flexible. You can upgrade or downgrade anytime from your account settings. Changes take effect at the next billing cycle with prorated adjustments.
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
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Transform Your Collections?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Start your free trial today and let our AI agents handle your collections.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => handlePlanClick("growth")}>
              Start Free Trial
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/contact-us")}>
              Book a Demo
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Pricing;
