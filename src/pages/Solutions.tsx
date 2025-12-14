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
        "Six AI agents handling payment reminders 24/7",
        "Embed payment links in every communication",
        "QuickBooks-friendly workflows",
        "Agents learn and improve recovery rates over time"
      ],
      link: "/solutions/small-businesses"
    },
    {
      icon: Building2,
      title: "SaaS Companies",
      description: "For SaaS companies looking to reduce ARR leakage",
      benefits: [
        "Reduce ARR leakage with intelligent AI agents",
        "Automate follow-ups that get smarter over time",
        "Lighten load on CSM/Finance teams",
        "Customer-safe collections that preserve relationships"
      ],
      link: "/solutions/saas"
    },
    {
      icon: Briefcase,
      title: "Professional Services",
      description: "For agencies, consultants, accounting firms, legal practices",
      benefits: [
        "Eliminate uncomfortable invoice reminder emails",
        "AI agents adapt tone based on client relationships",
        "Accelerate cash collection cycles",
        "Preserve client relationships with intelligent outreach"
      ],
      link: "/solutions/professional-services"
    },
    {
      icon: Store,
      title: "Local Retail & Services",
      description: "For retail shops, service providers, and local businesses",
      benefits: [
        "Six AI agents working around the clock",
        "Professional outreach from your business",
        "Payment tracking and DSO reporting",
        "Intelligence that compounds over time"
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
              Recouply.ai deploys six specialized AI agents that work 24/7 to optimize your collections and recover overdue invoices—
              getting smarter with every interaction while preserving customer relationships.
            </p>
            <p className="text-lg text-primary font-medium">
              "The future of receivables management."
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
              Join businesses using six AI agents that work nonstop, recovering revenue 24/7—
              at a fraction of the cost of one employee.
            </p>
            <p className="text-md text-primary font-medium mb-8">
              "Predictable cash flow powered by AI."
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