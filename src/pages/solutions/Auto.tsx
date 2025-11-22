import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Car } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const Auto = () => {
  const navigate = useNavigate();
  const [copy, setCopy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // SEO metadata
    document.title = "Invoice Collection for Auto Industry | Recouply.ai";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'AI-powered invoice collection for auto dealerships, service departments, and repair shops. Recover unpaid service invoices professionally.');
    }
    
    loadMarketingCopy();
  }, []);

  const loadMarketingCopy = async () => {
    try {
      const { data: existing } = await supabase
        .from('marketing_snippets')
        .select('*')
        .eq('industry', 'auto')
        .single();

      if (existing) {
        setCopy(existing);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-icp-marketing-copy', {
        body: { industry: 'auto' }
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
    "Automated follow-ups for service invoices",
    "Financing payment reminders",
    "Warranty co-pay collection workflows",
    "Maintain your dealership branding",
    "Integration with DMS and accounting systems",
    "Professional tone that preserves customer relationships"
  ];

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-6">
            <Car className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">For Auto Industry</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Recover Unpaid Service Invoices Without Sounding Aggressive
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            AI-powered collection workflows for auto dealerships, service departments, 
            and repair shops that protect customer relationships and accelerate payments.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate("/signup?icp=auto")}
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
                {copy?.problem_copy || `Service departments lose thousands every month to unpaid invoices. Whether it's a routine oil change, major repair, or warranty co-pay, getting customers to pay after they drive off the lot is an ongoing challenge.

Finance departments face similar issues with past-due payments on vehicle purchases. Following up manually is time-consuming, and no one wants to call a customer who might return for future service—or refer friends and family.

Traditional collection methods feel too aggressive for the auto industry where customer lifetime value matters. You can't risk damaging relationships with tactics that make customers never want to come back. Yet without consistent follow-up, accounts receivable ages and cash flow suffers.`}
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
                {copy?.solution_copy || `Recouply.ai integrates with your DMS and accounting systems to automatically track service invoices, financing payments, and warranty co-pays. When an account becomes past due, our AI generates professional reminders that maintain your dealership's brand voice.

For example, after a customer's brake service, the system sends a friendly reminder if payment isn't received within your standard terms. Messages escalate appropriately—from gentle nudges to firmer (but still professional) requests—while always including convenient payment options.

All communications come from YOUR dealership, not a third-party collector. You review and approve messaging before it goes out, ensuring it aligns with your customer service standards. The system handles the repetitive follow-up work, freeing your team to focus on sales and service.`}
              </p>
            </div>
          )}

          <Card>
            <CardContent className="pt-6">
              <h3 className="text-xl font-semibold mb-4">Key Features for Auto Industry:</h3>
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
                {copy?.results_copy || `Auto dealerships and repair shops using Recouply.ai collect past-due accounts 40% faster than manual processes. Service departments see aged receivables drop significantly as automated reminders catch accounts before they become seriously delinquent.

Your team saves hours every week—time they can redirect to serving customers, closing sales, or managing operations. No more awkward phone calls or manual tracking of who needs follow-up.

Most importantly, you maintain positive customer relationships. Professional, courteous reminders preserve goodwill and keep customers coming back for future service. Many simply forgot to pay or missed the invoice—a friendly reminder is all it takes. Your reputation stays strong, and customers remain loyal to your dealership.`}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary/5">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Improve Your Collections Process?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join auto dealerships and repair shops improving cash flow 
            while protecting customer relationships.
          </p>
          <Button 
            onClick={() => navigate("/signup?icp=auto")}
            size="lg"
          >
            Start Free Trial
          </Button>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Auto;