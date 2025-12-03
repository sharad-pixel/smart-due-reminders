import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { DollarSign, Zap, Shield, Users, BarChart3, CheckCircle, Brain, Clock, TrendingUp, Mail, AlertTriangle, Target, ArrowRight, Building2, Rocket, Building } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { personaConfig } from "@/lib/personaConfig";
import { Card, CardContent } from "@/components/ui/card";

const Home = () => {
  const navigate = useNavigate();

  const features = [
    { icon: Users, title: "Multi-Agent Workflow Automation", description: "6 specialized AI collectors working in sync" },
    { icon: Mail, title: "AI Email Reading + Smart Response", description: "Automatically reads and responds to customer emails" },
    { icon: Target, title: "Invoice & Debtor-Level Routing", description: "Smart routing based on customer value and history" },
    { icon: AlertTriangle, title: "Risk Scoring & Early Warning", description: "Proactive alerts before accounts go delinquent" },
    { icon: DollarSign, title: "Payment Plan Negotiation", description: "AI-assisted payment arrangement workflows" },
    { icon: Clock, title: "Aging Bucket Automation", description: "Automated escalation based on days past due" },
    { icon: BarChart3, title: "Real-time Dashboard", description: "Cash Operations HQ with full visibility" },
    { icon: Brain, title: "Full Message History + AI Summary", description: "Complete audit trail with intelligent summaries" },
  ];

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-background via-primary/5 to-muted/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-30"></div>
        <div className="container mx-auto text-center max-w-5xl relative z-10">
          <div className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
            AI-Powered Cash Operations Platform
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            AI-Powered Cash Operations for <br />
            <span className="text-primary">Startups, SMBs & Enterprise</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-4 max-w-3xl mx-auto">
            Six AI Collection Agents working 24/7 to recover payments, reduce DSO, and protect cash flow—for less than the cost of one employee.
          </p>
          
          {/* AI Agent Avatars */}
          <TooltipProvider delayDuration={100}>
            <div className="flex justify-center items-center gap-4 md:gap-6 flex-wrap my-8">
              {Object.values(personaConfig).map((persona, index) => (
                <Tooltip key={persona.name}>
                  <TooltipTrigger asChild>
                    <div 
                      className="hover-scale cursor-pointer animate-fade-in transition-all duration-300"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="p-3 rounded-2xl bg-card border-2 border-transparent hover:border-primary/20 hover:shadow-xl transition-all duration-300">
                        <PersonaAvatar persona={persona} size="lg" />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs p-4 bg-card border-2">
                    <div className="space-y-2">
                      <h4 className="font-bold text-lg">{persona.name}</h4>
                      <p className="text-sm font-medium" style={{ color: persona.color }}>{persona.description}</p>
                      <p className="text-xs text-muted-foreground italic">"{persona.tone}"</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
          
          <p className="text-sm text-muted-foreground mb-8">
            <span className="inline-block w-2 h-2 bg-accent rounded-full animate-pulse mr-2"></span>
            These agents work 24/7 so you don't have to
          </p>
          
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" onClick={() => navigate("/signup")} className="text-lg px-8">
              Try Recouply.ai
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/features")} className="text-lg px-8">
              See How It Works
            </Button>
          </div>
        </div>
      </section>

      {/* Value Proposition - Segment Specific */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Built for Every Stage of Growth
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Whether you're a startup, SMB, or enterprise—Recouply.ai scales with your needs
          </p>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Startups */}
            <Card className="bg-card hover:shadow-lg transition-all cursor-pointer group" onClick={() => navigate("/startups")}>
              <CardContent className="p-8">
                <div className="bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                  <Rocket className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">For Startups</h3>
                <p className="text-lg text-muted-foreground mb-4">Grow Faster Without Hiring a Finance Team</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
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
                <Button variant="ghost" className="mt-4 group-hover:text-primary">
                  Learn More <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            {/* SMBs */}
            <Card className="bg-card hover:shadow-lg transition-all cursor-pointer group border-primary/20" onClick={() => navigate("/smb")}>
              <CardContent className="p-8">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">Most Popular</span>
                </div>
                <div className="bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">For SMBs</h3>
                <p className="text-lg text-muted-foreground mb-4">Your New AR Collections Team—Powered by AI</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
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
                <Button variant="ghost" className="mt-4 group-hover:text-primary">
                  Learn More <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            {/* Enterprise */}
            <Card className="bg-card hover:shadow-lg transition-all cursor-pointer group" onClick={() => navigate("/enterprise")}>
              <CardContent className="p-8">
                <div className="bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                  <Building className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">For Enterprise</h3>
                <p className="text-lg text-muted-foreground mb-4">Scale Cash Operations Without Increasing Headcount</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
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
                <Button variant="ghost" className="mt-4 group-hover:text-primary">
                  Learn More <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Everything You Need to Automate Collections
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            A complete Cash Operations platform powered by AI
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <Card key={idx} className="bg-card hover:shadow-md transition-all">
                  <CardContent className="p-6">
                    <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="font-semibold mb-2">{feature.title}</h4>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* AI Agent Marketing Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-muted/10 to-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
              Meet Your AI Team
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Six Specialized Collection Agents
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Each agent adapts their tone and approach based on invoice age and customer context
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <PersonaAvatar persona="sam" size="md" />
                  <div>
                    <h4 className="font-bold">Sam</h4>
                    <p className="text-xs text-muted-foreground">0-30 Days</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Polite & Friendly—gentle reminders that maintain relationships</p>
              </CardContent>
            </Card>
            
            <Card className="bg-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <PersonaAvatar persona="james" size="md" />
                  <div>
                    <h4 className="font-bold">James</h4>
                    <p className="text-xs text-muted-foreground">31-60 Days</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Professional Billing Specialist—direct but respectful</p>
              </CardContent>
            </Card>
            
            <Card className="bg-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <PersonaAvatar persona="katy" size="md" />
                  <div>
                    <h4 className="font-bold">Katy</h4>
                    <p className="text-xs text-muted-foreground">61-90 Days</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Empathetic Customer Success tone—understanding but firm</p>
              </CardContent>
            </Card>
            
            <Card className="bg-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <PersonaAvatar persona="troy" size="md" />
                  <div>
                    <h4 className="font-bold">Troy</h4>
                    <p className="text-xs text-muted-foreground">91-120 Days</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Firm but respectful—clear urgency with professionalism</p>
              </CardContent>
            </Card>
            
            <Card className="bg-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <PersonaAvatar persona="gotti" size="md" />
                  <div>
                    <h4 className="font-bold">Gotti</h4>
                    <p className="text-xs text-muted-foreground">121-150 Days</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Aggressive collection persona—serious escalation warnings</p>
              </CardContent>
            </Card>
            
            <Card className="bg-card border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-primary/10 w-10 h-10 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold">Watchdog</h4>
                    <p className="text-xs text-muted-foreground">Risk Monitor</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Proactive risk monitoring and early detection—prevents delinquency</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="text-center mt-8">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-6 py-3 rounded-full">
              <span className="inline-block w-2 h-2 bg-accent rounded-full animate-pulse"></span>
              These agents work 24/7 so you don't have to
            </div>
          </div>
        </div>
      </section>

      {/* Why Recouply.ai is Different */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Why Recouply.ai is Different
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Built on modern AI workflows that continuously improve
          </p>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex gap-4">
              <Brain className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-2">Built on Modern AI Workflows</h4>
                <p className="text-muted-foreground">Purpose-built for collections with intelligent automation at every step.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <Mail className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-2">Captures Full Inbound Email Body</h4>
                <p className="text-muted-foreground">Reads, understands, and classifies intent from every customer response.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <Target className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-2">Automatically Generates Follow-up Tasks</h4>
                <p className="text-muted-foreground">AI extracts action items and creates tasks for your team.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <TrendingUp className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-2">Learns From Every Interaction</h4>
                <p className="text-muted-foreground">Improves collections efficiency every month based on outcomes.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <Shield className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-2">Reduces Human Error</h4>
                <p className="text-muted-foreground">Eliminates inconsistent follow-up and missed opportunities.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <Zap className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-2">Intelligence That Compounds</h4>
                <p className="text-muted-foreground">Your agents get smarter every day, driving higher recovery rates.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Why Teams Love Recouply.ai
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <Card className="bg-card">
              <CardContent className="p-8">
                <div className="text-4xl mb-4">"</div>
                <p className="text-lg mb-4">Recouply.ai replaced 80% of our manual AR tasks in the first 30 days.</p>
                <p className="text-sm text-muted-foreground">— AR Manager, SaaS Company</p>
              </CardContent>
            </Card>
            
            <Card className="bg-card">
              <CardContent className="p-8">
                <div className="text-4xl mb-4">"</div>
                <p className="text-lg mb-4">Our DSO dropped by 40% and we didn't have to hire a single new person.</p>
                <p className="text-sm text-muted-foreground">— CFO, Professional Services</p>
              </CardContent>
            </Card>
            
            <Card className="bg-card">
              <CardContent className="p-8">
                <div className="text-4xl mb-4">"</div>
                <p className="text-lg mb-4">The AI agents learn from our customer base. Recovery rates improve every month.</p>
                <p className="text-sm text-muted-foreground">— RevOps Leader, B2B Company</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-50">
            <div className="h-8 w-24 bg-muted-foreground/20 rounded"></div>
            <div className="h-8 w-32 bg-muted-foreground/20 rounded"></div>
            <div className="h-8 w-28 bg-muted-foreground/20 rounded"></div>
            <div className="h-8 w-24 bg-muted-foreground/20 rounded"></div>
            <div className="h-8 w-30 bg-muted-foreground/20 rounded"></div>
          </div>
          
          <div className="text-center mt-8">
            <p className="text-sm text-muted-foreground">
              <Shield className="inline h-4 w-4 mr-1" />
              Full audit trails • SOC 2 compliant infrastructure • Your data stays yours
            </p>
          </div>
        </div>
      </section>

      {/* Pricing CTA Banner */}
      <section className="py-16 px-4 bg-gradient-to-r from-primary to-primary/80">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
            Automate Collections for Less Than the Cost of One Employee
          </h2>
          <p className="text-lg text-primary-foreground/90 mb-8">
            Starts at $99/mo. Scales to Enterprise. 6 AI agents included.
          </p>
          <Button size="lg" variant="secondary" onClick={() => navigate("/pricing")} className="text-lg px-8">
            View Pricing Plans
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 bg-background">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-4xl font-bold mb-4">Ready to Strengthen Your Cash Flow?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Start recovering more revenue today with AI Collections.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" onClick={() => navigate("/signup")} className="text-lg px-8">
              Get Started for Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => window.open("https://calendly.com/sharad-recouply/30min", "_blank")} className="text-lg px-8">
              Book a Demo
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Home;
