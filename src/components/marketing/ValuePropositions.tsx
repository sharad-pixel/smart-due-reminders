import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Rocket, Building2, Building, CheckCircle, ArrowRight } from "lucide-react";

const ValuePropositions = () => {
  const navigate = useNavigate();

  return (
    <section className="py-24 px-4 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            Solutions
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Built for Every Stage of Growth
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Risk-aware intelligence that scales with your business—from startup to enterprise
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {/* Startups */}
          <Card className="bg-card hover:shadow-xl transition-all duration-300 cursor-pointer group border-border/50 hover:border-primary/30" onClick={() => navigate("/startups")}>
            <CardContent className="p-8">
              <div className="bg-primary/10 w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Rocket className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">For Startups</h3>
              <p className="text-lg text-muted-foreground mb-6">Visibility Into Cash Outcomes From Day One</p>
              <ul className="space-y-3 text-sm text-muted-foreground mb-6">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  Automate 100% of invoice follow-up
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  Reduce missed payments and cash crunch
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  Keep burn low with AI doing all follow-ups
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  Perfect for teams with &lt;10 employees
                </li>
              </ul>
              <Button variant="ghost" className="group-hover:text-primary p-0">
                Learn More <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardContent>
          </Card>

          {/* SMBs */}
          <Card className="bg-card hover:shadow-xl transition-all duration-300 cursor-pointer group border-primary/30 shadow-lg relative" onClick={() => navigate("/smb")}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
              <span className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg">Most Popular</span>
            </div>
            <CardContent className="p-8">
              <div className="bg-primary/10 w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">For SMBs</h3>
              <p className="text-lg text-muted-foreground mb-6">AI-Assisted Collections With Human Oversight</p>
              <ul className="space-y-3 text-sm text-muted-foreground mb-6">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  24/7 follow-up, reminders, and escalations
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  AI agents read emails and respond automatically
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  Reduce DSO by 35–50%
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  No more overdue balances slipping through
                </li>
              </ul>
              <Button variant="ghost" className="group-hover:text-primary p-0">
                Learn More <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardContent>
          </Card>

          {/* Enterprise */}
          <Card className="bg-card hover:shadow-xl transition-all duration-300 cursor-pointer group border-border/50 hover:border-primary/30" onClick={() => navigate("/enterprise")}>
            <CardContent className="p-8">
              <div className="bg-primary/10 w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Building className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">For Enterprise</h3>
              <p className="text-lg text-muted-foreground mb-6">Cross-Functional Intelligence for Finance, Sales & RevOps</p>
              <ul className="space-y-3 text-sm text-muted-foreground mb-6">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  Trained on Salesforce RCA, CS Cases, NetSuite
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  Full invoice-volume automation
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  Early-warning risk scoring
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  Enterprise governance and audit trails
                </li>
              </ul>
              <Button variant="ghost" className="group-hover:text-primary p-0">
                Learn More <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default ValuePropositions;
