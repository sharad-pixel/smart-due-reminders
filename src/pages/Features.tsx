import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Mail, MessageSquare, Users, CreditCard, CheckCircle, Bot, BarChart3, Shield } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";

const Features = () => {
  const navigate = useNavigate();

  return (
    <MarketingLayout>
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <h1 className="text-5xl font-bold mb-6">
            Powerful Features for <span className="text-primary">Professional Collections</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Everything you need to collect overdue invoices efficiently while maintaining customer relationships. Modernize your CashOps with AI-powered automation.
          </p>
        </div>
      </section>

      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Bot className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-3xl font-bold mb-4">AI Email & SMS Drafting</h2>
              <p className="text-muted-foreground mb-4">
                Our AI engine generates professional, compliant collection messages tailored to each invoice and customer. Choose from friendly, neutral, or firm tones based on your relationship and payment history.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Context-aware messaging based on days overdue</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Automatic payment link embedding</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Both email and SMS versions generated</span>
                </li>
              </ul>
            </div>
            <div className="bg-card p-8 rounded-lg border">
              <Mail className="h-12 w-12 text-primary mb-4" />
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Subject:</p>
                  <p className="font-medium">Payment Reminder: Invoice #1234 - $2,500 Due</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Body:</p>
                  <p className="text-sm">Hi John, we wanted to follow up on Invoice #1234 for $2,500, which was due on [date]...</p>
                </div>
                <MessageSquare className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">SMS:</p>
                  <p className="text-sm">Hi John, Invoice #1234 ($2,500) is past due. Pay here: [link]</p>
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
                Connect your CRM (Salesforce) to enrich customer profiles with business intelligence. Our AI adjusts messaging tone and recommendations based on customer value, health scores, and relationship status.
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
                  <span className="text-muted-foreground">Preserve relationships while collecting payment</span>
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
                <BarChart3 className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-3xl font-bold mb-4">Invoice & Debtor Management</h2>
              <p className="text-muted-foreground mb-4">
                Centralized CashOps dashboard to track all invoices, customers, and collection activities. Monitor payment status, outreach history, and upcoming follow-ups in one place.
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
                  <span className="text-muted-foreground">View complete outreach history per customer</span>
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
                <p className="text-xs text-muted-foreground mb-2">Recent Activity:</p>
                <ul className="space-y-1 text-xs">
                  <li className="flex items-center gap-2">
                    <Mail className="h-3 w-3" />
                    <span>Email sent 3 days ago</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <MessageSquare className="h-3 w-3" />
                    <span>SMS sent 7 days ago</span>
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
                Every collection message automatically includes your Stripe payment link, making it easy for customers to pay immediately. Payments go directly to your account.
              </p>
            </div>

            <div className="bg-card p-8 rounded-lg border">
              <div className="bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Human-in-the-Loop Approvals</h3>
              <p className="text-muted-foreground">
                Review and approve every AI-generated message before it's sent. Edit subject lines, body text, or discard drafts you don't want to send. You maintain complete control.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-4xl font-bold mb-4">Start Using These Features Today</h2>
          <p className="text-lg mb-8 opacity-90">
            Join businesses using AI-powered collections to recover revenue faster while maintaining customer trust.
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => navigate("/signup")}
            className="text-lg px-8"
          >
            Start Free Trial
          </Button>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Features;
