import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Brain,
  Zap,
  RefreshCw,
  Eye,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Plug,
  Activity,
  Send,
  TrendingUp,
  Clock,
  AlertTriangle,
  XCircle,
  Sparkles,
} from "lucide-react";
import MarketingLayout from "@/components/layout/MarketingLayout";
import SEOHead from "@/components/seo/SEOHead";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/* ---------- Reveal-on-scroll helper ---------- */
const useReveal = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
};

const Reveal = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
    >
      {children}
    </div>
  );
};

/* ---------- Hero ---------- */
const Hero = () => (
  <section className="relative overflow-hidden pt-20 pb-24 md:pt-28 md:pb-32">
    {/* Soft blue gradient background */}
    <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-primary/10 blur-3xl opacity-60" />
    <div className="absolute top-40 right-0 w-[400px] h-[400px] rounded-full bg-accent/10 blur-3xl" />

    <div className="container mx-auto px-4 relative z-10">
      <div className="max-w-4xl mx-auto text-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            Built for Stripe-based teams
          </div>
        </Reveal>

        <Reveal delay={100}>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.05]">
            Set it and forget it{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              collections for Stripe.
            </span>
          </h1>
        </Reveal>

        <Reveal delay={200}>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Recouply.ai syncs with Stripe, monitors every invoice, and automatically follows up
            when payments are overdue—so your team never has to chase again.
          </p>
        </Reveal>

        <Reveal delay={300}>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <Button asChild size="lg" className="text-base px-8 h-12 shadow-lg shadow-primary/20">
              <Link to="/collections-assessment">
                Run Free Assessment <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-base px-8 h-12">
              <Link to="/signup">
                <Plug className="mr-1 h-4 w-4" /> Connect Stripe
              </Link>
            </Button>
          </div>
        </Reveal>

        <Reveal delay={400}>
          <p className="text-sm text-muted-foreground">
            No workflow changes <span className="text-primary/60 mx-2">•</span> No manual follow-ups{" "}
            <span className="text-primary/60 mx-2">•</span> Fully automated
          </p>
        </Reveal>
      </div>

      {/* Hero visual: animated flow */}
      <Reveal delay={500}>
        <div className="mt-16 max-w-5xl mx-auto">
          <div className="relative rounded-3xl border border-border/60 bg-card/50 backdrop-blur-sm p-6 md:p-10 shadow-xl">
            {/* Pulsing brain center */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Stripe input */}
              <div className="flex flex-col items-center gap-2 min-w-[120px]">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <RefreshCw className="h-7 w-7 text-primary" />
                </div>
                <span className="text-xs font-semibold text-foreground">Stripe</span>
                <span className="text-[10px] text-muted-foreground">Invoices in</span>
              </div>

              <ArrowRight className="h-5 w-5 text-muted-foreground hidden md:block animate-pulse" />

              {/* Brain */}
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse" />
                <div className="relative w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl shadow-primary/30 animate-[pulse_3s_ease-in-out_infinite]">
                  <Brain className="h-12 w-12 md:h-14 md:w-14 text-primary-foreground" />
                </div>
                <span className="block text-center text-xs font-semibold mt-3">Recouply.ai</span>
              </div>

              <ArrowRight className="h-5 w-5 text-muted-foreground hidden md:block animate-pulse" />

              {/* Outreach */}
              <div className="flex flex-col items-center gap-2 min-w-[120px]">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <Send className="h-7 w-7 text-accent" />
                </div>
                <span className="text-xs font-semibold text-foreground">Auto Outreach</span>
                <span className="text-[10px] text-muted-foreground">Paid faster</span>
              </div>
            </div>

            {/* Floating signal pills */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8 pt-8 border-t border-border/50">
              {[
                { icon: Zap, label: "Auto Follow-ups" },
                { icon: RefreshCw, label: "Real-Time Sync" },
                { icon: AlertTriangle, label: "Risk Signals" },
                { icon: Eye, label: "Cash Flow Visibility" },
              ].map((s, i) => (
                <div
                  key={s.label}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/80 border border-border/50 hover:border-primary/40 transition-colors"
                  style={{ animationDelay: `${i * 200}ms` }}
                >
                  <s.icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs font-medium truncate">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  </section>
);

/* ---------- Problem ---------- */
const Problem = () => {
  const pains = [
    { icon: Clock, title: "Follow-ups are manual and inconsistent", desc: "Reminders depend on whoever has the bandwidth that week." },
    { icon: XCircle, title: "Invoices slip through the cracks", desc: "Past-due invoices sit untouched while focus shifts elsewhere." },
    { icon: AlertTriangle, title: "No visibility into account risk", desc: "You only learn an account is at risk when the cash never lands." },
  ];
  return (
    <section className="py-24 px-4 bg-muted/20 border-y border-border/40">
      <div className="container mx-auto max-w-5xl">
        <Reveal>
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">
              Stripe handles payments. <br className="hidden md:block" />
              <span className="text-muted-foreground">It doesn't manage collections.</span>
            </h2>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-5">
          {pains.map((p, i) => (
            <Reveal key={p.title} delay={i * 100}>
              <Card className="p-6 h-full border-border/60 hover:border-destructive/30 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
                  <p.icon className="h-5 w-5 text-destructive" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </Card>
            </Reveal>
          ))}
        </div>
        <Reveal delay={400}>
          <p className="text-center text-lg md:text-xl text-foreground/80 mt-12 max-w-2xl mx-auto italic">
            "Most teams don't realize how much cash is delayed due to missed or late follow-ups."
          </p>
        </Reveal>
      </div>
    </section>
  );
};

/* ---------- Solution ---------- */
const Solution = () => {
  const features = [
    { icon: RefreshCw, title: "Stripe Sync (Real-time)", desc: "Invoices and payment activity sync automatically—no imports needed." },
    { icon: Activity, title: "Intelligent Monitoring", desc: "Every invoice is tracked against due dates and payment behavior." },
    { icon: Send, title: "Automated Follow-Ups", desc: "AI agents send pre-approved outreach only when invoices become past due." },
    { icon: ShieldCheck, title: "Continuous Coverage", desc: "Every open invoice is actively managed until it's paid." },
  ];
  return (
    <section className="py-24 px-4">
      <div className="container mx-auto max-w-6xl">
        <Reveal>
          <div className="text-center mb-14">
            <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
              The Solution
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Recouply.ai runs collections{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                automatically.
              </span>
            </h2>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-5">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 100}>
              <Card className="p-7 h-full border-border/60 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ---------- Set it and forget it ---------- */
const SetAndForget = () => {
  const items = [
    "No reminders to set",
    "No emails to draft",
    "No tracking spreadsheets",
    "No manual follow-ups",
  ];
  return (
    <section className="py-24 px-4 bg-gradient-to-b from-background via-primary/5 to-background">
      <div className="container mx-auto max-w-5xl">
        <div className="rounded-3xl border border-primary/20 bg-card/60 backdrop-blur-sm p-8 md:p-14 shadow-xl shadow-primary/5">
          <Reveal>
            <h2 className="text-3xl md:text-5xl font-bold mb-5 tracking-tight text-center">
              Turn collections into a <br className="hidden md:block" />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                background system.
              </span>
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="text-center text-muted-foreground text-lg max-w-2xl mx-auto mb-10">
              Once connected, Recouply.ai runs continuously—tracking invoices, triggering
              outreach, and ensuring nothing is missed.
            </p>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {items.map((item, i) => (
              <Reveal key={item} delay={i * 80}>
                <div className="flex flex-col items-center text-center p-4 rounded-xl bg-background/50 border border-border/40">
                  <CheckCircle2 className="h-6 w-6 text-primary mb-2" />
                  <span className="text-sm font-medium">{item}</span>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={400}>
            <div className="text-center">
              <p className="inline-block text-lg md:text-xl font-semibold px-6 py-3 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
                Your receivables stay active—without your team being involved.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

/* ---------- How it works ---------- */
const HowItWorks = () => {
  const steps = [
    { icon: Plug, title: "Connect Stripe", desc: "One-click OAuth. No imports, no CSVs." },
    { icon: RefreshCw, title: "Recouply syncs invoices automatically", desc: "Real-time sync of every invoice and payment." },
    { icon: Brain, title: "AI monitors due dates and risk signals", desc: "Continuous tracking against payment behavior." },
    { icon: Send, title: "Outreach is triggered only when needed", desc: "Pre-approved messages sent at the right moment." },
  ];
  return (
    <section className="py-24 px-4">
      <div className="container mx-auto max-w-6xl">
        <Reveal>
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-4">
              How It Works
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Live in minutes. Running forever.
            </h2>
          </div>
        </Reveal>

        <div className="relative">
          {/* connector line */}
          <div className="absolute top-8 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent hidden md:block" />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 120}>
                <div className="relative text-center">
                  <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 mb-4 z-10">
                    <s.icon className="h-7 w-7 text-primary-foreground" />
                    <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-background border-2 border-primary text-primary text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </div>
                  </div>
                  <h3 className="font-semibold mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ---------- Ideal customer ---------- */
const IdealCustomer = () => {
  const traits = [
    "Series A–C companies",
    "Fewer than 500 invoices/month",
    "Lean finance or ops teams",
    "Growing revenue but increasing receivables complexity",
  ];
  return (
    <section className="py-24 px-4 bg-muted/20 border-y border-border/40">
      <div className="container mx-auto max-w-4xl">
        <Reveal>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Built for Stripe-based teams without dedicated AR resources
            </h2>
          </div>
        </Reveal>
        <div className="grid sm:grid-cols-2 gap-4">
          {traits.map((t, i) => (
            <Reveal key={t} delay={i * 80}>
              <div className="flex items-center gap-3 p-5 rounded-xl bg-card border border-border/60">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <span className="font-medium">{t}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ---------- Outcomes ---------- */
const Outcomes = () => {
  const outcomes = [
    { icon: CheckCircle2, title: "Fewer missed follow-ups" },
    { icon: Zap, title: "Faster collections cycles" },
    { icon: TrendingUp, title: "More predictable cash flow" },
    { icon: Clock, title: "Reduced manual effort" },
    { icon: Eye, title: "Better visibility into receivables" },
  ];
  return (
    <section className="py-24 px-4">
      <div className="container mx-auto max-w-6xl">
        <Reveal>
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">What you get</h2>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {outcomes.map((o, i) => (
            <Reveal key={o.title} delay={i * 80}>
              <Card className="p-6 text-center h-full border-border/60 hover:border-primary/40 hover:-translate-y-1 transition-all">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-3">
                  <o.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-semibold leading-snug">{o.title}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ---------- Final CTA ---------- */
const FinalCTA = () => (
  <section className="py-24 px-4">
    <div className="container mx-auto max-w-4xl">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-accent p-10 md:p-16 text-center shadow-2xl shadow-primary/20">
        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <Reveal>
            <h2 className="text-3xl md:text-5xl font-bold text-primary-foreground mb-5 tracking-tight">
              Stop chasing invoices. <br />
              Let the system run.
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="text-primary-foreground/85 text-lg max-w-xl mx-auto mb-8">
              Connect Stripe and let Recouply.ai handle collections in the background.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" variant="secondary" className="text-base px-8 h-12">
                <Link to="/collections-assessment">
                  Run Free Assessment <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="text-base px-8 h-12 bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link to="/signup">
                  <Plug className="mr-1 h-4 w-4" /> Connect Stripe
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  </section>
);

/* ---------- Page ---------- */
const StripeCollections = () => {
  usePageTitle("Set It and Forget It Collections for Stripe");
  return (
    <MarketingLayout>
      <SEOHead
        title="Set It and Forget It Collections for Stripe | Recouply.ai"
        description="Recouply.ai syncs with Stripe, monitors every invoice, and automatically follows up when payments are overdue. Built for Series A–C companies with under 500 invoices/month."
        keywords="Stripe collections, automated AR for Stripe, set and forget collections, Stripe invoice automation, Series A AR automation, Stripe payment follow up"
        canonical="https://recouply.ai/stripe-collections"
      />
      <Hero />
      <Problem />
      <Solution />
      <SetAndForget />
      <HowItWorks />
      <IdealCustomer />
      <Outcomes />
      <FinalCTA />
    </MarketingLayout>
  );
};

export default StripeCollections;
