import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Rocket, DollarSign, Clock, TrendingUp, CheckCircle, ArrowRight, Zap, Target, BarChart3 } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";
import { Card, CardContent } from "@/components/ui/card";
import { PersonaAvatar } from "@/components/PersonaAvatar";

const Startups = () => {
  const navigate = useNavigate();

  const benefits = [
    {
      icon: DollarSign,
      title: "Protect Your Runway",
      description: "Reduce missed payments and cash crunch with automated follow-ups that never forget."
    },
    {
      icon: Clock,
      title: "Zero Finance Hires Needed",
      description: "Get a complete AR team for less than the cost of a single part-time employee."
    },
    {
      icon: TrendingUp,
      title: "Faster Cash Recovery",
      description: "AI agents start working immediately—recover revenue in days, not weeks."
    },
    {
      icon: Target,
      title: "Focus on Growth",
      description: "Let AI handle collections while your team focuses on building and selling."
    }
  ];

  const useCases = [
    "SaaS startups with monthly/annual billing",
    "Agencies billing clients on milestones",
    "B2B service providers with net terms",
    "E-commerce companies with wholesale accounts"
  ];

  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="py-20 px-4 bg-gradient-to-b from-background via-primary/5 to-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
                <Rocket className="h-4 w-4" />
                For Startups
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Grow Faster Without Hiring a Finance Team
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Automate 100% of invoice follow-up with AI agents that work 24/7—keeping your burn low while recovering every dollar owed.
              </p>
              <div className="flex gap-4 flex-wrap">
                <Button size="lg" onClick={() => navigate("/signup")} className="text-lg px-8">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/pricing")}>
                  View Pricing
                </Button>
              </div>
            </div>
            
            <div className="flex flex-wrap justify-center gap-4">
              {["sam", "james", "katy"].map((persona, idx) => (
                <div key={persona} className="animate-fade-in" style={{ animationDelay: `${idx * 150}ms` }}>
                  <Card className="bg-card p-4">
                    <PersonaAvatar persona={persona} size="xl" showName />
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Why Startups Choose Recouply.ai
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Perfect for teams with &lt;10 employees who can't afford dedicated AR staff
          </p>
          
          <div className="grid md:grid-cols-2 gap-8">
            {benefits.map((benefit, idx) => {
              const Icon = benefit.icon;
              return (
                <Card key={idx} className="bg-card">
                  <CardContent className="p-8">
                    <div className="flex gap-4">
                      <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-2">{benefit.title}</h3>
                        <p className="text-muted-foreground">{benefit.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works for Startups */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Get Started in Minutes
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">1</div>
              <h4 className="font-semibold mb-2 text-lg">Import Your Invoices</h4>
              <p className="text-muted-foreground">CSV upload or sync with your billing system. Takes 5 minutes.</p>
            </div>
            
            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">2</div>
              <h4 className="font-semibold mb-2 text-lg">AI Agents Take Over</h4>
              <p className="text-muted-foreground">Automated outreach starts immediately based on invoice age.</p>
            </div>
            
            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">3</div>
              <h4 className="font-semibold mb-2 text-lg">Watch Cash Flow In</h4>
              <p className="text-muted-foreground">Review, approve messages, and see payments arrive faster.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Perfect For
          </h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            {useCases.map((useCase, idx) => (
              <div key={idx} className="flex items-center gap-3 p-4 bg-card rounded-lg border">
                <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                <span>{useCase}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">$99</div>
              <p className="text-muted-foreground">Starting monthly price</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">35-50%</div>
              <p className="text-muted-foreground">Average DSO reduction</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">24/7</div>
              <p className="text-muted-foreground">AI agents working</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Stop Chasing Invoices. Start Growing.
          </h2>
          <p className="text-lg opacity-90 mb-8">
            Join startups who've automated their collections and recovered thousands in the first month.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" variant="secondary" onClick={() => navigate("/signup")} className="text-lg px-8">
              Get Started for Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10" onClick={() => window.open("https://calendly.com/sharad-recouply/30min", "_blank")}>
              Book a Demo
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Startups;
