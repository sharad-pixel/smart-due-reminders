import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Store, Brain } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const SmallBusinesses = () => {
  const navigate = useNavigate();
  const [copy, setCopy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // SEO metadata
    document.title = "Collection Intelligence for Small Businesses | Recouply.ai";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Six AI agents recovering revenue 24/7 for small businesses, service providers, and contractors. Getting smarter with every invoice while protecting customer relationships.');
    }
    
    loadMarketingCopy();
  }, []);

  const loadMarketingCopy = async () => {
    try {
      // Try to fetch existing copy
      const { data: existing } = await supabase
        .from('marketing_snippets')
        .select('*')
        .eq('industry', 'small-businesses')
        .single();

      if (existing) {
        setCopy(existing);
        setLoading(false);
        return;
      }

      // Generate new copy if not exists
      const { data, error } = await supabase.functions.invoke('generate-icp-marketing-copy', {
        body: { industry: 'small-businesses' }
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
    "Six AI agents working 24/7 on payment reminders",
    "Agents learn and improve recovery rates over time",
    "Embedded payment links in every email and SMS",
    "QuickBooks and accounting software integration",
    "Customer-friendly tone that preserves relationships",
    "Full collections dashboard with real-time visibility"
  ];

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-6">
            <Store className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">For Small Businesses</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Six AI Agents Recovering Your Revenue—24/7
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Stop chasing payments. Our six AI agents handle outreach around the clock, 
            getting smarter with every interaction—at a fraction of the cost of one employee.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate("/signup?icp=small-businesses")}
              size="lg"
            >
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
                {copy?.problem_copy || `Small business owners wear many hats. Between serving customers, managing operations, and growing the business, following up on unpaid invoices often falls through the cracks.

When you do find time to chase payments, it's uncomfortable. You don't want to damage customer relationships or sound aggressive—but you need that cash flow to pay your team, cover expenses, and reinvest in growth.

Meanwhile, unpaid invoices pile up, cash gets tight, and you're stuck choosing between hiring help you can't afford or spending hours on manual follow-up that's inconsistent at best.`}
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
                {copy?.solution_copy || `Recouply.ai deploys six specialized AI agents that work 24/7 on your invoice recovery. Each agent learns from customer responses, payment outcomes, and message effectiveness—automatically improving recovery rates over time.

Plug in your invoices and let the agents do the rest. The system automatically sends polite reminders before due dates and intelligently follows up when payments are late. Each message includes a secure payment link, making it easy for customers to pay immediately.

You review and approve every message before it goes out, maintaining complete control. No awkward phone calls, no aggressive tactics—just intelligent automation that gets smarter every day. It's like having a full collections department working for you at a fraction of the cost of one employee.`}
              </p>
            </div>
          )}

          <Card>
            <CardContent className="pt-6">
              <h3 className="text-xl font-semibold mb-4">Key Features for Small Businesses:</h3>
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

      {/* Results Section */}
      <section className="py-16 px-4">
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
                {copy?.results_copy || `Small businesses using Recouply.ai typically see payments 12-15 days faster than manual follow-ups. That means better cash flow to invest back into your business, pay your team on time, and grow without the stress of unpredictable revenue.

You'll spend 90% less time on collections. No more awkward phone calls or manual reminder emails. Six AI agents handle it all automatically while you focus on what you do best—serving customers and growing your business.

Most importantly, you'll maintain the customer relationships you've worked so hard to build. Professional, AI-optimized reminders keep the conversation positive. Many customers simply forget to pay—a friendly automated reminder is all they need.`}
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
            Join small businesses recovering revenue 24/7 with AI agents that get smarter with every invoice.
          </p>
          <Button 
            onClick={() => navigate("/signup?icp=small-businesses")}
            size="lg"
          >
            Start Free Trial
          </Button>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default SmallBusinesses;
