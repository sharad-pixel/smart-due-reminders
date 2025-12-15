import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Mail, MessageSquare, Users, CreditCard, CheckCircle, Bot, BarChart3, Shield, Brain, Clock, TrendingUp, Heart } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";
import AIAgentRoles from "@/components/AIAgentRoles";
import { Card, CardContent } from "@/components/ui/card";
import SEO from "@/components/SEO";

const Features = () => {
  const navigate = useNavigate();

  return (
    <MarketingLayout>
      <SEO
        title="AI Collection Features | Accounts Receivable Automation"
        description="Six AI agents power your collection intelligence—automating invoice follow-ups, learning payment behavior, and adapting tone based on real-time signals. Human-approved outreach."
        canonical="https://recouply.ai/features"
        keywords="AI collection agents, AR automation features, invoice follow-up automation, payment behavior analysis, collection workflows"
      />
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
            <Brain className="h-4 w-4" />
            Collection Intelligence Platform
          </div>
          <h1 className="text-5xl font-bold mb-6">
            Six AI Agents Powering Your <span className="text-primary">Collection Intelligence</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-4">
            AI-assisted agents that learn from payment behavior, communication signals, and account context—helping you act earlier, recover smarter.
          </p>
          <p className="text-lg text-primary font-medium">
            "Intelligence that compounds with every interaction. Human-approved, risk-aware."
          </p>
        </div>
      </section>

      {/* Agent Roles Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-4">Six Specialized Agent Roles</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Each agent learns from engagement, payment patterns, and sentiment—adapting tone and timing while you stay in control
          </p>
          <AIAgentRoles />
        </div>
      </section>

      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Bot className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-3xl font-bold mb-4">AI Agents That Learn & Adapt</h2>
              <p className="text-muted-foreground mb-4">
                Six specialized agents generate context-aware messages, reviewed before sending. Each learns from responses and payment outcomes—improving recovery with every interaction while you maintain oversight.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Context-aware messaging guided by real-time signals</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Tone optimization aligned with account risk and value</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Continuous learning with human approval at every step</span>
                </li>
              </ul>
            </div>
            <div className="bg-card p-8 rounded-lg border">
              <Brain className="h-12 w-12 text-primary mb-4" />
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Intelligence That Compounds:</p>
                  <p className="font-medium">Each agent synthesizes payment patterns, response signals, and account context to inform better decisions over time.</p>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Outcome:</p>
                  <p className="text-sm">Designed to support predictable cash flow, reduced churn risk, and stronger recovery—improving with every touchpoint.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1 bg-card p-8 rounded-lg border">
              <Users className="h-12 w-12 text-primary mb-4" />
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="font-medium">Acme Corp</span>
                  <span className="text-sm text-muted-foreground">MRR: $5,000</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Segment:</span>
                    <span className="text-sm font-medium">Enterprise</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Health Score:</span>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      At Risk
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Lifetime Value:</span>
                    <span className="text-sm font-medium">$120,000</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <div className="bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Users className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-3xl font-bold mb-4">Customer-Aware Outreach with CRM Context</h2>
              <p className="text-muted-foreground mb-4">
                Connect your CRM to enrich account context with relationship signals. Agents adjust tone based on customer value and health—preserving relationships while guiding timely recovery.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Automatic tone adjustment for high-value accounts</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Empathetic messaging for at-risk customers</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Preserve relationships while recovering payment</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Brain className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-3xl font-bold mb-4">Collection Intelligence Dashboard</h2>
              <p className="text-muted-foreground mb-4">
                Centralized visibility into risk signals, payment patterns, and communication sentiment. Monitor what matters and surface the actions that will move the needle.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Import invoices individually or in bulk</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Track invoice status (Open, Paid, Disputed, etc.)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">View complete AI agent activity per customer</span>
                </li>
              </ul>
            </div>
            <div className="bg-card p-8 rounded-lg border space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">Invoice #1234</span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Open
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-medium">$2,500</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Due Date:</span>
                <span className="font-medium">15 days overdue</span>
              </div>
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">AI Agent Activity:</p>
                <ul className="space-y-1 text-xs">
                  <li className="flex items-center gap-2">
                    <Mail className="h-3 w-3" />
                    <span>Sam sent reminder 3 days ago</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <MessageSquare className="h-3 w-3" />
                    <span>James follow-up scheduled</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-card p-8 rounded-lg border">
              <div className="bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <CreditCard className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Payment Link Embedding (Stripe)</h3>
              <p className="text-muted-foreground">
                Every AI-generated message automatically includes your Stripe payment link, making it easy for customers to pay immediately. Payments go directly to your account—we never touch your funds.
              </p>
            </div>

            <div className="bg-card p-8 rounded-lg border">
              <div className="bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Human-in-the-Loop Approvals</h3>
              <p className="text-muted-foreground">
                Review and approve every AI-generated message before it's sent. Edit, refine, or discard—you maintain complete control while intelligence scales behind the scenes.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-card p-8 rounded-lg border">
              <div className="bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Clock className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">24/7 Risk-Aware Follow-Up</h3>
              <p className="text-muted-foreground">
                Six agents work around the clock, scheduling outreach at optimal times based on engagement signals. Proactive follow-ups, guided by context—so no opportunity slips through.
              </p>
            </div>

            <div className="bg-card p-8 rounded-lg border">
              <div className="bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Brain className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Proactive Intelligence</h3>
              <p className="text-muted-foreground">
                As agents learn from payment behavior, they surface accounts that need attention before risk compounds—helping you act earlier and recover smarter.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Learning Intelligence */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <Card className="bg-gradient-to-br from-primary/5 to-secondary/5">
            <CardContent className="p-8">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h2 className="text-3xl font-bold mb-4">Collection Intelligence That Compounds</h2>
                  <p className="text-muted-foreground mb-6">
                    Every touchpoint—account signals, inbound communications, payment patterns, task resolutions—feeds intelligence that helps teams act earlier and recover smarter.
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">Account intelligence: payment behavior, risk signals, and collection context</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">Communication intelligence: sentiment, response patterns, and engagement signals</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">Task intelligence: resolution effectiveness, follow-up optimization, and team alignment</span>
                    </li>
                  </ul>
                </div>
                <div className="text-center">
                  <div className="inline-block p-6 bg-card rounded-2xl border">
                    <Brain className="w-16 h-16 text-primary mx-auto mb-4" />
                    <p className="text-xl font-bold mb-2">Collection Intelligence Platform</p>
                    <p className="text-sm text-muted-foreground">Every touchpoint analyzed to maximize recovery</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-4xl font-bold mb-4">Experience Collection Intelligence Today</h2>
          <p className="text-lg mb-4 opacity-90">
            AI-assisted agents that learn from every touchpoint—guided by signals, approved by you.
          </p>
          <p className="text-md mb-8 opacity-80">
            "Designed to support predictable cash flow with human oversight at every step."
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate("/signup")}
              className="text-lg px-8"
            >
              Start Free Trial
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => window.open("https://calendly.com/sharad-recouply/30min", "_blank")}
              className="text-lg px-8 bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10"
            >
              Book a Demo
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Features;