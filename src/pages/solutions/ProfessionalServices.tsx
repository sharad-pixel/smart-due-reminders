import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Briefcase, Brain } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const ProfessionalServices = () => {
  const navigate = useNavigate();
  const [copy, setCopy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // SEO metadata
    document.title = "AI-Powered CashOps for Professional Services | Recouply.ai";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Six AI agents recovering revenue 24/7 for agencies, consultants, accounting firms, and professional service providers. Getting smarter with every invoice.');
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
    "Six AI agents eliminating uncomfortable invoice reminders",
    "Agents learn and adapt tone based on client relationships",
    "Flexible payment plan options",
    "Integration with accounting and practice management software",
    "Automated follow-up sequences that improve over time",
    "Complete control over messaging and approvals"
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
            Six AI Agents Handling Your Collections—24/7
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Never send an awkward "just checking in" email again. Our AI agents work around the clock, 
            learning and improving with every interaction—at a fraction of the cost of one employee.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate("/signup?icp=professional-services")}
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
                {copy?.problem_copy || `Professional service providers face a unique collections challenge: your clients are often people you work with closely over months or years. Sending invoice reminders feels uncomfortable and unprofessional.

You've completed the consulting project, filed the tax return, finished the legal work, or delivered the marketing campaign. But getting paid feels like chasing. You don't want to damage the relationship by seeming pushy, yet you can't let invoices age indefinitely.

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
                {copy?.solution_copy || `Recouply.ai deploys six specialized AI agents that handle the uncomfortable parts of invoice collection while maintaining your professional reputation. Each agent learns from client responses and payment patterns—automatically improving recovery rates over time.

For agencies and consultants, the AI agents can reference specific project milestones or deliverables, making reminders feel personalized and contextual. For accounting and legal practices, they maintain the formal, professional tone appropriate for your industry while still being effective.

You maintain complete control. Review and approve every message before it's sent. Adjust timing, tone, and content to match your practice style. The AI agents handle the repetitive work of tracking invoices, scheduling follow-ups, and sending reminders—freeing you to focus on client work.`}
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
                {copy?.results_copy || `Professional service firms using Recouply.ai reduce their average days sales outstanding (DSO) by 30-40%. Invoices get paid faster because consistent, AI-optimized reminders keep payment top-of-mind for busy clients.

You'll reclaim hours every week previously spent on manual follow-ups. No more crafting "just checking in" emails or making uncomfortable phone calls. Your team can focus on billable work and client service instead of collections.

Most importantly, client relationships remain strong. Professional, AI-refined reminders maintain the trust and rapport you've built. Many clients simply get busy and forget—a courteous automated reminder is exactly what they need. Stop paying for expensive headcount—our agents work nonstop, at a fraction of the cost of one employee.`}
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
            Join professional service firms recovering revenue 24/7 with AI agents that get smarter with every invoice.
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