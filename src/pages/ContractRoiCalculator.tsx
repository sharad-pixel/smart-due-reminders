import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import MarketingLayout from "@/components/layout/MarketingLayout";
import SEOHead from "@/components/seo/SEOHead";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  CalendarClock,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Zap,
  CheckCircle2,
  TrendingDown,
  RefreshCw,
  FileSearch,
  BellRing,
} from "lucide-react";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(n)));

const fmtMultiple = (n: number) => {
  if (!isFinite(n) || n <= 0) return "—";
  if (n >= 100) return `${Math.round(n)}x`;
  return `${n.toFixed(1)}x`;
};

// Recouply Contract Intelligence: post-signature monitoring of signed
// agreements. Priced as a per-active-contract intelligence credit.
const COST_PER_CONTRACT = 12;

const ContractRoiCalculator = () => {
  const [activeContracts, setActiveContracts] = useState(180);
  const [avgContractValue, setAvgContractValue] = useState(85000);
  const [autoRenewalPct, setAutoRenewalPct] = useState(40); // % of contracts with auto-renew
  const [silentRenewalRate, setSilentRenewalRate] = useState(15); // % rolling silently each year
  const [leakagePct, setLeakagePct] = useState(3); // missed escalators / SLA credits / overages
  const [riskExposurePct, setRiskExposurePct] = useState(8); // % of ACV exposed to unflagged risk clauses

  const results = useMemo(() => {
    const portfolioValue = activeContracts * avgContractValue;

    // Renewal radar — surface every renewal date 90/60/30 days out.
    // Silent auto-renewals on bad terms are caught and renegotiated.
    // Conservatively: 70% of silent renewals get intercepted, 8% uplift on those.
    const renewalsAtRisk = activeContracts * (autoRenewalPct / 100) *
      (silentRenewalRate / 100);
    const renewalValueSaved = renewalsAtRisk * avgContractValue * 0.08 * 0.7;

    // Key date intelligence — termination windows, price-step dates, notice
    // periods, SLA review dates. Assume ~4 critical dates per contract,
    // historically ~12% missed, AI catches 90% of those.
    const keyDatesTracked = activeContracts * 4;
    const keyDatesCaught = keyDatesTracked * 0.12 * 0.9;
    const keyDateValueSaved = keyDatesCaught * (avgContractValue * 0.015);

    // AI risk assessments — flags unusual liability caps, missing indemnities,
    // open-ended SLAs, off-template language. Recovers 60% of risk-weighted exposure.
    const riskExposureValue = portfolioValue * (riskExposurePct / 100);
    const riskMitigated = riskExposureValue * 0.6;

    // Revenue leakage — escalators not invoiced, SLA credits not claimed,
    // usage overages missed. AI clause monitoring recovers ~60%.
    const leakageRecovered = portfolioValue * (leakagePct / 100) * 0.6;

    const totalImpact =
      renewalValueSaved + keyDateValueSaved + riskMitigated + leakageRecovered;
    const platformCost = activeContracts * COST_PER_CONTRACT;
    const netSavings = totalImpact - platformCost;
    const roiMultiple = platformCost > 0 ? totalImpact / platformCost : 0;

    return {
      portfolioValue,
      renewalsAtRisk,
      renewalValueSaved,
      keyDatesTracked,
      keyDatesCaught,
      keyDateValueSaved,
      riskExposureValue,
      riskMitigated,
      leakageRecovered,
      totalImpact,
      platformCost,
      netSavings,
      roiMultiple,
    };
  }, [
    activeContracts,
    avgContractValue,
    autoRenewalPct,
    silentRenewalRate,
    leakagePct,
    riskExposurePct,
  ]);

  return (
    <MarketingLayout>
      <SEOHead
        title="Contract Risk & Renewal ROI Calculator — Recouply.ai"
        description="See what missed renewals, unflagged risk clauses, and overlooked key dates are costing you. AI intelligence for signed agreements — quantified in seconds."
        keywords="contract risk ROI, renewal management ROI, contract intelligence, key date tracking, auto-renewal risk, AI contract risk assessment, signed agreement monitoring"
        canonical="https://recouply.ai/contract-roi-calculator"
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-accent/5 py-16 md:py-20">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto text-center"
          >
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="w-3 h-3 mr-1" /> AI intelligence for signed agreements
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
              What are missed renewals & risk clauses{" "}
              <span className="text-accent">costing you?</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              This isn't CLM. Once a contract is signed, Recouply reads it,
              tracks every key date, and flags the risks your team would
              otherwise discover the hard way. See the value in seconds.
            </p>
          </motion.div>

          {/* Capability strip */}
          <div className="max-w-4xl mx-auto mt-10 grid sm:grid-cols-4 gap-3">
            {[
              { icon: CalendarClock, label: "Renewal radar", sub: "90 / 60 / 30 day alerts" },
              { icon: BellRing, label: "Key date tracking", sub: "Notice & price-step dates" },
              { icon: FileSearch, label: "AI clause review", sub: "Risk-scored on ingest" },
              { icon: ShieldAlert, label: "Risk callouts", sub: "Liability, SLA, indemnity" },
            ].map(({ icon: Icon, label, sub }) => (
              <div
                key={label}
                className="rounded-lg border bg-background/60 backdrop-blur-sm p-3 text-left"
              >
                <Icon className="w-4 h-4 text-accent mb-1.5" />
                <div className="text-sm font-semibold">{label}</div>
                <div className="text-xs text-muted-foreground">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Calculator */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
            {/* Inputs */}
            <Card className="lg:col-span-2 border-2">
              <CardContent className="p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Your signed contract portfolio</h2>
                  <p className="text-sm text-muted-foreground">
                    Active agreements you've already signed — what's the AI watching?
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="active-contracts">Active contracts under management</Label>
                  <Input
                    id="active-contracts"
                    type="number"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={activeContracts}
                    onChange={(e) =>
                      setActiveContracts(Math.max(0, Number(e.target.value)))
                    }
                  />
                  <Slider
                    value={[activeContracts]}
                    onValueChange={([v]) => setActiveContracts(v)}
                    min={10}
                    max={3000}
                    step={10}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="acv">Average contract value</Label>
                  <Input
                    id="acv"
                    type="number"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={avgContractValue}
                    onChange={(e) =>
                      setAvgContractValue(Math.max(0, Number(e.target.value)))
                    }
                  />
                  <Slider
                    value={[avgContractValue]}
                    onValueChange={([v]) => setAvgContractValue(v)}
                    min={1000}
                    max={1000000}
                    step={1000}
                  />
                </div>

                <div className="space-y-2">
                  <Label>% of contracts with auto-renewal</Label>
                  <div className="grid grid-cols-4 gap-1">
                    {[20, 40, 60, 80].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setAutoRenewalPct(p)}
                        className={`text-xs py-2 px-1 rounded-md border transition-colors ${
                          autoRenewalPct === p
                            ? "bg-accent text-accent-foreground border-accent"
                            : "bg-background hover:bg-muted border-border"
                        }`}
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>% rolling silently each year (missed notice window)</Label>
                  <div className="grid grid-cols-4 gap-1">
                    {[5, 10, 15, 25].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSilentRenewalRate(p)}
                        className={`text-xs py-2 px-1 rounded-md border transition-colors ${
                          silentRenewalRate === p
                            ? "bg-accent text-accent-foreground border-accent"
                            : "bg-background hover:bg-muted border-border"
                        }`}
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Portfolio exposure to risky / off-template clauses</Label>
                  <div className="grid grid-cols-4 gap-1">
                    {[3, 8, 12, 18].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setRiskExposurePct(p)}
                        className={`text-xs py-2 px-1 rounded-md border transition-colors ${
                          riskExposurePct === p
                            ? "bg-accent text-accent-foreground border-accent"
                            : "bg-background hover:bg-muted border-border"
                        }`}
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Uncapped liability, weak indemnity, open-ended SLAs, missing audit rights.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Revenue leakage (missed escalators, SLA credits, overages)</Label>
                  <div className="grid grid-cols-4 gap-1">
                    {[1, 3, 5, 8].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setLeakagePct(p)}
                        className={`text-xs py-2 px-1 rounded-md border transition-colors ${
                          leakagePct === p
                            ? "bg-accent text-accent-foreground border-accent"
                            : "bg-background hover:bg-muted border-border"
                        }`}
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            <div className="lg:col-span-3 space-y-4">
              <motion.div
                key={results.totalImpact}
                initial={{ scale: 0.98, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-2 border-accent/40 bg-gradient-to-br from-accent/5 to-primary/5">
                  <CardContent className="p-6 md:p-8">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <TrendingDown className="w-4 h-4" /> Hidden cost of un-watched contracts
                    </div>
                    <div className="text-5xl md:text-6xl font-bold text-accent mb-2">
                      {fmt(results.totalImpact)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Annual value of caught renewals, tracked key dates,
                      mitigated risk, and recovered leakage across{" "}
                      {activeContracts.toLocaleString()} contracts
                      ({fmt(results.portfolioValue)} portfolio).
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      <RefreshCw className="w-3.5 h-3.5" /> Renewals intercepted
                    </div>
                    <div className="text-2xl font-bold">
                      {fmt(results.renewalValueSaved)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.round(results.renewalsAtRisk).toLocaleString()} silent
                      auto-renewals surfaced before notice deadline
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      <CalendarClock className="w-3.5 h-3.5" /> Key dates caught
                    </div>
                    <div className="text-2xl font-bold">
                      {fmt(results.keyDateValueSaved)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ~{Math.round(results.keyDatesCaught).toLocaleString()} critical
                      dates surfaced (of {results.keyDatesTracked.toLocaleString()} tracked)
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> AI risk mitigated
                    </div>
                    <div className="text-2xl font-bold">
                      {fmt(results.riskMitigated)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Of {fmt(results.riskExposureValue)} portfolio exposure flagged on ingest
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Leakage recovered
                    </div>
                    <div className="text-2xl font-bold">
                      {fmt(results.leakageRecovered)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Escalators billed, SLA credits enforced, overages invoiced
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-accent/40 bg-accent/5">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                        Recouply Contract Intelligence cost
                      </div>
                      <div className="text-xl font-semibold">
                        {fmt(results.platformCost)}/yr
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {activeContracts.toLocaleString()} contracts × ${COST_PER_CONTRACT}/contract
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                        Net annual savings
                      </div>
                      <div className="text-xl font-semibold text-accent">
                        {fmt(results.netSavings)}/yr
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-accent text-accent-foreground">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-sm opacity-90 mb-1">
                        Estimated ROI on signed-contract intelligence
                      </div>
                      <div className="text-4xl font-bold">
                        {fmtMultiple(results.roiMultiple)}
                      </div>
                      <p className="text-xs opacity-80 mt-1">
                        Total impact ÷ platform cost
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button asChild size="lg" variant="secondary">
                        <Link to="/contract-intelligence">
                          Book a demo <ArrowRight className="w-4 h-4 ml-1" />
                        </Link>
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="text-accent-foreground hover:bg-accent-foreground/10"
                      >
                        <Link to="/roi-calculator">
                          See collections ROI
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid sm:grid-cols-3 gap-3 pt-2">
                {[
                  "Upload any PDF / DOCX",
                  "AI clause + risk extraction",
                  "Renewal & key-date alerts",
                ].map((t) => (
                  <div
                    key={t}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <CheckCircle2 className="w-4 h-4 text-accent" /> {t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What the AI watches */}
      <section className="py-12 md:py-16 border-t bg-muted/20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <Badge variant="outline" className="mb-3">
              <Zap className="w-3 h-3 mr-1" /> Post-signature intelligence
            </Badge>
            <h2 className="text-3xl font-bold mb-3">
              What Recouply watches in every signed agreement
            </h2>
            <p className="text-muted-foreground">
              Drop in your executed PDFs. Within minutes, every contract is
              read, scored, and wired into a calendar of risk and revenue events.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: CalendarClock,
                title: "Renewal & key dates",
                points: [
                  "Auto-renewal & notice windows",
                  "Termination & opt-out dates",
                  "Price-step & escalator dates",
                  "SLA review & true-up periods",
                ],
              },
              {
                icon: FileSearch,
                title: "AI clause review",
                points: [
                  "Liability caps & carve-outs",
                  "Indemnification scope",
                  "Data, IP & confidentiality terms",
                  "Off-template language flagged",
                ],
              },
              {
                icon: ShieldAlert,
                title: "Risk assessments & callouts",
                points: [
                  "Per-contract risk score",
                  "Portfolio risk heatmap",
                  "Unusual obligations surfaced",
                  "Action queue with owner & due date",
                ],
              },
            ].map(({ icon: Icon, title, points }) => (
              <Card key={title} className="border-2">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold mb-3">{title}</h3>
                  <ul className="space-y-2">
                    {points.map((p) => (
                      <li
                        key={p}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="py-12 bg-muted/30 border-t">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl font-bold mb-4">How we calculate it</h2>
          <div className="grid md:grid-cols-2 gap-6 text-sm text-muted-foreground">
            <div>
              <div className="font-semibold text-foreground mb-1">Renewals intercepted</div>
              Auto-renewal share × silent-rollover rate × 70% intercept rate × 8%
              negotiation uplift on intercepted contracts. AI surfaces every
              upcoming renewal at 90 / 60 / 30 days before the notice window closes.
            </div>
            <div>
              <div className="font-semibold text-foreground mb-1">Key dates caught</div>
              ~4 critical dates per contract (notice, price-step, SLA review,
              termination). Industry baseline: 12% missed. AI calendar catches
              90% and converts each into a 1.5% value event.
            </div>
            <div>
              <div className="font-semibold text-foreground mb-1">AI risk mitigated</div>
              Portfolio value × risk-exposed share × 60% recovery. AI scores
              every clause on ingest — uncapped liability, weak indemnity,
              open-ended SLAs — and routes findings into the action queue.
            </div>
            <div>
              <div className="font-semibold text-foreground mb-1">Leakage recovered</div>
              60% of estimated revenue leakage — missed price escalators,
              unclaimed SLA credits, un-invoiced overages — caught by AI clause
              monitoring linked to your invoices.
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-6">
            Estimates only. Real results depend on contract mix, clause
            standardization, and team workflow. Get a personalized walkthrough
            on a{" "}
            <Link to="/contract-intelligence" className="text-accent underline">
              Contract Intelligence demo
            </Link>
            .
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default ContractRoiCalculator;
