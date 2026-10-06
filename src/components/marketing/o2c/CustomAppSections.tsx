import { Link } from "react-router-dom";
import {
  ArrowRight, ArrowDown, Layers, Workflow, Boxes, CheckCircle2, XCircle, Sparkles,
  Handshake, Receipt, AlertTriangle, LayoutList, GitBranch, ShieldCheck, BarChart3, Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const CUSTOM_APPS_HREF = "/o2c-transformation#custom-applications";
export const USE_CASE_HREF = "/o2c-transformation#assessment";

const H2 = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h2 className={`text-3xl sm:text-4xl font-semibold tracking-tight ${className}`}>{children}</h2>
);

/* ---------- Three ways to use Recouply ---------- */
export function ThreeWaysSection() {
  const cards = [
    {
      icon: Layers, tag: "Collections Intelligence", title: "Improve Collections Today",
      text: "Use Recouply.ai to manage receivables, aging, collections activity, customer communication, risk, and team workflows.",
      items: ["Collections workflows", "Aging management", "Customer outreach", "Invoice visibility", "Team assignments", "Collections intelligence", "Risk visibility", "AI-assisted communication"],
      cta: "Start Free", href: "/signup", featured: false,
    },
    {
      icon: Workflow, tag: "O2C Transformation", title: "Transform the Revenue Lifecycle",
      text: "Redesign fragmented Order-to-Cash processes across people, systems, data, controls, and workflows.",
      items: ["Quote-to-Cash", "Deal Desk", "Contract Operations", "Billing", "Collections", "Cash Application", "Revenue Operations", "Renewals", "Finance Systems"],
      cta: "Explore O2C Transformation", href: "/o2c-transformation", featured: true,
    },
    {
      icon: Boxes, tag: "Custom Business Applications", title: "Build What Your Business Actually Needs",
      text: "Create purpose-built applications around your unique finance and operational workflows without forcing teams into another rigid enterprise platform.",
      items: ["Deal approval applications", "Billing readiness tools", "Revenue exception management", "Collections workspaces", "Contract workflow applications", "RACI / RAID applications", "Finance approval workflows", "Operational & executive dashboards", "Reconciliation tools", "AI-enabled workflow applications"],
      cta: "Build a Custom Application", href: CUSTOM_APPS_HREF, featured: false,
    },
  ];
  return (
    <section className="container mx-auto px-4 sm:px-6 py-20">
      <H2 className="text-center mx-auto max-w-3xl">One Platform. Multiple Ways to Transform Finance Operations.</H2>
      <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
        Your workflows. Your data. Your controls. Your applications.
      </p>
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.tag} className={`rounded-2xl border p-7 flex flex-col ${c.featured ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
              <c.icon className="h-4 w-4" /> {c.tag}
            </div>
            <h3 className="mt-3 text-2xl font-semibold">{c.title}</h3>
            <p className="mt-3 text-sm text-muted-foreground">{c.text}</p>
            <ul className="mt-6 space-y-2 text-sm">
              {c.items.map((i) => (
                <li key={i} className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />{i}</li>
              ))}
            </ul>
            <div className="mt-auto pt-8">
              <Button asChild className="w-full" variant={c.featured ? "default" : "outline"}>
                <Link to={c.href}>{c.cta} <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Traditional vs Recouply comparison ---------- */
const FlowColumn = ({ title, steps, accent }: { title: string; steps: string[]; accent?: boolean }) => (
  <div className={`rounded-2xl border p-6 sm:p-8 ${accent ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
    <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${accent ? "text-primary" : "text-muted-foreground"}`}>{title}</div>
    <ol className="mt-6 flex flex-col items-center gap-1.5">
      {steps.map((s, i) => (
        <li key={s} className="flex w-full flex-col items-center gap-1.5">
          <div className={`w-full max-w-xs rounded-lg border px-4 py-2.5 text-center text-sm font-medium ${accent ? "border-primary/30 bg-background" : "border-border bg-muted/40 text-muted-foreground"}`}>{s}</div>
          {i < steps.length - 1 && <ArrowDown className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground/50"}`} />}
        </li>
      ))}
    </ol>
  </div>
);

export function CustomAppsIntroSection({ id }: { id?: string }) {
  return (
    <section id={id} className="border-y border-border/60 bg-muted/30 scroll-mt-20">
      <div className="container mx-auto px-4 sm:px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Custom Business Applications</div>
          <H2 className="mt-3">Custom Business Applications Without the Traditional Software Overhead</H2>
          <p className="mt-5 text-muted-foreground">
            Not every operational problem requires another enterprise software purchase. Recouply.ai can design and build
            purpose-built applications around specific business processes, workflows, controls, roles, and data requirements.
            Instead of changing your business to fit another platform, we build around the way your organization needs to operate.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
          <FlowColumn title="Traditional Software Approach" steps={["Buy Platform", "License Users", "Configure Software", "Customize", "Integrate", "Train Teams", "Change Business Process"]} />
          <FlowColumn accent title="Recouply Approach" steps={["Identify Use Case", "Map Workflow", "Define Data + Controls", "Build Application", "Connect Systems", "Deploy", "Iterate"]} />
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-lg font-medium">
          “Build the workflow you need — without buying an entire platform for one use case.”
        </p>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Custom applications complement and connect the ERP, CRM, billing, and finance systems you already use — they don't replace them.
        </p>
      </div>
    </section>
  );
}

