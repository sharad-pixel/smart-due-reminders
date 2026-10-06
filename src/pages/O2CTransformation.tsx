import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Search, PenTool, Hammer, ShieldCheck, TrendingUp, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";
import MarketingLayout from "@/components/layout/MarketingLayout";
import SEOHead from "@/components/seo/SEOHead";
import { Button } from "@/components/ui/button";
import { O2C_DOMAINS, PlatformReminder, O2CFinalCTA } from "@/components/marketing/o2c/O2CLandingSections";
import O2CLeadForm from "@/components/marketing/o2c/O2CLeadForm";

const stages = [
  { icon: Search, name: "Discover", items: ["Processes", "Systems", "Teams", "Roles", "Controls", "Data flows", "Approvals", "Exceptions", "Manual processes", "Spreadsheets", "Bottlenecks"] },
  { icon: PenTool, name: "Design", items: ["Future-state process", "RACI", "RAID", "Workflow design", "System requirements", "Controls", "Automation opportunities", "Data requirements", "KPI framework", "Transformation roadmap"] },
  { icon: Hammer, name: "Build", items: ["Custom business applications", "Workflows & approvals", "Dashboards", "AI capabilities", "Integrations"] },
  { icon: ShieldCheck, name: "Govern", items: ["RACI", "RAID", "Milestones", "Risks", "Dependencies", "Decisions", "Controls", "Owners", "Status", "Executive reporting"] },
  { icon: TrendingUp, name: "Optimize", items: ["Process bottlenecks", "Manual activity", "Exceptions", "Delays", "Risks", "Automation opportunities", "Workflow improvements"] },
];

const buildComponents = ["Forms", "Workflow logic", "Dashboards", "Approval chains", "User roles", "Notifications", "AI capabilities", "Data validation", "Exception management", "API integrations", "Reporting", "Audit history", "Business rules"];

const journey = [
  { t: "Business Problem", d: "“We manage this in email and Excel.”" },
  { t: "Process Discovery", d: "How does the process actually work?" },
  { t: "RACI + Controls", d: "Who owns what and what approvals are required?" },
  { t: "Data + Systems", d: "Where does the information come from?" },
  { t: "Application Design", d: "What does the user need to see and do?" },
  { t: "Build", d: "Create the workflow and interface." },
  { t: "Deploy", d: "Launch into the client's environment." },
  { t: "Optimize", d: "Improve using real operational feedback." },
];

const billingRows = [
  { c: "Northwind Labs", o: "SO-1042", po: "Received", appr: "Approved", ex: "—", owner: "Billing Ops", s: "Ready to Bill" },
  { c: "Acme Health", o: "SO-1047", po: "Missing", appr: "Approved", ex: "No customer PO", owner: "Sales Ops", s: "Blocked" },
  { c: "Globex Retail", o: "SO-1051", po: "Received", appr: "Pending Finance", ex: "Non-standard terms", owner: "Controller", s: "At Risk" },
  { c: "Initech", o: "SO-1055", po: "Received", appr: "Approved", ex: "Incomplete contract data", owner: "Deal Desk", s: "Blocked" },
];
const billingStatus: Record<string, string> = {
  "Ready to Bill": "bg-accent/15 text-accent",
  "At Risk": "bg-primary/15 text-primary",
  Blocked: "bg-destructive/15 text-destructive",
};

const workstreams = [
  { w: "Deal Desk", o: "Sales Ops", s: "On Track", r: 2, d: "CLM" },
  { w: "Billing", o: "Finance", s: "At Risk", r: 5, d: "ERP" },
  { w: "Collections", o: "AR", s: "On Track", r: 1, d: "CRM" },
  { w: "Cash Application", o: "Treasury", s: "Blocked", r: 3, d: "Bank" },
  { w: "Revenue", o: "Accounting", s: "On Track", r: 2, d: "Billing" },
];
const statusCls: Record<string, string> = {
  "On Track": "bg-accent/15 text-accent",
  "At Risk": "bg-primary/15 text-primary",
  Blocked: "bg-destructive/15 text-destructive",
};

