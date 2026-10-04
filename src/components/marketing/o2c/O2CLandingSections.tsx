import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, LogIn, MessageSquare, Layers, Workflow, CheckCircle2, Sparkles } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";

export const O2C_DOMAINS = [
  "Quote-to-Cash", "Deal Desk", "Contracts", "Order Management", "Billing",
  "Collections", "Cash Application", "Revenue", "Renewals",
];

const HOME_OFFERINGS = [
  {
    id: "platform",
    label: "Recouply Platform",
    eyebrow: "The Order to Cash Operating Model",
    title: "AI-Driven Revenue Intelligence and Collections",
    highlight: "Revenue Intelligence",
    summary: "More than collections: Recouply combines automated receivables workflows with revenue intelligence — risk and ECL scoring, cash-flow forecasting, a customer payment portal, and deep ERP, CRM, and billing integrations — so finance teams see and manage every dollar outstanding.",
    primaryLabel: "Start Free",
    primaryHref: "/signup",
    secondaryLabel: "Explore the Platform",
    secondaryHref: "/solutions",
    tertiaryLabel: "Sign In",
    tertiaryHref: "/login",
    tertiaryIcon: "login",
    icon: Sparkles,
    chips: [
      "Revenue Intelligence",
      "Collections Automation",
      "Risk & ECL Scoring",
      "Cash-Flow Forecasting",
      "Payment Portal",
      "ERP & CRM Integrations",
    ],
  },
  {
    id: "transformation",
    label: "O2C Transformation",
    eyebrow: "O2C Transformation Services",
    title: "Transform the Entire Revenue Lifecycle",
    highlight: "Revenue Lifecycle",
    summary: "Improve collections today, then redesign the workflows, controls, systems, and data that power Order-to-Cash across your organization.",
    primaryLabel: "Explore O2C Transformation",
    primaryHref: "/o2c-transformation",
    secondaryLabel: "Request an Assessment",
    secondaryHref: "/o2c-transformation#assessment",
    tertiaryLabel: "Talk to Us",
    tertiaryHref: "/o2c-transformation#assessment",
    tertiaryIcon: "message",
    icon: Workflow,
  },
] as const;

