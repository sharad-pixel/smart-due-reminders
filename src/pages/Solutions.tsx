import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Home, Briefcase, Store, Building2 } from "lucide-react";

const Solutions = () => {
  const navigate = useNavigate();

  const industries = [
    {
      icon: Home,
      title: "Small Businesses",
      description: "For service providers, contractors, and local businesses",
      benefits: [
        "Six AI-assisted agents guiding payment follow-ups",
        "Payment links embedded in every communication",
        "Risk-aware workflows that protect cash flow",
        "Intelligence that compounds with every interaction"
      ],
      link: "/solutions/small-businesses"
    },
    {
      icon: Building2,
      title: "SaaS Companies",
      description: "For SaaS companies looking to reduce ARR leakage",
      benefits: [
        "Reduce revenue leakage with proactive intelligence",
        "Automated follow-ups guided by payment behavior",
        "Lighten the load on Finance and RevOps teams",
        "Relationship-aware outreach, human-approved"
      ],
      link: "/solutions/saas"
    },
    {
      icon: Briefcase,
      title: "Professional Services",
      description: "For agencies, consultants, accounting firms, legal practices",
      benefits: [
        "Replace uncomfortable reminders with AI-assisted outreach",
        "Tone adapts based on relationship context",
        "Designed to support predictable cash outcomes",
        "Preserve client trust while guiding recovery"
      ],
      link: "/solutions/professional-services"
    },
    {
      icon: Store,
      title: "Local Retail & Services",
      description: "For retail shops, service providers, and local businesses",
      benefits: [
        "Six agents working around the clock, reviewed by you",
        "Professional outreach aligned with your brand",
        "Visibility into payment patterns and DSO",
        "Signals that inform your next action"
      ],
      link: "/solutions/small-businesses"
    }
  ];

  return (
    <MarketingLayout>
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
              Collection Intelligence Engine
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Six AI Agents Built for Your Industry
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-4">
              Recouply.ai deploys six specialized agents that learn from payment behavior and account context—
              helping you act earlier, recover smarter, and preserve relationships.
            </p>
            <p className="text-lg text-primary font-medium">
              "Proactive intelligence, human-controlled outcomes."
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-16">
            {industries.map((industry, idx) => {
              const Icon = industry.icon;
              return (
                <Card key={idx} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-4 mb-2">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <CardTitle className="text-2xl">{industry.title}</CardTitle>
                    </div>
                    <CardDescription className="text-base">
                      {industry.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 mb-6">
                      {industry.benefits.map((benefit, bidx) => (
                        <li key={bidx} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                          <span className="text-muted-foreground">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                    <Button 
                      onClick={() => navigate(industry.link)}
                      className="w-full"
                    >
                      Learn More
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="text-center bg-gradient-to-br from-primary/5 to-secondary/5 border rounded-lg p-12">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Put Six AI Agents to Work?
            </h2>
            <p className="text-lg text-muted-foreground mb-4 max-w-2xl mx-auto">
              Join businesses using AI-assisted collections to recover revenue around the clock—
              with human oversight at every step.
            </p>
            <p className="text-md text-primary font-medium mb-8">
              "Designed to support predictable cash flow."
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button 
                onClick={() => navigate("/signup")}
                size="lg"
              >
                Start Free Trial
              </Button>
              <Button 
                onClick={() => window.open("https://calendly.com/sharad-recouply/30min", "_blank")}
                size="lg"
                variant="outline"
              >
                Book a Demo
              </Button>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Solutions;