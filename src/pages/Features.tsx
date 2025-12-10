import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Mail, MessageSquare, Users, CreditCard, CheckCircle, Bot, BarChart3, Shield, Brain, Clock, TrendingUp, Heart } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";
import AIAgentRoles from "@/components/AIAgentRoles";
import { Card, CardContent } from "@/components/ui/card";

const Features = () => {
  const navigate = useNavigate();

  return (
    <MarketingLayout>
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
            AI that analyzes every touchpoint—accounts, communications, payments, tasks, and notes—to maximize your receivables recovery.
          </p>
          <p className="text-lg text-primary font-medium">
            "Collection intelligence that improves with every interaction."
          </p>
        </div>
      </section>

      {/* Agent Roles Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-4">Six Specialized Agent Roles</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Each agent uses machine learning to improve tone, timing, routing, and sequences—evolving based on engagement, past payments, customer sentiment, and time-of-day responses
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
                Six specialized AI agents generate professional, compliant messages tailored to each invoice and customer. Each agent learns from responses, payment outcomes, and engagement patterns—automatically improving recovery rates over time.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Context-aware messaging based on days overdue</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Automatic tone and frequency optimization</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Continuous learning from every interaction</span>
                </li>
              </ul>
            </div>
            <div className="bg-card p-8 rounded-lg border">
              <Brain className="h-12 w-12 text-primary mb-4" />
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Intelligence That Compounds:</p>
                  <p className="font-medium">Each agent analyzes customer responses, payment patterns, and message effectiveness to optimize future outreach automatically.</p>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Result:</p>
                  <p className="text-sm">Higher recovery rates, reduced churn risk, and stronger cash flow—improving with every invoice.</p>
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
                Connect your CRM (Salesforce) to enrich customer profiles with business intelligence. Our AI agents adjust messaging tone and recommendations based on customer value, health scores, and relationship status—preserving your most valuable relationships.
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
                Centralized command center with AI-powered insights across all accounts, invoices, and communications. Monitor risk scores, payment patterns, communication sentiment, and task resolution in one place.
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
                Review and approve every AI-generated message before it's sent. Edit subject lines, body text, or discard drafts you don't want to send. You maintain complete control while the AI does the heavy lifting.
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
              <h3 className="text-2xl font-bold mb-3">24/7 Automated Follow-Up</h3>
              <p className="text-muted-foreground">
                Our six AI agents work around the clock, automatically scheduling and sending follow-ups at optimal times. No more manual reminders or missed opportunities.
              </p>
            </div>

            <div className="bg-card p-8 rounded-lg border">
              <div className="bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Brain className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Predictive Intelligence</h3>
              <p className="text-muted-foreground">
                As our agents learn from your customers' behavior, they become more accurate and predictive—identifying which accounts need attention and optimizing recovery strategies automatically.
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
                    AI analyzes every touchpoint—account data, inbound communications, payment history, task resolutions, and notes—to continuously improve recovery strategies.
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">Account intelligence: payment patterns, risk factors, and collection history</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">Communication intelligence: sentiment analysis, response patterns, and engagement</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">Task intelligence: resolution effectiveness, team performance, and follow-up optimization</span>
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
            AI that analyzes every touchpoint—accounts, communications, payments, tasks, and notes.
          </p>
          <p className="text-md mb-8 opacity-80">
            "Collection intelligence that improves with every interaction. Maximize recovery with AI-powered insights."
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