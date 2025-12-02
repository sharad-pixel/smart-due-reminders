import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Building2, TrendingUp, Users, DollarSign, Brain } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import SaaSBenefits from "@/components/SaaSBenefits";

const SaaS = () => {
  const navigate = useNavigate();
  const [copy, setCopy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // SEO metadata
    document.title = "Recouply.ai for SaaS – Six AI Agents Reducing ARR Leakage 24/7";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Recouply.ai deploys six AI agents that recover revenue 24/7 for SaaS companies. Reduce ARR leakage, lower DSO, and free up CSMs—at a fraction of the cost of one employee.');
    }
    
    loadMarketingCopy();
  }, []);

  const loadMarketingCopy = async () => {
    try {
      const { data: existing } = await supabase
        .from('marketing_snippets')
        .select('*')
        .eq('industry', 'saas')
        .single();

      if (existing) {
        setCopy(existing);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-icp-marketing-copy', {
        body: { industry: 'saas' }
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
    "Six AI agents working 24/7 on invoice recovery",
    "Agents learn and improve recovery rates over time",
    "CRM-connected context-aware outreach",
    "Automated promise-to-pay and renewal reminders",
    "Customer-safe language that preserves relationships",
    "Full CashOps DSO dashboard with real-time visibility"
  ];

  const examples = [
    { icon: DollarSign, text: "SaaS billing on NetSuite/Stripe/Chargebee" },
    { icon: TrendingUp, text: "Usage-based billing with overdue true-ups" },
    { icon: Building2, text: "Annual contracts with overdue prepayments" },
    { icon: Users, text: "Expansion and renewal automation" }
  ];

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-6">
            <Building2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">For SaaS Companies</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Six AI Agents Reducing ARR Leakage—24/7
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Get the power of an entire CashOps department for less than the cost of one employee. 
            Our AI agents work around the clock, getting smarter with every interaction.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate("/signup?icp=saas")}
              size="lg"
            >
              Start Free Trial
            </Button>
            <Button 
              onClick={() => navigate("/pricing")}
              variant="outline"
              size="lg"
            >
              View Pricing
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
                {copy?.problem_copy || `Small finance teams manually chasing overdue invoices while collections responsibilities fall on CSMs and AEs. Disorganized shared inboxes lead to inconsistent follow-up, and ARR leakage from unmanaged renewals or overdue invoices creates cash flow unpredictability.

Without scalable CashOps processes, SaaS companies struggle with:
• Manual invoice follow-up consuming valuable time
• CSMs and AEs diverted from revenue-generating activities
• No systematic approach to handling overdue accounts
• Revenue recognition delays impacting financial reporting
• Customer relationships strained by inconsistent communication`}
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
                {copy?.solution_copy || `Recouply.ai deploys six specialized AI agents that work 24/7, automatically tracking invoices and triggering intelligent follow-up sequences. Each agent learns from customer responses, payment outcomes, and message effectiveness—continuously improving recovery rates.

When an account becomes past due, our AI agents generate professional, customer-safe reminders that maintain your brand voice and protect NRR. The agents automatically adapt tone, frequency, and sequencing based on real-world results.

Communications come directly from YOUR company, ensuring continuity in customer relationships. With CRM-connected context, every message is aware of customer history, contract value, and relationship status. Your team reviews and approves messaging before it goes out, maintaining full control while eliminating manual workload.`}
              </p>
            </div>
          )}

          <Card>
            <CardContent className="pt-6">
              <h3 className="text-xl font-semibold mb-4">Key Features for SaaS:</h3>
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
                    Each AI agent improves with every interaction, learning from customer responses, payment outcomes, 
                    engagement patterns, and message effectiveness. Recouply.ai becomes more accurate, more predictive, 
                    and more effective as time goes on—driving higher recovery rates with less manual work.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

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

      {/* SaaS-Specific Advantages */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold mb-6 text-center">Why SaaS Companies Choose Recouply.ai</h2>
          <SaaSBenefits />
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
                {copy?.results_copy || `SaaS companies using Recouply.ai collect past-due accounts 20–40% faster than manual processes. Finance teams save hours every week—time they can redirect to strategic work, forecasting, and analysis.

CSMs and AEs are freed from uncomfortable collection conversations, allowing them to focus on expansion and retention. Real-time visibility into receivables provides accurate forecasting and reduces cash flow uncertainty.

Most importantly, customer relationships remain strong. Professional, courteous reminders preserve NRR and reduce churn risk. Many customers simply forgot to pay or missed the invoice—a friendly, AI-optimized reminder is all it takes. Stop paying for expensive headcount—our agents work nonstop, at a fraction of the cost of one employee.`}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary/5">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Put Six AI Agents to Work?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Start your free trial—six AI agents recovering your revenue 24/7, getting smarter with every invoice.
          </p>
          <Button 
            onClick={() => navigate("/signup?icp=saas")}
            size="lg"
          >
            Start Free Trial
          </Button>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default SaaS;