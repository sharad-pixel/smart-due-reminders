import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Building, Shield, Brain, TrendingUp, CheckCircle, ArrowRight, Database, AlertTriangle, FileText, Users, Lock, Globe } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";
import { Card, CardContent } from "@/components/ui/card";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { personaConfig } from "@/lib/personaConfig";
import SEO from "@/components/SEO";

const Enterprise = () => {
  const navigate = useNavigate();

  const capabilities = [
    {
      icon: Database,
      title: "D&B-Level PAYDEX Credit Scoring",
      description: "Enterprise-grade credit intelligence with 1–100 PAYDEX-style scoring based on weighted payment experiences, trend analysis, and behavioral signals."
    },
    {
      icon: Brain,
      title: "Expansion Risk Intelligence",
      description: "Credit limit recommendations and payment trend forecasting to inform safe expansion decisions—know which accounts can handle increased credit before you extend it."
    },
    {
      icon: AlertTriangle,
      title: "Predictive Risk Assessment",
      description: "Multi-factor scoring analyzes invoice behavior (50%), payment patterns (20%), customer health (15%), and operational signals (15%) to predict delinquency risk."
    },
    {
      icon: Shield,
      title: "Enterprise Governance & Audit",
      description: "Full audit trails, role-based access, and compliance-ready documentation for every credit decision."
    }
  ];

  const integrations = [
    "Salesforce Revenue Cloud / RCA",
    "NetSuite AR",
    "SAP",
    "QuickBooks Enterprise",
    "Zendesk / Intercom (CS Cases)",
    "Custom API integrations"
  ];

  const securityFeatures = [
    { icon: Lock, title: "SOC 2 Type II Compliant", description: "Enterprise-grade security infrastructure" },
    { icon: FileText, title: "Full Audit Trails", description: "Every action logged and traceable" },
    { icon: Users, title: "Role-Based Access Control", description: "Granular permissions for your team" },
    { icon: Globe, title: "Data Residency Options", description: "Control where your data lives" }
  ];

  return (
    <MarketingLayout>
      <SEO
        title="Enterprise AR Automation | High-Volume Collection Intelligence"
        description="AI collection intelligence for enterprise—handle 10,000+ invoices monthly with Salesforce, NetSuite integration. Enterprise governance, audit trails, and risk scoring."
        canonical="https://recouply.ai/enterprise"
        keywords="enterprise AR automation, high volume collections, Salesforce AR integration, NetSuite collections, enterprise invoice management"
      />
      {/* Hero */}
      <section className="py-20 px-4 bg-gradient-to-b from-background via-primary/5 to-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
                <Building className="h-4 w-4" />
                Enterprise AR Intelligence
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Enterprise AR & Collection Intelligence for High Volume
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Built for enterprise companies processing thousands of invoices monthly. AI agents trained on your CRM data, CS cases, and AR history—automating high-volume accounts receivable with enterprise-grade security and governance.
              </p>
              <div className="flex gap-4 flex-wrap">
                <Button size="lg" onClick={() => navigate("/contact-us")} className="text-lg px-8">
                  Contact Sales
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => window.open("https://calendly.com/sharad-recouply/30min", "_blank")}>
                  Book a Demo
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              {Object.keys(personaConfig).map((persona, idx) => (
                <Card key={persona} className="bg-card p-3 animate-fade-in" style={{ animationDelay: `${idx * 80}ms` }}>
                  <div className="flex flex-col items-center text-center">
                    <PersonaAvatar persona={persona} size="md" />
                    <p className="text-xs text-muted-foreground mt-1 capitalize">{persona}</p>
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
            Credit Intelligence That Protects Growth
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            D&B-level credit scoring and risk intelligence to mitigate exposure on customer expansions and new credit decisions
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

      {/* Integration Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Deep Integration with Your Tech Stack
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                AI agents learn from your existing systems to deliver contextually aware, relationship-preserving outreach at scale.
              </p>
              
              <div className="space-y-3">
                {integrations.map((integration, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                    <span>{integration}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <Card className="bg-card p-8">
              <h3 className="font-bold mb-6">Credit Intelligence Signals:</h3>
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="font-semibold">PAYDEX Score (1–100)</p>
                  <p className="text-sm text-muted-foreground">Weighted payment experiences with recency bias for accurate credit ratings</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="font-semibold">Payment Trend Analysis</p>
                  <p className="text-sm text-muted-foreground">Improving, Stable, or Declining patterns over rolling 6-month windows</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="font-semibold">Credit Limit Recommendations</p>
                  <p className="text-sm text-muted-foreground">Data-driven limits based on historical high credit and risk multipliers</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="font-semibold">Expansion Risk Score</p>
                  <p className="text-sm text-muted-foreground">Multi-factor assessment before extending additional credit or terms</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Security & Compliance */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Enterprise Security & Compliance
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Built for teams that require the highest standards of data protection
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {securityFeatures.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <Card key={idx} className="bg-card">
                  <CardContent className="p-6 text-center">
                    <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
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

      {/* Automated Dunning Strategies */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <Card className="bg-card p-6">
              <h3 className="font-bold mb-4">Automated Dunning Flow</h3>
              <div className="space-y-3">
                {["sam", "james", "katy", "troy", "jimmy", "rocco"].map((persona, idx) => (
                  <div key={persona} className="flex items-center gap-3 p-2 bg-muted/30 rounded">
                    <PersonaAvatar persona={persona} size="sm" />
                    <div className="flex-1">
                      <p className="text-sm font-medium capitalize">{persona}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">Day {idx * 30 + 1}-{(idx + 1) * 30}</span>
                  </div>
                ))}
              </div>
            </Card>
            
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Automated Dunning Strategies
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                AI agents automatically escalate tone and urgency based on invoice age, customer value, and relationship context—all while preserving important business relationships.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <span>Context-aware messaging based on CS cases and account health</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <span>Automatic escalation paths with human approval gates</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <span>Early risk prediction to prevent delinquency</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-5 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">PAYDEX</div>
              <p className="text-muted-foreground">Credit Scoring</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">1–100</div>
              <p className="text-muted-foreground">Score Range</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">4</div>
              <p className="text-muted-foreground">Risk Factors</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">SOC 2</div>
              <p className="text-muted-foreground">Compliant</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">Real-Time</div>
              <p className="text-muted-foreground">Risk Updates</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready for Enterprise AR Intelligence?
          </h2>
          <p className="text-lg opacity-90 mb-8">
            Built for enterprise companies with complex, high-volume AR needs. Let's discuss how Recouply.ai can automate your accounts receivable at scale.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" variant="secondary" onClick={() => navigate("/contact-us")} className="text-lg px-8">
              Contact Sales
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

export default Enterprise;
