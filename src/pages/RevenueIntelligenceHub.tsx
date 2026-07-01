import { Link } from "react-router-dom";
import MarketingLayout from "@/components/layout/MarketingLayout";
import SEOHead from "@/components/seo/SEOHead";
import { Button } from "@/components/ui/button";
import { Brain, FileSignature, ArrowRight, Workflow, ShieldCheck, LineChart, Sparkles, GitMerge } from "lucide-react";

const RevenueIntelligenceHub = () => {
  return (
    <MarketingLayout>
      <SEOHead
        title="Revenue Intelligence | Collections + Contract Intelligence — Recouply.ai"
        description="Recouply's Revenue Intelligence unifies Collections Intelligence and Contract Intelligence into one enterprise system — connecting every clause, invoice, payment, and risk signal across the revenue lifecycle."
        keywords="revenue intelligence, collections intelligence, contract intelligence, AR intelligence, enterprise revenue platform"
        canonical="https://recouply.ai/revenue-intelligence"
      />

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-background via-primary/5 to-background">
        <div className="absolute inset-0 -z-10 opacity-30 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.25),transparent_60%),radial-gradient(circle_at_75%_80%,hsl(var(--accent)/0.25),transparent_55%)]" />
        <div className="container mx-auto px-4 py-20 sm:py-28 text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold tracking-wider uppercase text-primary mb-6">
            <Sparkles className="h-3.5 w-3.5" /> Enterprise Revenue Intelligence
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
            Where every <span className="text-primary">contract</span> meets every <span className="text-primary">collection</span>.
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-10">
            Revenue Intelligence is Recouply's unified system of record for the entire revenue lifecycle —
            two intelligences, one source of truth. Contract terms inform collections strategy.
            Collections signals re-price contract risk. The loop never breaks.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/collection-intelligence">
              <Button size="lg" className="w-full sm:w-auto">
                Explore Collections Intelligence <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/contract-intelligence">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Explore Contract Intelligence <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* TWO PILLARS */}
      <section className="container mx-auto px-4 py-16 sm:py-24">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Collections Intelligence */}
          <Link
            to="/collection-intelligence"
            className="group relative rounded-2xl border border-border bg-card p-8 hover:border-primary/60 hover:shadow-xl transition-all overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-2xl -translate-y-10 translate-x-10" />
            <div className="relative">
              <div className="inline-flex p-3 rounded-xl bg-primary/10 text-primary mb-5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Brain className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Collections Intelligence</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Real-time Collectability Scores, Expected Credit Loss, AI-orchestrated outreach, and
                autonomous agents that recover revenue with audit-grade traceability.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                <li className="flex gap-2"><LineChart className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Collectability Scores &amp; ECL (ASC 326 / IFRS 9)</li>
                <li className="flex gap-2"><Workflow className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Autonomous AI outreach &amp; escalations</li>
                <li className="flex gap-2"><ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Engagement &amp; sentiment risk signals</li>
              </ul>
              <span className="inline-flex items-center text-primary font-semibold text-sm">
                Open Collections Intelligence <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </Link>

          {/* Contract Intelligence */}
          <Link
            to="/contract-intelligence"
            className="group relative rounded-2xl border border-border bg-card p-8 hover:border-primary/60 hover:shadow-xl transition-all overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-accent/20 to-transparent rounded-full blur-2xl -translate-y-10 translate-x-10" />
            <div className="relative">
              <div className="inline-flex p-3 rounded-xl bg-primary/10 text-primary mb-5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <FileSignature className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Contract Intelligence</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Extract contract data and orchestrate automation. Renewal and opt-out
                date reminders and custom triggers so you never miss a key event — inside
                the only platform designed as a Finance CRM.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                <li className="flex gap-2"><Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Extract contract data from PDFs &amp; manual entry</li>
                <li className="flex gap-2"><ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Renewal &amp; opt-out reminders + custom triggers</li>
                <li className="flex gap-2"><LineChart className="h-4 w-4 text-primary shrink-0 mt-0.5" /> The only platform designed as a Finance CRM</li>
              </ul>
              <span className="inline-flex items-center text-primary font-semibold text-sm">
                Open Contract Intelligence <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* THE OVERLAP — enterprise framing */}
      <section className="bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4 py-20 max-w-5xl">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold tracking-wider uppercase text-primary mb-4">
              <GitMerge className="h-3.5 w-3.5" /> The Intelligence Loop
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Two intelligences. One operating system for revenue.</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              In legacy stacks, contracts and AR live in different silos. In Recouply, they share the same graph —
              so every clause feeds risk scoring, and every payment behavior feeds contract strategy.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: FileSignature, title: "Contract → Collections", body: "Payment terms, milestones, and termination clauses flow into outreach cadence, dunning logic, and ECL." },
              { icon: GitMerge, title: "Shared Signal Graph", body: "One debtor, one contract, one ledger. AI agents reason across both surfaces simultaneously." },
              { icon: Brain, title: "Collections → Contract", body: "Late payments, disputes, and engagement decay flag renewal risk and re-price expansion exposure." },
            ].map((c) => (
              <div key={c.title} className="rounded-xl border border-border bg-card p-6">
                <div className="inline-flex p-2 rounded-lg bg-primary/10 text-primary mb-4">
                  <c.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{c.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>

          {/* Loop diagram */}
          <div className="mt-12 rounded-2xl border border-border bg-card p-6 sm:p-10">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 md:gap-2 justify-between">
              <div className="flex-1 text-center p-5 rounded-xl bg-primary/5 border border-primary/20">
                <FileSignature className="h-6 w-6 text-primary mx-auto mb-2" />
                <div className="font-semibold">Contract Signed</div>
                <div className="text-xs text-muted-foreground mt-1">Terms ingested by AI</div>
              </div>
              <ArrowRight className="hidden md:block h-5 w-5 text-muted-foreground mx-2" />
              <div className="flex-1 text-center p-5 rounded-xl bg-primary/5 border border-primary/20">
                <Workflow className="h-6 w-6 text-primary mx-auto mb-2" />
                <div className="font-semibold">Invoice &amp; Outreach</div>
                <div className="text-xs text-muted-foreground mt-1">Aligned to clauses</div>
              </div>
              <ArrowRight className="hidden md:block h-5 w-5 text-muted-foreground mx-2" />
              <div className="flex-1 text-center p-5 rounded-xl bg-primary/5 border border-primary/20">
                <LineChart className="h-6 w-6 text-primary mx-auto mb-2" />
                <div className="font-semibold">Risk &amp; ECL</div>
                <div className="text-xs text-muted-foreground mt-1">Re-scored continuously</div>
              </div>
              <ArrowRight className="hidden md:block h-5 w-5 text-muted-foreground mx-2" />
              <div className="flex-1 text-center p-5 rounded-xl bg-primary/5 border border-primary/20">
                <Brain className="h-6 w-6 text-primary mx-auto mb-2" />
                <div className="font-semibold">Renewal Strategy</div>
                <div className="text-xs text-muted-foreground mt-1">Feeds next contract</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ENTERPRISE PROOF */}
      <section className="container mx-auto px-4 py-20 max-w-5xl">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Built for enterprise revenue operations.</h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              SOC 2-aligned controls, RLS-isolated data, ASC 606 / 326 and IFRS 9-ready outputs, and
              audit-grade traceability across every AI decision — whether it's a contract extraction or
              a collections escalation.
            </p>
            <div className="flex flex-wrap gap-2">
              {["SOC 2-aligned", "ASC 606", "ASC 326 (CECL)", "IFRS 9", "GDPR", "RLS Isolation"].map((b) => (
                <span key={b} className="px-3 py-1 rounded-full bg-muted text-xs font-medium border border-border">{b}</span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-8">
            <h3 className="font-semibold text-lg mb-4">One platform, two intelligences</h3>
            <div className="space-y-3 text-sm">
              <Link to="/collection-intelligence" className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                <span className="flex items-center gap-3"><Brain className="h-4 w-4 text-primary" /> Collections Intelligence</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link to="/contract-intelligence" className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                <span className="flex items-center gap-3"><FileSignature className="h-4 w-4 text-primary" /> Contract Intelligence</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link to="/revenue-risk-intelligence" className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                <span className="flex items-center gap-3"><LineChart className="h-4 w-4 text-primary" /> Revenue Risk Intelligence</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
        <div className="container mx-auto px-4 py-16 text-center max-w-3xl">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">See the loop run on your data.</h2>
          <p className="text-primary-foreground/90 text-lg mb-8">
            Start a 7-day trial and watch contracts and collections speak the same language.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/signup"><Button size="lg" variant="secondary">Start Free Trial</Button></Link>
            <Link to="/contact"><Button size="lg" variant="outline" className="bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10">Talk to Sales</Button></Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default RevenueIntelligenceHub;
