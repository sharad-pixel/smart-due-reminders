import MarketingLayout from "@/components/layout/MarketingLayout";
import SEOHead from "@/components/seo/SEOHead";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  FileSignature,
  ScrollText,
  Bot,
  ShieldCheck,
  GitBranch,
  Workflow,
  Sparkles,
  FileSearch,
  Library,
  Users,
  PenLine,
  Gauge,
  Lock,
  CheckCircle2,
  ArrowRight,
  CalendarClock,
  Layers,
  Building2,
} from "lucide-react";

const ContractIntelligence = () => {
  const navigate = useNavigate();

  const goContact = () => navigate("/contact-us?topic=clm");

  const pillars = [
    {
      icon: FileSearch,
      title: "AI Contract Extraction",
      desc: "GPT-5 reads every contract — parties, term, renewal, payment, liability, indemnity, SLAs, governing law — and turns it into structured intelligence.",
    },
    {
      icon: Library,
      title: "Templates & Clause Library",
      desc: "Reusable Order Forms, MSAs, NDAs, BAAs, DPAs with a governed clause library. Generate compliant contracts in minutes, not weeks.",
    },
    {
      icon: GitBranch,
      title: "Versioning & Redlines",
      desc: "Full version history, side-by-side diffs, restore points. Every edit tracked, every comment preserved, every revision auditable.",
    },
    {
      icon: Users,
      title: "Collaboration & Approvals",
      desc: "Internal reviewers, external counterparties, comment threads, approval workflows, and a Deal Desk workspace for legal & revenue teams.",
    },
    {
      icon: PenLine,
      title: "DocuSign E-Signature",
      desc: "Native DocuSign integration. Send for signature, track status, capture signed PDFs — all linked back to the contract record.",
    },
    {
      icon: Workflow,
      title: "Obligations & Renewals",
      desc: "Automated renewal alerts, obligation tracking, and milestone reminders so nothing slips through the cracks.",
    },
  ];

  const intelligence = [
    {
      icon: Sparkles,
      title: "Risk & Anomaly Detection",
      desc: "AI flags unusual terms, missing clauses, off-market liability caps, and inconsistencies across your portfolio.",
    },
    {
      icon: Gauge,
      title: "Revenue Linkage",
      desc: "Connect contracts to invoices, payments, and ECL signals from Recouply Collections — see the financial impact of every agreement.",
    },
    {
      icon: ShieldCheck,
      title: "Audit-Ready Compliance",
      desc: "Immutable audit logs, SOC 2-aligned controls, GDPR-compliant storage, and exportable evidence for every action.",
    },
  ];

  const audience = [
    { icon: Building2, title: "Legal Teams", desc: "Centralize the contract lifecycle without leaving your stack." },
    { icon: Layers, title: "Revenue Operations", desc: "Tie every signed deal directly to billing, collections, and ECL." },
    { icon: ShieldCheck, title: "Finance & Audit", desc: "Defensible records, immutable trails, board-ready reporting." },
  ];

  return (
    <MarketingLayout>
      <SEOHead
        title="Recouply Contract Intelligence"
        description="An AI-native Contract Intelligence module for Recouply.ai. Generate, negotiate, sign, and govern contracts — linked directly to revenue, collections, and risk."
        keywords="contract intelligence, contract lifecycle, AI contracts, DocuSign, contract automation, legal AI"
        canonical="https://recouply.ai/clm"
      />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />
        <div className="container mx-auto px-4 py-24 lg:py-32 relative">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs uppercase tracking-widest">
              <Sparkles className="w-3 h-3 mr-2 inline" />
              New Module · Sales-Led Availability
            </Badge>
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mb-6">
              Contract Intelligence,
              <br />
              <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                Wired Into Revenue.
              </span>
            </h1>
            <p className="text-xl lg:text-2xl text-muted-foreground mb-10 leading-relaxed">
              Recouply Contract Intelligence is an AI-native module that generates, negotiates,
              signs, and governs every agreement — linked directly to the invoices, payments,
              and risk signals already running in Recouply.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={goContact} className="gap-2 text-base px-8">
                <CalendarClock className="w-5 h-5" />
                Book a Contract Intelligence Demo
              </Button>
              <Button size="lg" variant="outline" onClick={goContact} className="gap-2 text-base px-8">
                Talk to Sales
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-6 uppercase tracking-wider">
              Available as a separately purchased add-on · Enterprise pricing
            </p>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="py-20 lg:py-28 border-b border-border">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <Badge variant="outline" className="mb-4">Why Contract Intelligence, Why Now</Badge>
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              Your contracts are the source of every dollar you're owed.
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Yet most companies still manage them in shared drives, email threads, and spreadsheets.
              Recouply Contract Intelligence treats contracts as a first-class financial asset — extracting terms,
              tracking obligations, and connecting every clause to the revenue it represents.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { stat: "60%", label: "of revenue leakage traces back to missed contract terms" },
              { stat: "9.2hrs", label: "average time legal teams spend per contract redline cycle" },
              { stat: "1 hr", label: "with Recouply Contract Intelligence — AI-extracted, reviewed, and signed" },
            ].map((s, i) => (
              <Card key={i} className="p-8 text-center border-2 hover:border-primary/40 transition-colors">
                <div className="text-5xl font-bold text-primary mb-3">{s.stat}</div>
                <div className="text-sm text-muted-foreground leading-relaxed">{s.label}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* PILLARS */}
      <section className="py-20 lg:py-28 border-b border-border bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <Badge variant="outline" className="mb-4">The Module</Badge>
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              Six pillars. One contract OS.
            </h2>
            <p className="text-lg text-muted-foreground">
              Built natively into Recouply.ai — not bolted on. Every pillar shares the same
              auth, the same audit trail, and the same data model as your collections and risk stack.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {pillars.map((p, i) => (
              <Card key={i} className="p-7 hover:shadow-lg hover:border-primary/40 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <p.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* INTELLIGENCE LAYER */}
      <section className="py-20 lg:py-28 border-b border-border">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
            <div>
              <Badge variant="outline" className="mb-4">The Intelligence Layer</Badge>
              <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                GPT-5 reads every contract so your team doesn't have to.
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Upload a PDF, DOCX, or scanned image. Within seconds, Recouply CLM extracts
                parties, term length, renewal mechanics, payment schedules, liability caps,
                indemnities, governing law, and SLAs — and surfaces what's off-market.
              </p>
              <div className="space-y-4">
                {intelligence.map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold mb-1">{item.title}</div>
                      <div className="text-sm text-muted-foreground">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Card className="p-6 border-2 bg-gradient-to-br from-card to-muted/30">
              <div className="flex items-center gap-2 mb-4 pb-4 border-b">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="text-sm font-medium">CLM Intelligence Panel</div>
                <Badge variant="secondary" className="ml-auto text-xs">GPT-5</Badge>
              </div>
              <div className="space-y-3 text-sm">
                {[
                  { k: "Counterparty", v: "Acme Corp.", ok: true },
                  { k: "Term", v: "36 months · auto-renew", ok: true },
                  { k: "Net terms", v: "Net 60 (off-market)", ok: false },
                  { k: "Liability cap", v: "12 mo. fees", ok: true },
                  { k: "Indemnity", v: "Mutual · capped", ok: true },
                  { k: "Governing law", v: "Delaware", ok: true },
                  { k: "Renewal notice", v: "90 days · ⚠ tight", ok: false },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <span className="text-muted-foreground text-xs uppercase tracking-wider">{row.k}</span>
                    <span className="flex items-center gap-2 font-medium">
                      {row.ok ? (
                        <CheckCircle2 className="w-4 h-4 text-accent" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-amber-500" />
                      )}
                      {row.v}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="text-xs text-muted-foreground mb-2">AI Recommendations</div>
                <div className="text-sm">Negotiate Net 30 to align with collections cadence; widen renewal notice to 120 days.</div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CONNECTED TO RECOUPLY */}
      <section className="py-20 lg:py-28 border-b border-border bg-primary/5">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <Badge variant="outline" className="mb-4">Native to Recouply</Badge>
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              Contracts ↔ Invoices ↔ Collections ↔ Risk.
            </h2>
            <p className="text-lg text-muted-foreground">
              Most CLM tools end at signature. Recouply CLM connects every executed contract
              to the invoices it generates, the payments it produces, and the Expected Credit
              Loss it carries — closing the loop between legal and finance.
            </p>
          </div>

          <Card className="max-w-4xl mx-auto p-8 lg:p-10">
            <div className="grid md:grid-cols-4 gap-4 items-center">
              {[
                { icon: ScrollText, label: "Contract Signed" },
                { icon: FileSignature, label: "Invoice Created" },
                { icon: Workflow, label: "Collections Workflow" },
                { icon: Gauge, label: "ECL & Risk Score" },
              ].map((step, i, arr) => (
                <div key={i} className="flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mb-3">
                    <step.icon className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-semibold">{step.label}</div>
                  {i < arr.length - 1 && (
                    <ArrowRight className="w-5 h-5 text-muted-foreground mt-3 hidden md:block absolute" style={{ transform: "translateX(120px)" }} />
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* AUDIENCE */}
      <section className="py-20 lg:py-28 border-b border-border">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <Badge variant="outline" className="mb-4">Built For</Badge>
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              One module. Three teams. Zero friction.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {audience.map((a, i) => (
              <Card key={i} className="p-8">
                <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-5">
                  <a.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{a.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{a.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section className="py-20 border-b border-border bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start gap-6 flex-col md:flex-row">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <Lock className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-3xl font-bold mb-3">Enterprise security, by default.</h2>
                <p className="text-muted-foreground mb-4 leading-relaxed">
                  Tenant-isolated storage, row-level security on every table, immutable audit logs,
                  encrypted documents at rest, SOC 2-aligned controls, and GDPR-compliant data handling.
                  Every action — view, edit, send, sign — is logged and exportable.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["SOC 2 Type II aligned", "GDPR", "Immutable audit", "RLS isolation", "Encrypted at rest", "DocuSign certified"].map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SALES CTA */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4">
          <Card className="max-w-4xl mx-auto p-10 lg:p-14 text-center border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-accent/5">
            <Badge variant="secondary" className="mb-6">Sales-Led Availability</Badge>
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              Ready to see Recouply CLM in action?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Recouply CLM is a separately purchased module, available exclusively through our
              sales team. Book a tailored demo and we'll walk you through the platform with
              your contracts, your workflow, and your stack.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={goContact} className="gap-2 text-base px-8">
                <CalendarClock className="w-5 h-5" />
                Book a CLM Demo
              </Button>
              <Button size="lg" variant="outline" onClick={goContact} className="gap-2 text-base px-8">
                Contact Sales
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-6">
              No trial · No self-serve · Pricing tailored to your portfolio
            </p>
          </Card>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default ContractIntelligence;
