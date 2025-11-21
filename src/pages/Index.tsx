import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { DollarSign, Zap, Shield, CheckCircle } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Recouply.ai</h1>
          <Button onClick={() => navigate("/auth")}>Sign In</Button>
        </div>
      </header>

      <main>
        <section className="py-20 px-4">
          <div className="container mx-auto text-center max-w-4xl">
            <h2 className="text-5xl font-bold mb-6">
              Collect Overdue Invoices with <span className="text-primary">AI Automation</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Recouply.ai is SaaS software that helps businesses collect their own overdue invoices
              using AI-powered workflows. Never lose revenue to forgotten payments again.
            </p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" onClick={() => navigate("/auth")}>
                Get Started Free
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
                View Demo
              </Button>
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <h3 className="text-3xl font-bold text-center mb-12">How It Works</h3>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-semibold mb-2 text-lg">Import Invoices</h4>
                <p className="text-muted-foreground">
                  Add customers and their overdue invoices to the platform
                </p>
              </div>
              <div className="text-center">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-semibold mb-2 text-lg">AI Drafts Messages</h4>
                <p className="text-muted-foreground">
                  AI generates professional email and SMS reminders for each invoice
                </p>
              </div>
              <div className="text-center">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-semibold mb-2 text-lg">Review & Collect</h4>
                <p className="text-muted-foreground">
                  Approve messages and collect payments through your own channels
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="container mx-auto max-w-6xl">
            <h3 className="text-3xl font-bold text-center mb-12">Why Recouply.ai?</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="flex gap-4">
                <Shield className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold mb-2">Not a Collection Agency</h4>
                  <p className="text-muted-foreground">
                    You remain in control. All communication comes from your business, never from
                    Recouply.ai. We're software, not a third-party collector.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <DollarSign className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold mb-2">Direct Payment</h4>
                  <p className="text-muted-foreground">
                    Payments go straight to you via Stripe or your own payment links. We never hold
                    your funds.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <Zap className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold mb-2">AI-Powered Efficiency</h4>
                  <p className="text-muted-foreground">
                    Let AI draft professional, context-aware messages that maintain your
                    relationships while recovering revenue.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <CheckCircle className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold mb-2">Full Transparency</h4>
                  <p className="text-muted-foreground">
                    Review every message before it's sent. You approve what goes out and maintain
                    complete control.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 bg-primary text-primary-foreground">
          <div className="container mx-auto text-center max-w-3xl">
            <h3 className="text-4xl font-bold mb-4">Ready to Recover Your Revenue?</h3>
            <p className="text-lg mb-8 opacity-90">
              Join businesses using AI to automate invoice collection professionally and effectively.
            </p>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate("/auth")}
              className="text-lg px-8"
            >
              Start Free Trial
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 px-4 bg-card">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>&copy; 2024 Recouply.ai. Not a collection agency - Software as a Service.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
