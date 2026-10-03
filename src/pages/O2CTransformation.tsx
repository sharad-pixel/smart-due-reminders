import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Search, PenTool, Hammer, ShieldCheck, TrendingUp, Sparkles, CheckCircle2 } from "lucide-react";
import MarketingLayout from "@/components/layout/MarketingLayout";
import SEOHead from "@/components/seo/SEOHead";
import { Button } from "@/components/ui/button";
import { O2C_DOMAINS, PlatformReminder, O2CFinalCTA } from "@/components/marketing/o2c/O2CLandingSections";
import O2CLeadForm from "@/components/marketing/o2c/O2CLeadForm";

const stages = [
  { icon: Search, name: "Discover", text: "Map current-state processes, systems, ownership, controls, exceptions, bottlenecks, and data flows." },
  { icon: PenTool, name: "Design", text: "Develop future-state workflows, operating models, transformation roadmap, KPIs, controls, and automation opportunities." },
  { icon: Hammer, name: "Build", text: "Configure customized workflows, dashboards, approvals, automation, AI capabilities, and integrations." },
  { icon: ShieldCheck, name: "Govern", text: "Manage execution through RACI, RAID, milestones, dependencies, decisions, risks, and executive reporting." },
  { icon: TrendingUp, name: "Optimize", text: "Continuously identify operational bottlenecks, risks, automation opportunities, and process improvements." },
];

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
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Most organizations operate Order-to-Cash across disconnected teams, applications, spreadsheets, approvals,
            and manual processes. Recouply helps design a connected operating model — as an intelligence and workflow
            layer that works alongside your existing ERP, CRM, billing, and accounting systems. No rip-and-replace.
          </p>
          <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2">
            {O2C_DOMAINS.map((d) => <span key={d} className="rounded-full border border-border bg-card px-3 py-1 text-sm">{d}</span>)}
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><a href="#assessment">Request an Assessment</a></Button>
            <Button asChild size="lg" variant="outline"><Link to="/signup">Start Free on the Platform</Link></Button>
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="container mx-auto px-4 sm:px-6 py-20">
        <H2>Transformation Methodology</H2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {stages.map((s, i) => (
            <div key={s.name} className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <s.icon className="h-5 w-5 text-primary" />
                <span className="text-xs font-mono text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold uppercase tracking-wide">{s.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* RACI + RAID */}
      <section className="border-y border-border/60 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 py-20 grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <H2>Move RACI and RAID Beyond the Spreadsheet</H2>
            <p className="mt-4 text-muted-foreground">
              A transformation control center that connects governance directly to your O2C processes.
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
              <div className="font-medium">“What is preventing us from completing the Billing transformation?”</div>
              <div className="mt-2 flex gap-2 text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                Three open issues are affecting the Billing workstream. Two depend on CRM product hierarchy cleanup and one requires a Finance policy decision.
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
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {services.map((s) => (
              <div key={s.name} className="rounded-2xl border border-border bg-card p-7 flex flex-col">
                <h3 className="text-xl font-semibold">{s.name}</h3>
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
            <H2>Request an O2C Assessment</H2>
            <p className="mt-3 text-muted-foreground">
              Just want to use the collections platform? <Link to="/signup" className="text-primary underline">Start free</Link> — no form needed.
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
