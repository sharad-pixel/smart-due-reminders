import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import MarketingLayout from "@/components/MarketingLayout";
import SEO from "@/components/SEO";
import { 
  ArrowRight, 
  Check, 
  Shield, 
  MessageSquare, 
  Database, 
  Brain,
  Clock,
  Users,
  FileCheck,
  Zap,
  Lock,
  RefreshCw
} from "lucide-react";
import stripeLogo from "@/assets/stripe-logo.png";
import quickbooksLogo from "@/assets/quickbooks-logo.png";

const IntegrationCard = ({ 
  logo, 
  title, 
  description, 
  highlights, 
  ctaText 
}: { 
  logo: string; 
  title: string; 
  description: string; 
  highlights: string[]; 
  ctaText: string;
}) => (
  <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300">
    <CardHeader>
      <div className="flex items-center gap-4 mb-4">
        <div className="h-14 w-14 rounded-xl bg-background border border-border flex items-center justify-center overflow-hidden">
          <img src={logo} alt={title} className="h-10 w-10 object-contain" />
        </div>
        <CardTitle className="text-2xl">{title}</CardTitle>
      </div>
      <CardDescription className="text-base leading-relaxed">
        {description}
      </CardDescription>
    </CardHeader>
    <CardContent>
      <ul className="space-y-3 mb-6">
        {highlights.map((highlight, index) => (
          <li key={index} className="flex items-start gap-3">
            <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <span className="text-muted-foreground">{highlight}</span>
          </li>
        ))}
      </ul>
      <Button className="gap-2" asChild>
        <Link to="/signup">
          {ctaText}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </CardContent>
  </Card>
);

const FeatureBlock = ({ 
  icon: Icon, 
  title, 
  description 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string;
}) => (
  <div className="flex items-start gap-4">
    <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <h4 className="font-semibold mb-1">{title}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  </div>
);