const ecosystem = ["Salesforce", "HubSpot", "Workday", "NetSuite", "SAP", "Stripe", "Zuora", "QuickBooks", "DocuSign", "Banks", "Data Warehouses"];
const clientSpecific = ["Workflows", "Roles", "Policies", "Controls", "Data mappings", "Approval rules", "AI instructions", "System architecture", "Governance models"];

const services = [
  { name: "O2C Transformation Assessment", cta: "Request an Assessment", items: ["Current-state process mapping", "RACI", "RAID", "System landscape", "Control gaps", "Automation opportunities", "AI opportunities", "KPI framework", "Future-state process", "Transformation roadmap"] },
  { name: "O2C Transformation Implementation", cta: "Discuss a Transformation", items: ["Future-state workflow design", "Workflow development", "Governance", "Automation", "Integration design", "Dashboards", "Controls", "Testing", "Change management", "Deployment support"] },
  { name: "Managed O2C Intelligence", cta: "Explore Managed O2C", items: ["Transformation monitoring", "KPI tracking", "Risk management", "Exception management", "Workflow optimization", "AI recommendations", "Executive reporting"] },
  { name: "Custom Business Application", cta: "Discuss Your Use Case", desc: "For operational workflows that don't justify purchasing or implementing another enterprise platform.", items: ["Process discovery", "Application design", "Workflow development", "Role-based access", "Dashboards", "Approval workflows", "AI capabilities", "Reporting", "Integrations", "Testing", "Deployment", "Iterative enhancement"] },
];

const expertise = ["Collections", "Revenue Accounting", "Billing", "Deal Desk", "Quote-to-Cash", "Order-to-Cash", "Finance Systems", "Revenue Operations", "Controls", "Finance Transformation"];

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">{children}</h2>
);

