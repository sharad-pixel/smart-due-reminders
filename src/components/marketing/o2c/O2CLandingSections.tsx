import { Link } from "react-router-dom";
import { ArrowRight, LogIn, Layers, Workflow, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const O2C_DOMAINS = [
  "Quote-to-Cash", "Deal Desk", "Contracts", "Order Management", "Billing",
  "Collections", "Cash Application", "Revenue", "Renewals",
];

export function O2CHomeHero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-primary/15 blur-[140px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.08]" />
      </div>
      <div className="container relative mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Collections Intelligence + O2C Transformation
        </div>
        <h1 className="mx-auto mt-6 max-w-5xl text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.04]">
          AI-Powered Collections &{" "}
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">O2C Transformation</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-xl text-foreground/80">
          Improve collections today. Transform Order-to-Cash across your organization.
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
          Recouply.ai combines intelligent collections workflows with customized O2C transformation services
          designed around your systems, data, controls, and business processes.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="text-base px-7">
            <Link to="/signup">Start Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-base px-7">
            <Link to="/o2c-transformation">Explore O2C Transformation</Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="text-base">
            <Link to="/login"><LogIn className="mr-2 h-4 w-4" /> Sign In</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function ChoosePathSection() {
  const platform = [
    "Collections workflows", "Aging management", "AI-assisted outreach", "Invoice tracking",
    "Risk visibility", "Collections dashboards", "Team assignments", "Customer communication",
  ];
  return (
    <section className="container mx-auto px-4 sm:px-6 py-20">
      <h2 className="text-center text-3xl sm:text-4xl font-semibold tracking-tight">Choose how you use Recouply</h2>
      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-8 flex flex-col">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Layers className="h-4 w-4" /> Recouply Platform</div>
          <h3 className="mt-3 text-2xl font-semibold">Start Improving Collections Today</h3>
          <p className="mt-3 text-muted-foreground">
            Manage collections workflows, prioritize receivables, automate outreach, improve visibility, and give
            finance teams greater control over outstanding invoices.
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
          Start with Recouply's collections platform today. Give finance teams a centralized way to manage receivables,
          aging, collections activity, customer outreach, and outstanding invoice workflows.
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
