import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Building2, Mail, Clock, TrendingDown, CheckCircle, ArrowRight, Users, BarChart3, Shield, Zap } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";
import { Card, CardContent } from "@/components/ui/card";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { PLAN_CONFIGS, formatPrice } from "@/lib/subscriptionConfig";

const SMB = () => {
  const navigate = useNavigate();

  const capabilities = [
    {
      icon: Clock,
      title: "24/7 Follow-Up Automation",
      description: "Reminders, escalations, and follow-ups run automatically—even when you're sleeping."
    },
    {
      icon: Mail,
      title: "AI Email Reading & Response",
      description: "AI agents read customer replies, understand intent, and generate smart responses."
    },
    {
      icon: TrendingDown,
      title: "Reduce DSO by 35-50%",
      description: "Consistent, timely outreach means faster payments and improved cash flow."
    },
    {
      icon: Shield,
      title: "Never Miss an Invoice",
      description: "No more overdue balances slipping through the cracks with automated tracking."
    }
  ];

  const features = [
    "Automated dunning sequences for each aging bucket",
    "Smart escalation based on customer behavior",
    "Payment plan negotiation workflows",
    "Real-time dashboard with DSO metrics",
    "Full audit trail of all communications",
    "Integration with popular billing systems"
  ];

  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="py-20 px-4 bg-gradient-to-b from-background via-primary/5 to-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
                <Building2 className="h-4 w-4" />
                Collection Intelligence for SMBs
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Your New AR Collections Team—Powered by AI
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Stop chasing payments manually. Six AI agents handle follow-ups, reminders, and escalations 24/7—so you can focus on running your business.
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
            
            <div className="grid grid-cols-2 gap-4">
              {["sam", "james", "katy", "troy"].map((persona, idx) => (
                <Card key={persona} className="bg-card p-4 animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
                  <div className="flex flex-col items-center text-center">
                    <PersonaAvatar persona={persona} size="lg" />
                    <p className="text-xs text-muted-foreground mt-2 capitalize">{persona}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Key Capabilities */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Everything You Need to Eliminate Late Payments
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            A complete AR automation solution that works as hard as your team
          </p>
          
          <div className="grid md:grid-cols-2 gap-8">
            {capabilities.map((cap, idx) => {
              const Icon = cap.icon;
              return (
                <Card key={idx} className="bg-card">
                  <CardContent className="p-8">
                    <div className="flex gap-4">
                      <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-2">{cap.title}</h3>
                        <p className="text-muted-foreground">{cap.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features List */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Built for Operational Efficiency
          </h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            {features.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-3 p-4 bg-card rounded-lg border">
                <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Collection Intelligence Dashboard
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                AI-powered insights across accounts, communications, payments, and tasks. Know exactly where your money is and what actions will recover it fastest.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <span>DSO and aging bucket analytics</span>
                </li>
                <li className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <span>Customer payment behavior insights</span>
                </li>
                <li className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-primary" />
                  <span>Response rate and effectiveness metrics</span>
                </li>
              </ul>
            </div>
            
            <Card className="bg-card p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Current DSO</span>
                  <span className="text-2xl font-bold text-primary">32 days</span>
                </div>
                <div className="h-2 bg-muted rounded-full">
                  <div className="h-full bg-primary rounded-full" style={{ width: "65%" }}></div>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4">
                  <div className="text-center">
                    <div className="text-lg font-bold">$48K</div>
                    <p className="text-xs text-muted-foreground">Recovered</p>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">156</div>
                    <p className="text-xs text-muted-foreground">Invoices Sent</p>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">89%</div>
                    <p className="text-xs text-muted-foreground">Open Rate</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">6</div>
              <p className="text-muted-foreground">AI Agents</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">24/7</div>
              <p className="text-muted-foreground">Automation</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">35-50%</div>
              <p className="text-muted-foreground">DSO Reduction</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">{formatPrice(PLAN_CONFIGS.starter.monthlyPrice)}</div>
              <p className="text-muted-foreground">Starting Price</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Automate Your AR Operations?
          </h2>
          <p className="text-lg opacity-90 mb-8">
            Join SMBs who've reduced DSO by 40% and recovered thousands in the first month.
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

export default SMB;
