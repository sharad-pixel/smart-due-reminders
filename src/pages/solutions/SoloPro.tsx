import MarketingLayout from "@/components/layout/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, User, Brain, Zap, DollarSign, Clock, QrCode, FileText, CalendarClock, HandCoins, ArrowRight } from "lucide-react";
import SEOHead from "@/components/seo/SEOHead";
import { PLAN_CONFIGS, INVOICE_PRICING } from "@/lib/subscriptionConfig";
import venmoLogo from "@/assets/venmo-logo.png";
import paypalLogo from "@/assets/paypal-logo.png";
import cashappLogo from "@/assets/cashapp-logo.png";
import stripeLogo from "@/assets/stripe-logo.png";

const SoloPro = () => {
  const navigate = useNavigate();

  const features = [
    "All 7 AI collection agents working 24/7",
    "Stripe & QuickBooks integrations included",
    "Email campaigns with embedded payment links",
    "Full automation suite—no feature limits",
    "Collection intelligence dashboard",
    "Risk-aware workflows that learn over time"
  ];

  const benefits = [
    {
      icon: DollarSign,
      title: "Affordable Power",
      description: `Just $${PLAN_CONFIGS.solo_pro.monthlyPrice}/month for 25 active invoices—full platform access at a fraction of team plans.`
    },
    {
      icon: Zap,
      title: "No Feature Limits",
      description: "Access every AI agent, integration, and automation. Same capabilities as larger plans, sized for solo operators."
    },
    {
      icon: Clock,
      title: "Consumption-Based",
      description: `Only $${INVOICE_PRICING.perInvoice} per additional invoice when you exceed your monthly limit. Pay for what you use.`
    }
  ];

  return (
    <MarketingLayout>
      <SEOHead
        title="Solo Pro Plan for Independent Operators | Recouply.ai"
        description="Full-powered AI collection platform for sole proprietors and independent operators. $49/month for 25 invoices with all 6 AI agents and complete automation."
        keywords="solo collections software, independent operator billing, freelancer invoice collection, sole proprietor AR automation"
        canonical="https://recouply.ai/solutions/solo-pro"
      />
      
      {/* Hero Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-6">
            <User className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">AR Intelligence for Solo Operators</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Full AR Platform Power at a Solo Price
          </h1>
          <p className="text-xl text-muted-foreground mb-4">
            Six AI agents, complete AR automation, and all integrations—designed for independent operators 
            who need enterprise-grade accounts receivable intelligence without the enterprise price tag.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <div className="text-3xl font-bold text-primary">
              ${PLAN_CONFIGS.solo_pro.monthlyPrice}<span className="text-lg font-normal text-muted-foreground">/month</span>
            </div>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">25 invoices included</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate("/signup?plan=solo_pro")}
              size="lg"
            >
              Start 7-Day Free Trial
            </Button>
            <Button 
              onClick={() => window.open("https://calendly.com/sharad-recouply/30min", "_blank")}
              variant="outline"
              size="lg"
            >
              Book a Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Who It's For */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold mb-6">Built for Independent Operators</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-muted-foreground">
              You're running your own show—whether as a freelancer, consultant, contractor, or sole proprietor. 
              You don't have a finance team or collections department. You handle everything yourself, 
              including the uncomfortable task of chasing unpaid invoices.
            </p>
            <p className="text-muted-foreground">
              Solo Pro gives you the same AI-powered collection intelligence used by larger businesses, 
              right-sized for your operation. No feature limitations. No compromises. Just powerful automation 
              at a price that makes sense for one-person shops.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold mb-8 text-center">Why Solo Pro?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {benefits.map((benefit, idx) => (
              <Card key={idx}>
                <CardContent className="pt-6">
                  <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                    <benefit.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold mb-6">Everything You Need, Nothing You Don't</h2>
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-xl font-semibold mb-4">Full Platform Access Includes:</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Invoice Templates + 7 Agents 24/7 */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-4">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Templates + Always-On Agents</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Create Invoice Templates. Never Miss a Payment Owed.
            </h2>
            <p className="text-muted-foreground max-w-3xl mx-auto text-lg">
              Build reusable, branded invoice templates once — then let{" "}
              <span className="font-semibold text-foreground">7 AI agents work 24/7</span> to track,
              follow up, and recover every dollar owed to you. No invoice slips through the cracks.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card className="border-primary/20">
              <CardContent className="pt-6">
                <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Reusable Invoice Templates</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Design branded invoice templates with your logo, colors, line items, payment terms,
                  and embedded pay-now links. Reuse them for every client — no manual rebuilds.
                </p>
                <ul className="space-y-2 text-sm">
                  {[
                    "Drag-and-drop template builder",
                    "Pre-set Net 15 / Net 30 / custom terms",
                    "Auto-fill from saved customer profiles",
                    "Send recurring invoices on schedule",
                  ].map((i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
              <CardContent className="pt-6">
                <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">7 AI Agents Working 24/7</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Your always-on collections team — monitoring every invoice, scoring every account,
                  and reaching out the moment a payment is at risk. You sleep, they work.
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    "Risk Scoring Agent",
                    "Outreach Agent",
                    "Inbox Triage Agent",
                    "Payment Plan Agent",
                    "Escalation Agent",
                    "Reconciliation Agent",
                    "Intelligence Agent",
                  ].map((agent) => (
                    <div key={agent} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <span className="text-xs">{agent}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <Button onClick={() => navigate("/signup?plan=solo_pro")} size="lg" className="group">
              Build Your First Template
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </section>

      {/* Intelligence Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <Card className="bg-gradient-to-br from-primary/5 to-secondary/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Brain className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Intelligence That Grows With You</h3>
                  <p className="text-muted-foreground">
                    Every AI agent learns from your customer interactions, payment patterns, and message effectiveness. 
                    Over time, your collection intelligence becomes more accurate and your recovery rates improve—automatically. 
                    Start solo, scale when you're ready.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Payment QR Codes Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-4">
              <QrCode className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Solo Pro Feature</span>
            </div>
            <h2 className="text-3xl font-bold mb-3">Accept Payments via QR Code</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Upload your personal payment QR codes and display them directly on branded invoices.
              Let customers pay instantly through the apps they already use.
            </p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-center justify-center gap-10">
                {[
                  { logo: venmoLogo, name: "Venmo" },
                  { logo: paypalLogo, name: "PayPal" },
                  { logo: cashappLogo, name: "Cash App" },
                  { logo: stripeLogo, name: "Stripe" },
                ].map((provider) => (
                  <div key={provider.name} className="flex flex-col items-center gap-3">
                    <div className="h-20 w-20 rounded-2xl bg-muted/50 border overflow-hidden flex items-center justify-center">
                      <img
                        src={provider.logo}
                        alt={`${provider.name} logo`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <span className="text-sm font-medium">{provider.name}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Add your QR codes in <span className="font-medium text-foreground">Branding → Invoice Template → Payment QR Codes</span> and 
                  they'll appear on every customer-facing invoice automatically.
                </p>
                <div className="flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Branded invoices</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Scan-to-pay convenience</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Faster collections</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Invoices & Payment Plans for Credit Terms */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-4">
              <HandCoins className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Sell on Credit. Get Paid on Time.</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Create Invoices & Payment Plans That Keep Cash Flowing
            </h2>
            <p className="text-muted-foreground max-w-3xl mx-auto text-lg">
              When you offer Net 15, Net 30, or longer credit terms, you take on real revenue risk.
              Recouply lets solo operators issue branded invoices and structured payment plans in minutes —
              so customers can pay on terms that work for them, while you protect cash flow and stop losing revenue to delays.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-10">
            <Card className="border-primary/20">
              <CardContent className="pt-6">
                <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Branded Invoices in Seconds</h3>
                <p className="text-muted-foreground text-sm">
                  Generate professional invoices with your logo, payment links, and QR codes —
                  ready for Net 15, Net 30, or custom terms. Send via email or share a secure link.
                </p>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardContent className="pt-6">
                <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                  <CalendarClock className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Flexible Payment Plans</h3>
                <p className="text-muted-foreground text-sm">
                  Break large balances into structured installments at the account level.
                  Set milestone amounts, due dates, and auto-reminders so customers stay on track —
                  without you chasing every payment.
                </p>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardContent className="pt-6">
                <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Risk-Aware Credit Decisions</h3>
                <p className="text-muted-foreground text-sm">
                  Every account gets a Collectability Score and Expected Credit Loss estimate,
                  so you know which customers can safely buy on credit — and which need
                  upfront payment or shorter terms.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-gradient-to-br from-primary/5 to-secondary/5">
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h3 className="text-2xl font-bold mb-3">Don't Lose Revenue to Slow-Paying Customers</h3>
                  <p className="text-muted-foreground mb-4">
                    A single unpaid Net 30 invoice can stall your operation. With Recouply, you can confidently
                    extend credit terms knowing every invoice is monitored, every payment plan is tracked, and
                    every overdue account is automatically worked by your AI agents — so revenue keeps moving
                    while you focus on the work.
                  </p>
                  <ul className="space-y-2 mb-6">
                    {[
                      "Issue invoices with embedded pay-now buttons",
                      "Offer payment plans without spreadsheets",
                      "AI follow-ups the moment terms are missed",
                      "Real-time visibility into outstanding credit exposure",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button onClick={() => navigate("/signup?plan=solo_pro")} className="group">
                    Start Issuing Invoices Today
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
                <div className="rounded-xl border bg-background/60 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4 pb-4 border-b">
                    <div>
                      <div className="text-xs text-muted-foreground">Invoice #INV-2041</div>
                      <div className="font-semibold">Acme Studio · Net 30</div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">On Plan</span>
                  </div>
                  <div className="space-y-3 text-sm">
                    {[
                      { label: "Installment 1 of 3", amount: "$1,200.00", status: "Paid", color: "text-primary" },
                      { label: "Installment 2 of 3", amount: "$1,200.00", status: "Due May 15", color: "text-foreground" },
                      { label: "Installment 3 of 3", amount: "$1,200.00", status: "Due Jun 15", color: "text-muted-foreground" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{row.label}</div>
                          <div className={`text-xs ${row.color}`}>{row.status}</div>
                        </div>
                        <div className="font-semibold">{row.amount}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Total Balance</span>
                    <span className="font-bold">$3,600.00</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Pricing Details */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold mb-6 text-center">Simple, Transparent Pricing</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-4xl font-bold text-primary mb-2">${PLAN_CONFIGS.solo_pro.monthlyPrice}</div>
                <div className="text-muted-foreground mb-4">per month</div>
                <ul className="text-sm text-left space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    25 active invoices included
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    All 6 AI collection agents
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Full platform access
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-4xl font-bold text-muted-foreground mb-2">${INVOICE_PRICING.perInvoice}</div>
                <div className="text-muted-foreground mb-4">per additional invoice</div>
                <ul className="text-sm text-left space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Pay only when you exceed 25
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Calculated monthly
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Scale seamlessly as you grow
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary/5">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Put Six AI Agents to Work?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join independent operators using enterprise-grade collection intelligence at a solo price.
          </p>
          <Button 
            onClick={() => navigate("/signup?plan=solo_pro")}
            size="lg"
          >
            Start Your 7-Day Free Trial
          </Button>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default SoloPro;