export function O2CHomeHero() {
  const [activeOffering, setActiveOffering] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const offering = HOME_OFFERINGS[activeOffering];

  useEffect(() => {
    if (isPaused || prefersReducedMotion) return;

    const interval = window.setInterval(() => {
      setActiveOffering((current) => (current + 1) % HOME_OFFERINGS.length);
    }, 6500);

    return () => window.clearInterval(interval);
  }, [isPaused, prefersReducedMotion]);

  const highlightStart = offering.title.indexOf(offering.highlight);
  const titleStart = offering.title.slice(0, highlightStart);
  const titleEnd = offering.title.slice(highlightStart + offering.highlight.length);

  return (
    <section
      className="relative overflow-hidden border-b border-border/60"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false);
      }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-primary/15 blur-[140px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.08]" />
      </div>
      <div className="container relative mx-auto px-4 py-16 text-center sm:px-6 sm:py-24">
        <div className="mx-auto mb-9 inline-flex rounded-md border border-border bg-card p-1 shadow-sm" role="tablist" aria-label="Recouply offerings">
          {HOME_OFFERINGS.map((item, index) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={activeOffering === index}
                variant={activeOffering === index ? "default" : "ghost"}
                size="sm"
                className="gap-2 px-3 sm:px-5"
                onClick={() => setActiveOffering(index)}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
                <span className="sm:hidden">{index === 0 ? "Platform" : "O2C"}</span>
              </Button>
            );
          })}
        </div>

        <div className="relative mx-auto min-h-[410px] max-w-5xl sm:min-h-[390px]" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={offering.id}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -14 }}
              transition={{ duration: prefersReducedMotion ? 0.01 : 0.45, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                {offering.eyebrow}
              </div>
              <h1 className="mx-auto mt-6 max-w-5xl text-4xl font-semibold leading-[1.04] sm:text-6xl lg:text-7xl">
                {titleStart}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{offering.highlight}</span>
                {titleEnd}
              </h1>
              <p className="mx-auto mt-6 max-w-3xl text-lg text-foreground/80 sm:text-xl">
                {offering.summary}
              </p>
              {"chips" in offering && (
                <div className="mt-7 flex flex-wrap justify-center gap-2">
                  {offering.chips.map((chip) => (
                    <span key={chip} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80">
                      {chip}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-10 flex flex-col flex-wrap justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="px-7 text-base">
                  <Link to={offering.primaryHref}>{offering.primaryLabel} <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="px-7 text-base">
                  <Link to={offering.secondaryHref}>{offering.secondaryLabel}</Link>
                </Button>
                <Button asChild size="lg" variant="ghost" className="text-base">
                  <Link to={offering.tertiaryHref}>
                    {offering.tertiaryIcon === "message"
                      ? <MessageSquare className="mr-2 h-4 w-4" />
                      : <LogIn className="mr-2 h-4 w-4" />}
                    {offering.tertiaryLabel}
                  </Link>
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-3 flex justify-center gap-2" aria-hidden="true">
          {HOME_OFFERINGS.map((item, index) => (
            <span
              key={item.id}
              className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${activeOffering === index ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function ChoosePathSection() {
  const platform = [
    "Revenue intelligence dashboards", "Collections automation", "AI-assisted outreach",
    "Risk & ECL scoring", "Aging management", "Cash-flow forecasting",
    "Customer payment portal", "Invoice tracking", "Payment plans & reconciliation",
    "ERP, CRM & billing integrations", "Team assignments & workflows", "Multi-currency reporting",
  ];
  return (
    <section className="container mx-auto px-4 sm:px-6 py-20">
      <h2 className="text-center text-3xl sm:text-4xl font-semibold tracking-tight">Choose how you use Recouply</h2>
      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-8 flex flex-col">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Layers className="h-4 w-4" /> Recouply Platform</div>
          <h3 className="mt-3 text-2xl font-semibold">Revenue Intelligence, Built on Collections Automation</h3>
          <p className="mt-3 text-muted-foreground">
            Go beyond collections workflows: prioritize receivables with risk scoring, forecast cash flow,
            automate outreach, and give finance teams a single, intelligent view of every dollar outstanding.
          </p>
          <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {platform.map((p) => (
              <li key={p} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-accent shrink-0" />{p}</li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3 mt-auto pt-8">
            <Button asChild><Link to="/signup">Start Free</Link></Button>
            <Button asChild variant="outline"><Link to="/login">Sign In</Link></Button>
          </div>
        </div>
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8 flex flex-col">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Workflow className="h-4 w-4" /> O2C Transformation</div>
          <h3 className="mt-3 text-2xl font-semibold">Transform the Entire Revenue Lifecycle</h3>
          <p className="mt-3 text-muted-foreground">
            For organizations with broader Order-to-Cash transformation needs, Recouply can design and deploy
            customized workflows around existing systems, processes, controls, and data.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {O2C_DOMAINS.map((d) => (
              <span key={d} className="rounded-full border border-border bg-background px-3 py-1 text-xs">{d}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-auto pt-8">
            <Button asChild><Link to="/o2c-transformation">Explore O2C Transformation</Link></Button>
            <Button asChild variant="outline"><Link to="/o2c-transformation#assessment">Request an Assessment</Link></Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PlatformReminder() {
  return (
    <section className="container mx-auto px-4 sm:px-6 py-16">
      <div className="rounded-2xl border border-border bg-card p-8 sm:p-12 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">Not Ready for a Full Transformation?</h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Start with the Recouply Platform today. Revenue intelligence, collections automation, customer payment
          portals, and integration with your ERP, CRM, and billing systems — all in one place, ready to grow with you.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg"><Link to="/signup">Create Your Account</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/login">Login</Link></Button>
        </div>
      </div>
    </section>
  );
}

export function O2CFinalCTA() {
  return (
    <section className="dark relative overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/25 blur-[160px]" />
      <div className="container relative mx-auto px-6 py-28 text-center">
        <h2 className="mx-auto max-w-4xl text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
          Start With Collections.{" "}
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Transform the Entire O2C Lifecycle.</span>
        </h2>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg"><Link to="/signup">Start Free <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/o2c-transformation#assessment">Discuss O2C Transformation</Link></Button>
        </div>
      </div>
    </section>
  );
}