const Integrations = () => {
  return (
    <MarketingLayout>
      <SEO
        title="Integrations | Stripe & QuickBooks for Cash Collections | Recouply.ai"
        description="Connect Stripe and QuickBooks to automate cash collections and payments. Real-time accounts receivable sync, collections health visibility, and AI automation for receivables."
        canonical="https://recouply.ai/integrations"
        keywords="cash collections, accounts receivable, payments, AI automation for receivables, collections health, Stripe integration, QuickBooks integration, AR automation"
      />

      {/* Hero Section */}
      <section className="py-20 md:py-28 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight">
            Connect your revenue stack.
            <br />
            <span className="text-primary">Centralize collections.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Recouply.ai integrates directly with Stripe and QuickBooks to sync customers, invoices, and payments — backed by 24/7 Slack support from real humans.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button size="lg" className="gap-2" asChild>
              <Link to="/signup">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/contact">Talk to Sales</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Integration Cards */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <IntegrationCard
              logo={stripeLogo}
              title="Stripe Integration"
              description="Recouply.ai connects to Stripe to automatically sync customers, invoices, balances, and payments in real time. Your collections workflows stay continuously aligned with payment activity — without manual reconciliation."
              highlights={[
                "Auto-sync Stripe customers and invoices",
                "Track open balances and partial payments",
                "Reflect real-time payment updates",
                "Maintain a complete audit trail",
                "Reduce finance and ops overhead"
              ]}
              ctaText="Connect Stripe"
            />
            <IntegrationCard
              logo={quickbooksLogo}
              title="QuickBooks Online Integration"
              description="Connect QuickBooks Online to make your accounting system the source of truth while Recouply.ai automates collections, tracking, and follow-ups. Invoices, balances, and payments stay aligned with QuickBooks — Recouply.ai handles the operational complexity."
              highlights={[
                "Sync customers, invoices, and payments securely",
                "Track open, paid, and partially paid invoices",
                "Keep balances aligned with QuickBooks",
                "Eliminate CSV exports and manual uploads",
                "Built with safeguards for reliable syncing"
              ]}
              ctaText="Connect QuickBooks"
            />
          </div>
        </div>
      </section>

      {/* Stripe AI Orchestration */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Brain className="h-4 w-4" />
              AI-Powered Collections
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Your invoices. Intelligent follow-up.
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Recouply.ai is an AI-powered orchestration layer for accounts receivable and collections. With native Stripe and QuickBooks integrations, unpaid invoices automatically receive the right attention — without manual follow-ups or client-side effort. Recouply.ai continuously assesses payment risk, orchestrates outreach, and improves over time to help businesses get paid faster without adding finance headcount.
            </p>
            <p className="text-base text-muted-foreground mb-8 max-w-2xl mx-auto">
              We're also actively building schemas around NetSuite and other ERP platforms to capture daily activity — so your collections intelligence grows with your revenue stack.
            </p>
            <div className="flex flex-wrap gap-6 justify-center text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                No handoffs
              </span>
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                No lost context
              </span>
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                No fragmented workflows
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Intelligence & Risk Layer */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                  <Brain className="h-4 w-4" />
                  Collection Intelligence
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Collections data that works beyond collections
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Recouply.ai uses historical payment behavior and engagement data to assess collection risk and inform future customer decisions.
                </p>
                <p className="text-muted-foreground">
                  Collection intelligence doesn't just reduce risk — it helps teams make smarter decisions around renewals, expansions, and customer health.
                </p>
              </div>
              <div className="grid gap-4">
                <FeatureBlock
                  icon={Zap}
                  title="Predictive Risk Scoring"
                  description="Identify at-risk accounts before they become problems"
                />
                <FeatureBlock
                  icon={RefreshCw}
                  title="Renewal Intelligence"
                  description="Use payment history to inform expansion decisions"
                />
                <FeatureBlock
                  icon={FileCheck}
                  title="Audit-Ready Reporting"
                  description="Complete visibility into every collection action"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 24/7 Slack Support */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-muted/30 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="order-2 md:order-1 grid gap-4">
                <FeatureBlock
                  icon={Clock}
                  title="24/7 Access"
                  description="Real humans available around the clock, not bots"
                />
                <FeatureBlock
                  icon={MessageSquare}
                  title="Direct Slack Channel"
                  description="Faster resolution via Slack, not ticket queues"
                />
                <FeatureBlock
                  icon={Users}
                  title="Proactive Guidance"
                  description="Expert support during onboarding and scaling"
                />
                <FeatureBlock
                  icon={Zap}
                  title="Finance-Ready"
                  description="Designed for finance and operations teams"
                />
              </div>
              <div className="order-1 md:order-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                  <MessageSquare className="h-4 w-4" />
                  Real-Time Support
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  24/7 Slack Support
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Recouply.ai provides direct, real-time support through Slack — not ticket queues.
                </p>
                <p className="text-muted-foreground">
                  Get help from real engineers and product experts whenever you need it, whether you're onboarding, running a sync, or troubleshooting edge cases.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Security */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Shield className="h-4 w-4" />
              Enterprise Security
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Built for financial teams
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
              Recouply.ai integrations are built with security and reliability in mind.
            </p>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {[
                { icon: Lock, label: "Secure OAuth connections" },
                { icon: Shield, label: "No credential sharing" },
                { icon: Users, label: "Granular permissions" },
                { icon: FileCheck, label: "Audit-ready logs" },
                { icon: Database, label: "Enterprise-grade data handling" },
              ].map((item, index) => (
                <div key={index} className="p-4 rounded-xl bg-card border border-border/50 text-center">
                  <item.icon className="h-6 w-6 text-primary mx-auto mb-3" />
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to centralize your collections?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Connect your revenue stack in minutes. Start with a free trial.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button size="lg" className="gap-2" asChild>
              <Link to="/signup">
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/contact?intent=demo">Request a Demo</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Integrations;