export default function O2CTransformation() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [hash]);

  return (
    <MarketingLayout>
      <SEOHead
        title="O2C Transformation · Recouply.ai"
        description="Customized Order-to-Cash transformation services designed around your systems, data, controls, and operating model — from assessment to execution."
        canonical="https://recouply.ai/o2c-transformation"
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-primary/15 blur-[140px]" />
        <div className="container relative mx-auto px-4 sm:px-6 py-20 sm:py-24 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">O2C Transformation</div>
          <h1 className="mx-auto mt-4 max-w-4xl text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
            Transform O2C Around the Way Your Business Actually Operates
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-xl text-foreground/85">
            Connect people, processes, systems, controls, data, and AI — and build the workflows or applications your teams actually need.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Recouply.ai helps organizations identify O2C friction, redesign operating processes, implement governance, automate
            workflows, and build custom business applications around specific operational requirements — alongside your existing
            ERP, CRM, billing, and accounting systems.
          </p>
          <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2">
            {O2C_DOMAINS.map((d) => <span key={d} className="rounded-full border border-border bg-card px-3 py-1 text-sm">{d}</span>)}
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><a href="#assessment">Request an O2C Assessment</a></Button>
            <Button asChild size="lg" variant="outline"><a href="#custom-applications">Discuss a Custom Application</a></Button>
            <Button asChild size="lg" variant="ghost"><Link to="/signup">Start Free on the Platform</Link></Button>
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="container mx-auto px-4 sm:px-6 py-20">
        <H2>Assess. Design. Build. Govern. Optimize.</H2>
        <p className="mt-3 max-w-2xl text-muted-foreground">Transform around your business — not the other way around.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {stages.map((s, i) => (
            <div key={s.name} className={`rounded-xl border p-6 ${s.name === "Build" ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
              <div className="flex items-center justify-between">
                <s.icon className="h-5 w-5 text-primary" />
                <span className="text-xs font-mono text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold uppercase tracking-wide">{s.name}</h3>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {s.items.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Build — custom applications */}
      <section id="custom-applications" className="border-y border-border/60 bg-muted/30 scroll-mt-20">
        <div className="container mx-auto px-4 sm:px-6 py-20 grid gap-10 lg:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Build · Custom Business Applications</div>
            <H2>Build the Workflow — Not Another Layer of Complexity</H2>
            <p className="mt-4 text-muted-foreground">
              Where an existing system can solve the problem, Recouply can design around it. Where existing software does not
              fit the use case, Recouply can build a purpose-specific application around the required workflow.
            </p>
            <blockquote className="mt-8 rounded-xl border-l-4 border-primary bg-card p-5 text-lg font-medium">
              “Not every business problem needs another software license.”
            </blockquote>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild><a href="#assessment">Discuss Your Use Case</a></Button>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="text-sm font-semibold">Potential build components</div>
            <div className="mt-5 flex flex-wrap gap-2">
              {buildComponents.map((c) => <span key={c} className="rounded-full border border-border bg-background px-3 py-1.5 text-sm">{c}</span>)}
            </div>
          </div>
        </div>
      </section>

      {/* From use case to application */}
      <section className="container mx-auto px-4 sm:px-6 py-20">
        <H2>Turn a Business Problem Into a Working Application</H2>
        <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {journey.map((j, i) => (
            <li key={j.t} className="relative rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-mono text-primary">0{i + 1}</div>
              <div className="mt-2 text-sm font-semibold">{j.t}</div>
              <div className="mt-1 text-xs text-muted-foreground">{j.d}</div>
              {i < journey.length - 1 && <ArrowRight className="hidden xl:block absolute -right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary bg-background rounded-full" />}
            </li>
          ))}
        </ol>
      </section>

      {/* Example: Billing Readiness */}
      <section className="container mx-auto px-4 sm:px-6 pb-20">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-10">
          <div className="text-xs text-muted-foreground">Illustrative example</div>
          <H2>Example: Billing Readiness Control Center</H2>
          <p className="mt-4 max-w-3xl text-muted-foreground">
            Sales closes a deal, but Finance does not have everything required to invoice. Data is spread across Salesforce,
            contracts, email, ERP, spreadsheets, customer POs, and the billing system. A custom workspace brings it together.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3 max-w-md">
            {[["Ready to Bill", 31], ["At Risk", 8], ["Blocked", 12]].map(([k, v]) => (
              <div key={k} className={`rounded-lg p-3 text-center ${billingStatus[k as string]}`}>
                <div className="text-2xl font-semibold">{v}</div>
                <div className="text-xs font-medium">{k}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead><tr className="text-left text-muted-foreground border-b border-border">
                {["Customer", "Order", "PO Status", "Approval", "Exception", "Owner", "Invoice Readiness"].map((h) => <th key={h} className="py-2 pr-3 font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {billingRows.map((r) => (
                  <tr key={r.o} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-3 font-medium">{r.c}</td><td className="pr-3">{r.o}</td><td className="pr-3">{r.po}</td>
                    <td className="pr-3">{r.appr}</td><td className="pr-3">{r.ex}</td><td className="pr-3">{r.owner}</td>
                    <td><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${billingStatus[r.s]}`}>{r.s}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm flex gap-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>12 orders are currently blocked from billing. Seven are missing customer purchase orders, three require Finance approval, and two have incomplete contract data.</span>
          </div>
        </div>
      </section>

      {/* RACI + RAID */}
      <section className="border-y border-border/60 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 py-20 grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <H2>Govern Transformation in the Same Environment You Build It</H2>
            <p className="mt-4 text-muted-foreground">
              RACI and RAID become interactive operating components — connected to workstreams, owners, and dependencies — rather than static spreadsheets.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
              <div><div className="font-semibold mb-2">RACI</div>{["Responsible", "Accountable", "Consulted", "Informed"].map((x) => <div key={x} className="text-muted-foreground">{x}</div>)}</div>
              <div><div className="font-semibold mb-2">RAID</div>{["Risks", "Assumptions", "Issues", "Dependencies"].map((x) => <div key={x} className="text-muted-foreground">{x}</div>)}</div>
            </div>
          </div>
          <div className="lg:col-span-3 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div className="text-xs text-muted-foreground mb-3">Illustrative example</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead><tr className="text-left text-muted-foreground border-b border-border">
                  {["Workstream", "Owner", "Status", "Risks", "Dependencies"].map((h) => <th key={h} className="py-2 pr-3 font-medium">{h}</th>)}
                </tr></thead>
                <tbody>
                  {workstreams.map((r) => (
                    <tr key={r.w} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-3 font-medium">{r.w}</td>
                      <td className="pr-3">{r.o}</td>
                      <td className="pr-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusCls[r.s]}`}>{r.s}</span></td>
                      <td className="pr-3">{r.r}</td>
                      <td>{r.d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm">
              <div className="font-medium">“What is preventing Billing from going live?”</div>
              <div className="mt-2 flex gap-2 text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                The primary blockers are customer master cleanup and ERP configuration. Both dependencies affect 60% of currently open Billing issues.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Client-specific workflows */}
      <section className="container mx-auto px-4 sm:px-6 py-20 text-center">
        <H2>Your Systems. Your Data. Your O2C.</H2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Recouply designs transformation workflows around your existing technology environment rather than forcing
          your organization into a predefined operating model.
        </p>
        <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2">
          {ecosystem.map((e) => <span key={e} className="rounded-lg border border-border bg-card px-4 py-2 text-sm">{e}</span>)}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">Integration and workflow design may vary based on client systems and engagement scope.</p>
      </section>

      {/* Client environments */}
      <section className="container mx-auto px-4 sm:px-6 pb-20">
        <div className="rounded-2xl border border-border bg-card p-8 sm:p-12 grid gap-8 lg:grid-cols-2">
          <div>
            <H2>Designed Around Client-Specific Requirements</H2>
            <p className="mt-4 text-muted-foreground">
              Transformation solutions can be designed around client-specific security, access, infrastructure, and data requirements.
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-3 text-sm">
            {clientSpecific.map((c) => <li key={c} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-accent" />{c}</li>)}
          </ul>
        </div>
      </section>

      {/* Services */}
      <section className="border-t border-border/60 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 py-20">
          <H2>From O2C Assessment to Transformation Execution</H2>
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {services.map((s) => (
              <div key={s.name} className="rounded-2xl border border-border bg-card p-7 flex flex-col">
                <h3 className="text-xl font-semibold">{s.name}</h3>
                {"desc" in s && s.desc && <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>}
                <ul className="mt-5 space-y-2 text-sm">
                  {s.items.map((i) => <li key={i} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />{i}</li>)}
                </ul>
                <Button asChild className="mt-auto" variant="outline"><a href="#assessment" className="mt-8">{s.cta}</a></Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Recouply */}
      <section className="container mx-auto px-4 sm:px-6 py-20 text-center">
        <H2>O2C Expertise Meets Modern AI and Workflow Technology</H2>
        <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2">
          {expertise.map((e) => <span key={e} className="rounded-full border border-border px-3 py-1 text-sm">{e}</span>)}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-lg">
          O2C transformation should fit your business — your systems, your teams, your data, and your controls.
        </p>
      </section>

      {/* Lead form */}
      <section id="assessment" className="container mx-auto px-4 sm:px-6 py-20 scroll-mt-20">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-8">
            <H2>Request an O2C Assessment or Discuss Your Use Case</H2>
            <p className="mt-3 text-muted-foreground">
              Just want to use the Revenue Intelligence platform? <Link to="/signup" className="text-primary underline">Start free</Link> — no form needed.
            </p>
          </div>
          <O2CLeadForm />
        </div>
      </section>

      <PlatformReminder />
      <O2CFinalCTA />
    </MarketingLayout>
  );
}
