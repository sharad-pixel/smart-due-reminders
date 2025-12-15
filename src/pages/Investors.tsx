import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RecouplyLogo } from "@/components/RecouplyLogo";
import { founderConfig } from "@/lib/founderConfig";
import founderPhoto from "@/assets/founder-sharad-cartoon.png";
import { 
  Brain, 
  TrendingUp, 
  Target, 
  Shield, 
  Zap, 
  BarChart3,
  ArrowRight,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  Building2,
  Globe,
  Sparkles,
  Eye,
  FileText,
  Users
} from "lucide-react";
import { Link } from "react-router-dom";

const Investors = () => {
  const scrollToContact = () => {
    document.getElementById('investor-contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/">
            <RecouplyLogo size="md" />
          </Link>
          <Button onClick={scrollToContact} className="gap-2">
            Request Info <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-3xl opacity-50" />
        
        <div className="container relative z-10 mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Building2 className="h-4 w-4" />
              Investment Opportunities
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              Building the <span className="text-primary">Collection Intelligence Platform</span> for a $70T Receivables Market
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Every year, over $70 trillion in B2B receivables flows through global businesses. Recouply.ai brings Collection Intelligence, continuous risk assessment, and AI-driven execution to one of the most critical—and least modernized—parts of the revenue lifecycle.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" className="text-lg px-8 py-6 gap-2" onClick={scrollToContact}>
                Explore Investment Opportunities
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Private investment opportunities available. Long-term partners only.
            </p>
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Receivables Is One of the Largest Untapped Financial Systems
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-12">
              <Card className="border-destructive/20 bg-card">
                <CardContent className="pt-6 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-destructive" />
                  </div>
                  <p className="text-muted-foreground">
                    B2B receivables exceed <span className="font-semibold text-foreground">$70T annually</span>, yet collections workflows remain largely manual and reactive.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-destructive/20 bg-card">
                <CardContent className="pt-6 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                    <Eye className="h-6 w-6 text-destructive" />
                  </div>
                  <p className="text-muted-foreground">
                    Most companies lack <span className="font-semibold text-foreground">real-time visibility</span> into receivables risk, DSO drivers, and collection performance.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-destructive/20 bg-card">
                <CardContent className="pt-6 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-destructive" />
                  </div>
                  <p className="text-muted-foreground">
                    Existing solutions focus on <span className="font-semibold text-foreground">recording transactions</span>, not intelligent decision-making.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-destructive/20 bg-card">
                <CardContent className="pt-6 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                  </div>
                  <p className="text-muted-foreground">
                    Collections impacts cash flow, working capital, and financial stability, yet is treated as a <span className="font-semibold text-foreground">back-office afterthought</span>.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-8 text-center">
              <p className="text-xl font-medium text-foreground italic">
                "Cash is the lifeblood of a business—but the systems managing it are decades behind."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Solution Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <div className="inline-flex items-center gap-2 text-primary font-medium">
                <Brain className="h-5 w-5" />
                The Solution
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Recouply.ai Introduces Collection Intelligence
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Recouply.ai is a Collection Intelligence Platform that continuously assesses receivables risk, prioritizes action, and automates engagement—turning static AR data into real-time, actionable intelligence.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <Card className="border-primary/20 bg-card">
                <CardContent className="pt-6 text-center space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Continuous Risk Assessment</h3>
                  <p className="text-sm text-muted-foreground">
                    At the invoice, account, and portfolio level
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-card">
                <CardContent className="pt-6 text-center space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">AI-driven Prioritization</h3>
                  <p className="text-sm text-muted-foreground">
                    Based on payment behavior, aging, and engagement
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-card">
                <CardContent className="pt-6 text-center space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Automated Workflows</h3>
                  <p className="text-sm text-muted-foreground">
                    Outbound and inbound collections automation
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-card">
                <CardContent className="pt-6 text-center space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Real-time Visibility</h3>
                  <p className="text-sm text-muted-foreground">
                    DSO, aging, and cash-flow insights
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-card">
                <CardContent className="pt-6 text-center space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Audit-ready Trails</h3>
                  <p className="text-sm text-muted-foreground">
                    Compliance-friendly communication workflows
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-card">
                <CardContent className="pt-6 text-center space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Globe className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">System Integration</h3>
                  <p className="text-sm text-muted-foreground">
                    Complements CPQ, Billing, and RevRec systems
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Why Now Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <div className="inline-flex items-center gap-2 text-primary font-medium">
                <Clock className="h-5 w-5" />
                Timing & Inflection Point
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Why Collection Intelligence Matters Now
              </h2>
            </div>

            <div className="space-y-4">
              {[
                "CFOs and finance leaders demand predictable cash flow, not just revenue growth",
                "AI makes real-time risk modeling and automation possible for the first time",
                "Economic volatility has increased focus on working capital efficiency",
                "Traditional collection agencies and AR tools are not built for scale or intelligence"
              ].map((item, index) => (
                <div key={index} className="flex items-start gap-4 p-4 bg-card rounded-lg border border-border">
                  <CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-foreground">{item}</p>
                </div>
              ))}
            </div>

            <div className="bg-primary text-primary-foreground rounded-xl p-8 text-center mt-12">
              <p className="text-xl font-medium italic">
                "The next financial system to be modernized isn't payments—it's receivables."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Market Opportunity Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <div className="inline-flex items-center gap-2 text-primary font-medium">
                <TrendingUp className="h-5 w-5" />
                TAM / Category Creation
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                A Massive Market Hiding in Plain Sight
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                <CardContent className="pt-6 text-center space-y-2">
                  <p className="text-4xl font-bold text-primary">$70T+</p>
                  <p className="text-sm text-muted-foreground">
                    B2B receivables generated annually
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                <CardContent className="pt-6 text-center space-y-2">
                  <p className="text-4xl font-bold text-primary">$20B+</p>
                  <p className="text-sm text-muted-foreground">
                    Addressable software & operations market
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                <CardContent className="pt-6 text-center space-y-2">
                  <p className="text-4xl font-bold text-primary">New</p>
                  <p className="text-sm text-muted-foreground">
                    Category: Collection Intelligence
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="bg-muted/50 border border-border rounded-xl p-8 text-center">
              <p className="text-lg font-medium text-foreground">
                We are not replacing collection agencies—<span className="text-primary">we are replacing the need for them.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Competitive Advantage Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <div className="inline-flex items-center gap-2 text-primary font-medium">
                <Sparkles className="h-5 w-5" />
                Competitive Advantage
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Why Recouply.ai Wins
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {[
                "Intelligence-first, not workflow-first",
                "Risk assessment embedded directly into execution",
                "Built by operators with deep CPQ, Billing, RevRec, and O2C experience",
                "Designed for SMB through Enterprise scale",
                "AI agents that improve with historical behavior and outcomes",
                "Modular, API-first architecture"
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-foreground font-medium">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Founder Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <div className="inline-flex items-center gap-2 text-primary font-medium">
                <Users className="h-5 w-5" />
                Founder & Vision
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Built by Operators Who've Lived the Problem
              </h2>
            </div>

            <Card className="border-primary/20 overflow-hidden">
              <CardContent className="p-0">
                <div className="md:flex">
                  <div className="md:w-1/3 bg-gradient-to-br from-primary/10 to-primary/5 p-8 flex flex-col items-center justify-center">
                    <div className="w-32 h-32 rounded-full bg-background border-4 border-background shadow-xl overflow-hidden mb-4">
                      <img 
                        src={founderPhoto} 
                        alt={founderConfig.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">{founderConfig.name}</h3>
                    <p className="text-sm text-muted-foreground">{founderConfig.title}</p>
                  </div>
                  <div className="md:w-2/3 p-8 space-y-6">
                    <p className="text-muted-foreground leading-relaxed">
                      Recouply.ai was founded by an operator with deep experience building CPQ, Billing, Revenue Recognition, and Order-to-Cash systems at <span className="font-semibold text-foreground">Workday</span>, <span className="font-semibold text-foreground">Contentful</span>, and <span className="font-semibold text-foreground">Leanplum</span> (now CleverTap).
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      The product was built to solve a real operational gap: <span className="font-semibold text-foreground">collections without intelligence</span>.
                    </p>
                    <div className="bg-primary/5 border-l-4 border-primary p-4 rounded-r-lg">
                      <p className="text-foreground font-medium italic">
                        "Our vision is to become the intelligence layer powering how the world manages receivables and cash flow."
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Investment Opportunity Section */}
      <section id="investor-contact" className="py-20 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 text-primary font-medium">
              <Building2 className="h-5 w-5" />
              Investment Opportunity
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Partner With Us
            </h2>
            <p className="text-lg text-muted-foreground">
              Recouply.ai is opening selective investment opportunities for partners aligned with our long-term vision of redefining receivables management.
            </p>

            <Card className="border-primary/20 bg-card text-left">
              <CardContent className="pt-6">
                <h3 className="text-xl font-semibold text-foreground mb-4">What Investors Get</h3>
                <div className="space-y-3">
                  {[
                    "Exposure to a massive, underserved market",
                    "A category-defining product at the intersection of AI and FinTech",
                    "Founder-led execution with deep domain expertise",
                    "Early participation in shaping the platform and go-to-market"
                  ].map((item, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                      <p className="text-muted-foreground">{item}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Button size="lg" className="text-lg px-8 py-6 gap-2" asChild>
                <Link to="/contact">
                  Request Investor Information
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <p className="text-sm text-muted-foreground">
                Investment opportunities are private and reviewed manually.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <RecouplyLogo size="sm" />
          </div>
          <p className="text-muted-foreground">
            Collection Intelligence with Continuous Risk Assessment for Your Receivables.
          </p>
          <div className="mt-6 flex justify-center gap-6 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary transition-colors">Home</Link>
            <Link to="/legal/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link to="/legal/terms" className="hover:text-primary transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Investors;