/* ---------- Application examples ---------- */
export function AppExamplesSection() {
  const apps = [
    { icon: Handshake, name: "Deal Approval Workspace", text: "Centralize deal reviews, pricing approvals, non-standard terms, finance requirements, and stakeholder decisions." },
    { icon: Receipt, name: "Billing Readiness Application", text: "Validate contracts, orders, customer data, billing triggers, PO requirements, and downstream dependencies before invoices are generated." },
    { icon: AlertTriangle, name: "Revenue Exception Management", text: "Track revenue-impacting exceptions, owners, controls, documentation, approvals, and resolution status." },
    { icon: LayoutList, name: "Collections Workspace", text: "Give teams prioritized accounts, customer activity, disputes, invoice status, risk signals, and recommended actions." },
    { icon: GitBranch, name: "RACI + RAID Transformation Hub", text: "Manage Responsible, Accountable, Consulted, Informed alongside Risks, Assumptions, Issues, and Dependencies — connected to workstreams and processes." },
    { icon: ShieldCheck, name: "Finance Approval Application", text: "Approval workflows for credits, write-offs, refunds, billing adjustments, pricing exceptions, payment terms, and contract exceptions." },
    { icon: BarChart3, name: "Executive Operations Dashboard", text: "Bring together operational KPIs, risks, dependencies, process health, exceptions, decisions, and transformation progress." },
    { icon: Bot, name: "AI Workflow Application", text: "Ask questions like “What is preventing invoices from being generated?” or “Which approvals are waiting on Finance?”" },
  ];
  return (
    <section className="container mx-auto px-4 sm:px-6 py-20">
      <H2 className="text-center">Purpose-Built Applications for Real Business Problems</H2>
      <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">From spreadsheet to workflow. From manual process to business application.</p>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {apps.map((a) => (
          <div key={a.name} className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40">
            <a.icon className="h-5 w-5 text-primary" />
            <h3 className="mt-4 font-semibold">{a.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{a.text}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Examples of potential custom solutions built per engagement — not standard features of the self-service platform.
      </p>
    </section>
  );
}

/* ---------- Build vs buy ---------- */
export function BuildVsBuySection() {
  const buy = ["Additional licenses", "Long implementation cycles", "Consulting fees", "Large configuration projects", "Process compromises", "Change management", "Unused functionality", "Complex administration"];
  const build = ["The specific business problem", "Your existing workflow", "Your required controls", "Your users", "Your data", "Your approval model", "Your systems", "Your reporting requirements"];
  return (
    <section className="container mx-auto px-4 sm:px-6 pb-20">
      <H2 className="text-center">Why Build Instead of Buy?</H2>
      <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-7">
          <h3 className="font-semibold">Buying another platform may require</h3>
          <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
            {buy.map((b) => <li key={b} className="flex gap-2"><XCircle className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground/60" />{b}</li>)}
          </ul>
        </div>
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-7">
          <h3 className="font-semibold">A purpose-built application can focus on</h3>
          <ul className="mt-5 space-y-2 text-sm">
            {build.map((b) => <li key={b} className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-accent" />{b}</li>)}
          </ul>
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Designed to reduce unnecessary implementation complexity and accelerate time to value.
      </p>
    </section>
  );
}

/* ---------- Technology + security ---------- */
export function TechAndSecuritySection() {
  const tech = ["Salesforce", "Workday", "NetSuite", "SAP", "Stripe", "Zuora", "HubSpot", "QuickBooks", "DocuSign", "Data warehouses", "APIs", "Internal databases", "Spreadsheets", "Existing finance systems"];
  const sec = ["Role-based access", "Client-specific workflows", "Data isolation", "Approval controls", "Audit trails", "Authentication", "Environment-specific configuration", "Client-controlled data sources"];
  return (
    <section className="border-y border-border/60 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 py-20 grid gap-12 lg:grid-cols-2">
        <div>
          <H2>Built Around Your Existing Technology Environment</H2>
          <p className="mt-4 text-muted-foreground">Custom applications can work alongside the systems your teams already rely on.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {tech.map((t) => <span key={t} className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm">{t}</span>)}
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            Integration capabilities and architecture depend on client systems, APIs, security requirements, and engagement scope.
          </p>
        </div>
        <div>
          <H2>Designed Around Your Data and Security Requirements</H2>
          <p className="mt-4 text-muted-foreground">
            Custom applications can be designed around client-specific security, access, data, infrastructure, and governance requirements.
          </p>
          <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {sec.map((s) => <li key={s} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-accent shrink-0" />{s}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------- Use case CTA ---------- */
export function UseCaseCTA() {
  return (
    <section className="container mx-auto px-4 sm:px-6 py-20">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8 sm:p-14 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-primary" />
        <H2 className="mt-4 mx-auto max-w-3xl">Have a Business Process That Doesn't Fit Existing Software?</H2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Show us the workflow, problem, spreadsheet, approval chain, or manual process. Recouply can help determine whether
          it should be automated, redesigned, integrated, or turned into a purpose-built business application.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row flex-wrap justify-center gap-3">
          <Button asChild size="lg"><Link to={USE_CASE_HREF}>Discuss Your Use Case <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/o2c-transformation">Explore O2C Transformation</Link></Button>
          <Button asChild size="lg" variant="ghost"><Link to="/signup">Start Free</Link></Button>
        </div>
      </div>
    </section>
  );
}
