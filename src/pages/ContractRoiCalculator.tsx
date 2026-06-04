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
  FileSignature,
  Clock,
  DollarSign,
  Scale,
  Zap,
  CheckCircle2,
  TrendingDown,
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

// Recouply Contract Intelligence pricing model (per-contract credit).
// Tuned to mid-market; mirrors $1.99 / invoice from collections ROI.
const COST_PER_CONTRACT = 12; // bundled cost of AI extraction + clause review per executed contract

const ContractRoiCalculator = () => {
  const [contractsPerYear, setContractsPerYear] = useState(120);
  const [avgContractValue, setAvgContractValue] = useState(85000);
  const [legalHoursPerContract, setLegalHoursPerContract] = useState(6);
  const [hourlyLegalCost, setHourlyLegalCost] = useState(180);
  const [cycleDays, setCycleDays] = useState(14);
  const [leakagePct, setLeakagePct] = useState(3); // % of contract value lost to missed terms, auto-renewals, etc.

  const results = useMemo(() => {
    // Legal time recovered: Contract Intelligence cuts ~70% of clause review + extraction time
    const legalHoursSaved = contractsPerYear * legalHoursPerContract * 0.7;
    const legalCostSaved = legalHoursSaved * hourlyLegalCost;

    // Cycle compression: ~60% faster signature → revenue recognized sooner
    const daysCompressed = cycleDays * 0.6;
    const annualContractedRevenue = contractsPerYear * avgContractValue;
    // Value of pulling revenue forward, using 18% cost of capital
    const cycleValue = (annualContractedRevenue * 0.18 * daysCompressed) / 365;

    // Revenue leakage recovered: catches missed price escalators, auto-renewals,
    // SLA credits, off-template terms. Recouply recovers ~60% of leakage.
    const leakageRecovered =
      annualContractedRevenue * (leakagePct / 100) * 0.6;

    const totalImpact = legalCostSaved + cycleValue + leakageRecovered;
    const platformCost = contractsPerYear * COST_PER_CONTRACT;
    const netSavings = totalImpact - platformCost;
    const roiMultiple = platformCost > 0 ? totalImpact / platformCost : 0;

    return {
      legalHoursSaved,
      legalCostSaved,
      daysCompressed,
      cycleValue,
      leakageRecovered,
      totalImpact,
      platformCost,
      netSavings,
      roiMultiple,
      annualContractedRevenue,
    };
  }, [
    contractsPerYear,
    avgContractValue,
    legalHoursPerContract,
    hourlyLegalCost,
    cycleDays,
    leakagePct,
  ]);

  return (
    <MarketingLayout>
      <SEOHead
        title="Contract Intelligence ROI Calculator | CLM Savings — Recouply.ai"
        description="Free ROI calculator for Contract Intelligence & CLM. See the legal time, cycle days, and revenue leakage you'd recover with AI-powered contract review — in seconds."
        keywords="contract intelligence ROI, CLM ROI calculator, contract review savings, AI contract review, legal automation ROI, contract lifecycle management"
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
              <Zap className="w-3 h-3 mr-1" /> Free · No signup required
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
              What are slow contracts <span className="text-accent">costing you?</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              Move the sliders. See your legal hours, cycle drag, and revenue
              leakage — and the savings you'd unlock with Recouply Contract
              Intelligence.
            </p>
          </motion.div>
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
                  <h2 className="text-xl font-semibold mb-1">Your contract snapshot</h2>
                  <p className="text-sm text-muted-foreground">
                    Rough estimates work — refine later with a sample upload.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contracts-year">Contracts signed per year</Label>
                  <Input
                    id="contracts-year"
                    type="number"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={contractsPerYear}
                    onChange={(e) =>
                      setContractsPerYear(Math.max(0, Number(e.target.value)))
                    }
                  />
                  <Slider
                    value={[contractsPerYear]}
                    onValueChange={([v]) => setContractsPerYear(v)}
                    min={10}
                    max={2000}
                    step={10}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="acv">Average contract value</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="acv"
                      type="number"
                      className="pl-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={avgContractValue}
                      onChange={(e) =>
                        setAvgContractValue(Math.max(0, Number(e.target.value)))
                      }
                    />
                  </div>
                  <Slider
                    value={[avgContractValue]}
                    onValueChange={([v]) => setAvgContractValue(v)}
                    min={1000}
                    max={1000000}
                    step={1000}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="legal-hours">Legal review hours / contract</Label>
                  <Input
                    id="legal-hours"
                    type="number"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={legalHoursPerContract}
                    onChange={(e) =>
                      setLegalHoursPerContract(Math.max(0, Number(e.target.value)))
                    }
                  />
                  <Slider
                    value={[legalHoursPerContract]}
                    onValueChange={([v]) => setLegalHoursPerContract(v)}
                    min={1}
                    max={40}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Hourly legal cost (loaded)</Label>
                  <div className="grid grid-cols-4 gap-1">
                    {[120, 180, 280, 450].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setHourlyLegalCost(r)}
                        className={`text-xs py-2 px-1 rounded-md border transition-colors ${
                          hourlyLegalCost === r
                            ? "bg-accent text-accent-foreground border-accent"
                            : "bg-background hover:bg-muted border-border"
                        }`}
                      >
                        ${r}/hr
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cycle">Avg contract cycle (days)</Label>
                  <Input
                    id="cycle"
                    type="number"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={cycleDays}
                    onChange={(e) => setCycleDays(Math.max(0, Number(e.target.value)))}
                  />
                  <Slider
                    value={[cycleDays]}
                    onValueChange={([v]) => setCycleDays(v)}
                    min={1}
                    max={90}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Estimated revenue leakage (missed escalators, auto-renewals, SLA credits)</Label>
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
                      <TrendingDown className="w-4 h-4" /> Hidden cost of slow contracts
                    </div>
                    <div className="text-5xl md:text-6xl font-bold text-accent mb-2">
                      {fmt(results.totalImpact)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Annual value of legal time, faster cycles, and recovered
                      leakage on {contractsPerYear.toLocaleString()} contracts
                      ({fmt(results.annualContractedRevenue)} contracted).
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <div className="grid sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      <Scale className="w-3.5 h-3.5" /> Legal time
                    </div>
                    <div className="text-2xl font-bold">
                      {fmt(results.legalCostSaved)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.round(results.legalHoursSaved).toLocaleString()} hrs/yr
                      saved (70%)
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      <Clock className="w-3.5 h-3.5" /> Cycle value
                    </div>
                    <div className="text-2xl font-bold">
                      {fmt(results.cycleValue)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ~{Math.round(results.daysCompressed)} days faster to revenue
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      <FileSignature className="w-3.5 h-3.5" /> Leakage recovered
                    </div>
                    <div className="text-2xl font-bold">
                      {fmt(results.leakageRecovered)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Missed terms caught & enforced
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
                        {contractsPerYear.toLocaleString()} contracts × ${COST_PER_CONTRACT}/contract
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
                        Estimated ROI with Contract Intelligence
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
                  "AI clause extraction",
                  "Linked to revenue & AR",
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

      {/* Methodology */}
      <section className="py-12 bg-muted/30 border-t">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl font-bold mb-4">How we calculate it</h2>
          <div className="grid md:grid-cols-3 gap-6 text-sm text-muted-foreground">
            <div>
              <div className="font-semibold text-foreground mb-1">Legal time saved</div>
              Contracts × review hours × hourly cost × 70%. Contract Intelligence
              extracts clauses, redlines, and obligations automatically — your team
              reviews exceptions, not entire documents.
            </div>
            <div>
              <div className="font-semibold text-foreground mb-1">Cycle compression</div>
              60% faster signature, valued at your cost of capital (18%) against
              annual contracted revenue. Faster contracts = faster revenue recognition.
            </div>
            <div>
              <div className="font-semibold text-foreground mb-1">Leakage recovered</div>
              60% of estimated revenue leakage (missed price escalators,
              silent auto-renewals, unclaimed SLA credits) caught by AI clause
              monitoring linked to your invoices.
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-6">
            Estimates only. Real results depend on contract mix, template
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
