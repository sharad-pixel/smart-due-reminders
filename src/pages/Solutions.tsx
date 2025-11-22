import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Home, Car, Briefcase, Store } from "lucide-react";

const Solutions = () => {
  const navigate = useNavigate();

  const industries = [
    {
      icon: Home,
      title: "Home Services",
      description: "For plumbing, HVAC, electrical, roofing, and contractor businesses",
      benefits: [
        "Automated payment reminders that protect customer relationships",
        "Embed payment links in every communication",
        "QuickBooks-friendly workflows",
        "No third-party collection agency needed"
      ],
      link: "/solutions/home-services"
    },
    {
      icon: Car,
      title: "Auto Industry",
      description: "For dealerships, service departments, and auto repair shops",
      benefits: [
        "Recover unpaid service invoices professionally",
        "Financing past-due reminder automation",
        "Warranty co-pay collection workflows",
        "Maintain your dealership branding"
      ],
      link: "/solutions/auto"
    },
    {
      icon: Briefcase,
      title: "Professional Services",
      description: "For agencies, consultants, accounting firms, legal practices",
      benefits: [
        "Eliminate uncomfortable invoice reminder emails",
        "Offer flexible payment plan options",
        "Accelerate cash collection cycles",
        "Preserve client relationships"
      ],
      link: "/solutions/professional-services"
    },
    {
      icon: Store,
      title: "Local Retail & Services",
      description: "For retail shops, service providers, and local businesses",
      benefits: [
        "Simple, automated follow-up on past-due accounts",
        "Professional outreach from your business",
        "Payment tracking and reporting",
        "Keep collection in-house"
      ],
      link: "/solutions/home-services"
    }
  ];

  return (
    <MarketingLayout>
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Solutions Built for Your Industry
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Recouply.ai helps small businesses across industries collect overdue invoices 
              without damaging customer relationships or hiring expensive collection agencies.
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

          <div className="text-center bg-card border rounded-lg p-12">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join hundreds of small businesses that have streamlined their invoice 
              collection process with AI-powered automation.
            </p>
            <Button 
              onClick={() => navigate("/signup")}
              size="lg"
            >
              Start Free Trial
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Solutions;