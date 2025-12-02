import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Home } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const HomeServices = () => {
  const navigate = useNavigate();
  const [copy, setCopy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // SEO metadata
    document.title = "Invoice Collection for Home Services | Recouply.ai";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'AI-powered invoice collection for plumbing, HVAC, electrical, roofing, and contractor businesses. Automate payment reminders while protecting customer relationships.');
    }
    
    loadMarketingCopy();
  }, []);

  const loadMarketingCopy = async () => {
    try {
      // Try to fetch existing copy
      const { data: existing } = await supabase
        .from('marketing_snippets')
        .select('*')
        .eq('industry', 'home-services')
        .single();

      if (existing) {
        setCopy(existing);
        setLoading(false);
        return;
      }

      // Generate new copy if not exists
      const { data, error } = await supabase.functions.invoke('generate-icp-marketing-copy', {
        body: { industry: 'home-services' }
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
    "Automated payment reminders sent from YOUR business",
    "Embedded payment links in every email and SMS",
    "QuickBooks and accounting software integration",
    "Customer-friendly tone that preserves relationships",
    "No collection agency fees or contracts",
    "Track which invoices need attention"
  ];

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-6">
            <Home className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">For Home Services</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Optimize Cash Flow with Modern CashOps. Focus on Completing More Jobs.
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            CashOps-driven invoice management that protects your reputation and accelerates cash flow 
            for plumbing, HVAC, electrical, roofing, and contractor businesses—without the hassle of manual follow-up.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate("/signup?icp=home-services")}
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
                {copy?.problem_copy || `Homeowners often delay payment after service completion. You've fixed their plumbing emergency, installed their new HVAC system, or completed their roof repair—but getting paid feels like another full-time job.

Between juggling service calls, managing crews, and ordering supplies, following up on overdue invoices falls through the cracks. When you do reach out, it's uncomfortable. You don't want to sound aggressive and damage the relationship, but you need to get paid.

Meanwhile, unpaid invoices pile up, cash flow tightens, and you're stuck choosing between paying your team or covering material costs. Collection agencies charge 25-40% of what they recover, and they often use tactics that hurt your hard-earned reputation in the community.`}
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
                {copy?.solution_copy || `Recouply.ai brings modern CashOps to home services—automating your invoice collection process while keeping everything under your control. Our platform drafts professional, friendly payment reminders that come from YOUR business—not a third-party agency.

With proactive CashOps automation, after completing a plumbing repair, the system automatically sends a polite reminder 3 days before the due date. If payment isn't received, it follows up with increasingly firm (but still professional) messages at 7, 14, and 30 days past due. Each message includes a secure payment link, making it easy for customers to pay immediately.

The CashOps platform pulls data from QuickBooks or your accounting software, intelligently prioritizes accounts, and always shows which invoices need attention. You review and approve every message before it goes out, maintaining complete control over your customer communications. No awkward phone calls, no aggressive tactics, no damage to your reputation—just effective, modern CashOps.`}
              </p>
            </div>
          )}

          <Card>
            <CardContent className="pt-6">
              <h3 className="text-xl font-semibold mb-4">Key Features for Home Services:</h3>
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
                {copy?.results_copy || `Home service businesses using Recouply.ai typically see payments 12-15 days faster than manual follow-ups. That means better cash flow to pay your crew, buy materials, and grow your business.

You'll spend 90% less time on collections. No more awkward phone calls or manual reminder emails. The system handles it all automatically while you focus on serving customers and completing jobs.

Most importantly, you'll maintain the customer relationships you've worked so hard to build. Professional, respectful reminders keep the conversation positive. Many customers simply forget to pay—a friendly automated reminder is all they need. And because everything comes from YOUR business (not a collection agency), your reputation in the community stays intact.`}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary/5">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Get Paid Faster?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join home service businesses that have streamlined their collections 
            and improved their cash flow with Recouply.ai.
          </p>
          <Button 
            onClick={() => navigate("/signup?icp=home-services")}
            size="lg"
          >
            Start Free Trial
          </Button>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default HomeServices;