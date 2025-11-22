import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { DollarSign, Zap, Shield, Users, BarChart3, CheckCircle } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";

const Home = () => {
  const navigate = useNavigate();

  return (
    <MarketingLayout>
      <section className="py-20 px-4 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto text-center max-w-4xl">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            AI-powered AR & Collections – <br />
            <span className="text-primary">Without a Collection Agency</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Recouply.ai helps your team collect overdue invoices faster, using AI-driven workflows that protect customer relationships and keep you out of regulatory gray zones.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" onClick={() => navigate("/signup")} className="text-lg px-8">
              Start Free Trial
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/features")} className="text-lg px-8">
              See How It Works
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card p-8 rounded-lg border">
              <div className="bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Collect your own debts, with AI assistance</h3>
              <p className="text-muted-foreground">
                You remain in full control. All outreach comes from your business, not a third-party agency. Stay compliant and maintain customer trust.
              </p>
            </div>

            <div className="bg-card p-8 rounded-lg border">
              <div className="bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Users className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Customer-aware outreach with CRM context</h3>
              <p className="text-muted-foreground">
                Leverage customer data (MRR, health scores, segments) to personalize every message and preserve valuable relationships.
              </p>
            </div>

            <div className="bg-card p-8 rounded-lg border">
              <div className="bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <CheckCircle className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">No agencies. No harassment. Just clean, professional follow-up.</h3>
              <p className="text-muted-foreground">
                AI generates empathetic, compliant messages. You review and approve everything before it's sent. Simple, ethical, effective.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            How Recouply.ai Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h4 className="font-semibold mb-2 text-lg">Import Invoices & Customers</h4>
              <p className="text-muted-foreground">
                Upload your overdue invoices and customer data. Optionally sync with your CRM for richer context.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h4 className="font-semibold mb-2 text-lg">AI Generates Smart Drafts</h4>
              <p className="text-muted-foreground">
                Our AI creates personalized email and SMS messages based on customer value, payment history, and relationship health.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h4 className="font-semibold mb-2 text-lg">Review, Approve & Collect</h4>
              <p className="text-muted-foreground">
                You review every message before it goes out. Approve with one click and track payments through your own channels.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Why Businesses Choose Recouply.ai
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex gap-4">
              <Zap className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-2">AI-Powered Efficiency</h4>
                <p className="text-muted-foreground">
                  Generate professional, context-aware messages in seconds. What used to take hours now takes minutes.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <Users className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-2">Preserve Customer Relationships</h4>
                <p className="text-muted-foreground">
                  CRM-aware messaging ensures high-value customers get empathetic, relationship-preserving outreach.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <DollarSign className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-2">Direct Payment to You</h4>
                <p className="text-muted-foreground">
                  Payments go straight to your Stripe account or payment link. We never touch your funds.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <Shield className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-2">Stay Compliant</h4>
                <p className="text-muted-foreground">
                  You're not outsourcing to an agency. You remain in control, reducing regulatory risks.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <CheckCircle className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-2">Human-in-the-Loop</h4>
                <p className="text-muted-foreground">
                  Every message is reviewed and approved by your team before sending. No surprises, full transparency.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <BarChart3 className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-2">Track Everything</h4>
                <p className="text-muted-foreground">
                  Monitor outreach history, response rates, and payment status all in one dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-4xl font-bold mb-4">Ready to Recover Your Revenue?</h2>
          <p className="text-lg mb-8 opacity-90">
            Join businesses using AI to automate invoice collection professionally and effectively—without hiring a collection agency.
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

export default Home;
