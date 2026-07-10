import MarketingLayout from "@/components/layout/MarketingLayout";
import SEOHead from "@/components/seo/SEOHead";
import { PAGE_SEO } from "@/lib/seoConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Briefcase, Brain, Scale, Calculator, Palette, Users, ArrowRight } from "lucide-react";
import StripeLogo from "@/components/brand/StripeLogo";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import RiskAndPayLinksSection from "@/components/marketing/RiskAndPayLinksSection";
import { PLAN_CONFIGS, CREDIT_PRICING, LIVE_CONTRACTS_PRICING } from "@/lib/subscriptionConfig";

const ProfessionalServices = () => {
  const navigate = useNavigate();
  const [copy, setCopy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Revenue Intelligence for Professional Services | Recouply.ai";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'AI-powered Revenue Intelligence for agencies, consultants, accounting firms, and legal practices. Six agents recover AR 24/7 while preserving every client relationship.');
    }

    loadMarketingCopy();
  }, []);

  const loadMarketingCopy = async () => {
    try {
      const { data: existing } = await supabase
        .from('marketing_snippets')
        .select('*')
        .eq('industry', 'professional-services')
        .single();

      if (existing) {
        setCopy(existing);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-icp-marketing-copy', {
        body: { industry: 'professional-services' }
      });

      if (error) throw error;
      setCopy(data);
    } catch (error) {
      console.error('Error loading marketing copy:', error);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    "Six AI agents eliminating uncomfortable payment reminders",
    "Tone adapts based on client relationship and matter context",
    "Flexible payment plans with tracked installments",
    "Integrates with accounting and practice management software",
    "Automated sequences that improve with every interaction",
    "Complete review and approval control over every message"
  ];

  const examples = [
    { icon: Palette, text: "Agencies with retainers, project milestones, and Net 30/60 terms" },
    { icon: Calculator, text: "Accounting and bookkeeping firms with recurring engagements" },
    { icon: Scale, text: "Legal practices with matter-based billing and trust accounts" },
    { icon: Users, text: "Consulting firms managing long-cycle client relationships" }
  ];

  return (
    <MarketingLayout>
      <SEOHead
        title={PAGE_SEO.professionalServices.title}
        description={PAGE_SEO.professionalServices.description}
        keywords={PAGE_SEO.professionalServices.keywords}
        breadcrumbs={[
          { name: 'Solutions', url: 'https://recouply.ai/solutions' },
          { name: 'Professional Services', url: 'https://recouply.ai/solutions/professional-services' },
        ]}
      />

      {/* Hero Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-6">
            <Briefcase className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Revenue Intelligence for Professional Services</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Six AI Agents Handling Your AR Collections — 24/7
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Never send an awkward "just checking in" email again. Our AI agents work around the clock on your accounts receivable,
            adapting tone to each client relationship — at a fraction of the cost of one employee.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate("/signup?icp=professional-services")}
              size="lg"
            >
              Start Free Trial
            </Button>
            <Button
              onClick={() => navigate("/stripe-collections")}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              Set it and forget it with <StripeLogo className="h-4 w-auto text-[#635BFF]" /> billing
            </Button>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold mb-6">The Problem</h2>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <div className="prose prose-lg max-w-none">
              <p className="text-muted-foreground whitespace-pre-line">
                {copy?.problem_copy || `Professional service providers face a unique collections challenge: your clients are often people you work with closely over months or years. Sending payment reminders feels uncomfortable and unprofessional.

You've completed the consulting project, filed the tax return, finished the legal work, or delivered the marketing campaign. But getting paid feels like chasing. You don't want to damage the relationship by seeming pushy, yet you can't let receivables age indefinitely.

Manual follow-ups consume valuable time you could spend serving clients or growing your practice. Yet without consistent follow-up, your accounts receivable balloons and cash flow suffers.`}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-16 px-4 bg-card">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold mb-6">How Recouply.ai Helps</h2>
          {loading ? (
            <div className="space-y-2 mb-8">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <div className="prose prose-lg max-w-none mb-8">
              <p className="text-muted-foreground whitespace-pre-line">
                {copy?.solution_copy || `Recouply.ai deploys six specialized AI agents that handle the uncomfortable parts of collection while maintaining your professional reputation. Each agent learns from client responses and payment patterns — automatically improving recovery rates over time.

For agencies and consultants, the AI agents can reference specific project milestones or deliverables, making reminders feel personalized and contextual. For accounting and legal practices, they maintain the formal, professional tone appropriate for your industry while still being effective.

You maintain complete control. Review and approve every message before it's sent. Adjust timing, tone, and content to match your practice style. The AI agents handle the repetitive work of tracking receivables, scheduling follow-ups, and sending reminders — freeing you to focus on client work.`}
              </p>
            </div>
          )}

          <Card>
            <CardContent className="pt-6">
              <h3 className="text-xl font-semibold mb-4">Key Features for Professional Services:</h3>
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
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card className="bg-gradient-to-br from-primary/5 to-secondary/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Brain className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Intelligence That Compounds Over Time</h3>
                  <p className="text-muted-foreground">
                    Each AI agent improves with every interaction, learning from client responses, payment outcomes,
                    engagement patterns, and message effectiveness. Recouply.ai becomes more accurate, more predictive,
                    and more effective as time goes on — driving higher recovery rates with less manual work.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Risk Assessment + Payment Links */}
      <RiskAndPayLinksSection
        audienceLabel="For agencies, consultants, and firms protecting client relationships"
        ctaHref="/signup?icp=professional-services"
      />

      {/* Industry Examples */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold mb-6">Perfect For</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {examples.map((example, idx) => {
              const Icon = example.icon;
              return (
                <Card key={idx}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <p className="text-lg font-medium mt-2">{example.text}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="py-16 px-4 bg-card">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold mb-6">The Results</h2>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <div className="prose prose-lg max-w-none">
              <p className="text-muted-foreground whitespace-pre-line">
                {copy?.results_copy || `Professional service firms using Recouply.ai reduce their average days sales outstanding (DSO) by 30-40%. Invoices get paid faster because consistent, AI-optimized reminders keep payment top-of-mind for busy clients.

You'll reclaim hours every week previously spent on manual follow-ups. No more crafting "just checking in" emails or making uncomfortable phone calls. Your team can focus on billable work and client service instead of collections.

Most importantly, client relationships remain strong. Professional, AI-refined reminders maintain the trust and rapport you've built. Many clients simply get busy and forget — a courteous automated reminder is exactly what they need. Stop paying for expensive headcount — our agents work nonstop, at a fraction of the cost of one employee.`}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Pricing Band */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
            <CardContent className="pt-8 pb-8">
              <div className="grid md:grid-cols-2 gap-6 items-center">
                <div>
                  <h3 className="text-2xl font-bold mb-2">Credit-based pricing built for practices</h3>
                  <p className="text-muted-foreground">
                    Launch starts at ${PLAN_CONFIGS.launch.monthlyPrice}/mo with {PLAN_CONFIGS.launch.creditAllotment} credits included —
                    ideal for solo practitioners. Starter at ${PLAN_CONFIGS.starter.monthlyPrice}/mo adds {PLAN_CONFIGS.starter.creditAllotment} credits and
                    {" "}{PLAN_CONFIGS.starter.includedContracts} Live Contracts for growing firms. Overage credits at
                    {" "}${CREDIT_PRICING.prepaidPerCredit.toFixed(2)} pre-paid / ${CREDIT_PRICING.overagePerCredit.toFixed(2)} on-demand.
                    Add Live Contracts at ${LIVE_CONTRACTS_PRICING.pricePerContractPerMonth.toFixed(2)}/contract/mo.
                  </p>
                </div>
                <div className="flex md:justify-end">
                  <Button onClick={() => navigate("/pricing")} size="lg" className="gap-2">
                    See Pricing <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary/5">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Put Six AI Agents to Work?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join professional service firms recovering revenue 24/7 with AI agents that get smarter with every invoice.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={() => navigate("/signup?icp=professional-services")} size="lg">
              Start Free Trial
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
    </MarketingLayout>
  );
};

export default ProfessionalServices;
