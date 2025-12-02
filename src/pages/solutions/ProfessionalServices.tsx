import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Briefcase } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const ProfessionalServices = () => {
  const navigate = useNavigate();
  const [copy, setCopy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // SEO metadata
    document.title = "Invoice Collection for Professional Services | Recouply.ai";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'AI-powered invoice collection for agencies, consultants, accounting firms, and professional service providers. Eliminate uncomfortable payment reminders.');
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
    "Eliminate uncomfortable invoice reminder emails",
    "Flexible payment plan options",
    "Professional tone that preserves client relationships",
    "Integration with accounting and practice management software",
    "Automated follow-up sequences",
    "Complete control over messaging"
  ];

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-6">
            <Briefcase className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">For Professional Services</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Never Send an Awkward "Just Checking In" Email Again with Modern CashOps
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Intelligent CashOps automation for agencies, consultants, accounting firms, 
            legal practices, and professional service providers—maintaining relationships while accelerating cash flow.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate("/signup?icp=professional-services")}
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
                {copy?.problem_copy || `Professional service providers face a unique collections challenge: your clients are often people you work with closely over months or years. Sending invoice reminders feels uncomfortable and unprofessional.

You've completed the consulting project, filed the tax return, finished the legal work, or delivered the marketing campaign. But getting paid feels like chasing. You don't want to damage the relationship by seeming pushy, yet you can't let invoices age indefinitely.

Manual follow-ups consume valuable time you could spend serving clients or growing your practice. Without proactive CashOps processes in place, accounts receivable balloons and cash flow suffers. And hiring a collection agency for professional services feels completely inappropriate—it would destroy the trust and rapport you've built.`}
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
                {copy?.solution_copy || `Recouply.ai brings modern CashOps to professional services—handling the uncomfortable parts of invoice collection while maintaining your professional reputation. Our platform generates courteous, professional payment reminders that come from YOUR firm—never a third party.

For agencies and consultants, the CashOps system can reference specific project milestones or deliverables, making reminders feel personalized and contextual. For accounting and legal practices, it maintains the formal, professional tone appropriate for your industry while intelligently prioritizing accounts and automating follow-up sequences.

You maintain complete control. Review and approve every message before it's sent. Adjust timing, tone, and content to match your practice style. The CashOps platform handles the repetitive work of tracking invoices, prioritizing accounts, scheduling follow-ups, and sending reminders—freeing you to focus on client work while optimizing cash flow.`}
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
                {copy?.results_copy || `Professional service firms using Recouply.ai reduce their average days sales outstanding (DSO) by 30-40%. Invoices get paid faster because consistent, professional reminders keep payment top-of-mind for busy clients.

You'll reclaim hours every week previously spent on manual follow-ups. No more crafting "just checking in" emails or making uncomfortable phone calls. Your team can focus on billable work and client service instead of collections.

Most importantly, client relationships remain strong. Professional, respectful reminders maintain the trust and rapport you've built. Many clients simply get busy and forget—a courteous automated reminder is exactly what they need. Your reputation for professionalism stays intact while your cash flow improves dramatically.`}
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
            Join professional service firms that have accelerated cash collection 
            while maintaining client relationships.
          </p>
          <Button 
            onClick={() => navigate("/signup?icp=professional-services")}
            size="lg"
          >
            Start Free Trial
          </Button>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default ProfessionalServices;