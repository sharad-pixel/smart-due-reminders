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
  calculateAssessment,
  formatCurrency,
  formatROI,
  type AssessmentInputs,
  type AgeBand,
  type LossPctBand,
} from "@/lib/assessmentCalculator";
import { ArrowRight, TrendingDown, DollarSign, Users, Zap, CheckCircle2 } from "lucide-react";

const AGE_BANDS: { value: AgeBand; label: string }[] = [
  { value: "0-30", label: "0–30 days" },
  { value: "31-60", label: "31–60 days" },
  { value: "61-90", label: "61–90 days" },
  { value: "91-120", label: "91–120 days" },
  { value: "121+", label: "121+ days" },
];

const LOSS_BANDS: { value: LossPctBand; label: string }[] = [
  { value: "0-5%", label: "0–5%" },
  { value: "6-10%", label: "6–10%" },
  { value: "11-20%", label: "11–20%" },
  { value: "21%+", label: "21%+" },
];

const RoiCalculator = () => {
  const [overdueTotal, setOverdueTotal] = useState(150000);
  const [overdueCount, setOverdueCount] = useState(40);
  const [ageBand, setAgeBand] = useState<AgeBand>("31-60");
  const [lossBand, setLossBand] = useState<LossPctBand>("6-10%");
  const [annualRate, setAnnualRate] = useState(18);
  const [collectorCount, setCollectorCount] = useState(1);

  const inputs: AssessmentInputs = useMemo(
    () => ({
      overdue_total: overdueTotal,
      overdue_count: overdueCount,
      age_band: ageBand,
      loss_pct_band: lossBand,
      annual_rate: annualRate,
      collector_count: collectorCount,
    }),
    [overdueTotal, overdueCount, ageBand, lossBand, annualRate, collectorCount]
  );

  const results = useMemo(() => calculateAssessment(inputs), [inputs]);

  return (
    <MarketingLayout>
      <SEOHead
        title="AR Collections ROI Calculator | Calculate Cost of Delay — Recouply.ai"
        description="Free ROI calculator for accounts receivable. See your cost of delayed payments, write-off risk, and the savings you'd unlock with automated collections — in seconds."
        keywords="AR ROI calculator, collections ROI, DSO calculator, cost of delayed payments, accounts receivable savings, AR automation ROI"
        canonical="https://recouply.ai/roi-calculator"
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5 py-16 md:py-20">
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
              What is overdue AR <span className="text-primary">costing you?</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              Move the sliders. See your cost of delay, write-off risk, and the savings
              you'd unlock with AI-powered collections — instantly.
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
                  <h2 className="text-xl font-semibold mb-1">Your AR snapshot</h2>
                  <p className="text-sm text-muted-foreground">
                    Rough estimates work — you can refine later.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="overdue-total">Total overdue AR</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="overdue-total"
                      type="number"
                      className="pl-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={overdueTotal}
                      onChange={(e) => setOverdueTotal(Math.max(0, Number(e.target.value)))}
                    />
                  </div>
                  <Slider
                    value={[overdueTotal]}
                    onValueChange={([v]) => setOverdueTotal(v)}
                    min={5000}
                    max={2000000}
                    step={5000}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="overdue-count"># of overdue invoices</Label>
                  <Input
                    id="overdue-count"
                    type="number"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={overdueCount}
                    onChange={(e) => setOverdueCount(Math.max(0, Number(e.target.value)))}
                  />
                  <Slider
                    value={[overdueCount]}
                    onValueChange={([v]) => setOverdueCount(v)}
                    min={1}
                    max={500}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Average age of overdue invoices</Label>
                  <div className="grid grid-cols-5 gap-1">
                    {AGE_BANDS.map((b) => (
                      <button
                        key={b.value}
                        type="button"
                        onClick={() => setAgeBand(b.value)}
                        className={`text-xs py-2 px-1 rounded-md border transition-colors ${
                          ageBand === b.value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted border-border"
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Typical write-off rate</Label>
                  <div className="grid grid-cols-4 gap-1">
                    {LOSS_BANDS.map((b) => (
                      <button
                        key={b.value}
                        type="button"
                        onClick={() => setLossBand(b.value)}
                        className={`text-xs py-2 px-1 rounded-md border transition-colors ${
                          lossBand === b.value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted border-border"
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Cost of capital (annual %)</Label>
                  <div className="grid grid-cols-3 gap-1">
                    {[12, 18, 24].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setAnnualRate(r)}
                        className={`text-xs py-2 px-1 rounded-md border transition-colors ${
                          annualRate === r
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted border-border"
                        }`}
                      >
                        {r}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Dedicated AR/collections staff</Label>
                  <div className="grid grid-cols-5 gap-1">
                    {[0, 1, 2.5, 4.5, 6].map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCollectorCount(c)}
                        className={`text-xs py-2 px-1 rounded-md border transition-colors ${
                          collectorCount === c
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted border-border"
                        }`}
                      >
                        {["0", "1", "2–3", "4–5", "6+"][i]}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            <div className="lg:col-span-3 space-y-4">
              <motion.div
                key={results.total_impact}
                initial={{ scale: 0.98, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-accent/5">
                  <CardContent className="p-6 md:p-8">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <TrendingDown className="w-4 h-4" /> Hidden cost of doing nothing
                    </div>
                    <div className="text-5xl md:text-6xl font-bold text-primary mb-2">
                      {formatCurrency(results.total_impact)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Combined cost of delayed cash + write-off risk on your current
                      overdue book.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-5">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Cost of delay
                    </div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(results.delay_cost)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ~{results.delay_months} mo × cost of capital
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Write-off risk
                    </div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(results.loss_risk_cost)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Based on your typical loss rate
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-accent/40 bg-accent/5">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 text-sm text-accent-foreground/80 mb-1">
                        <Users className="w-4 h-4" /> Staffing comparison
                      </div>
                      <div className="text-xl font-semibold">
                        {formatCurrency(results.annual_employee_cost)}/yr
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Fully-loaded cost of {collectorCount === 0 ? "no" : collectorCount} dedicated collector{collectorCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                        Recouply annual cost
                      </div>
                      <div className="text-xl font-semibold text-accent">
                        {formatCurrency(results.annual_recouply_cost)}/yr
                      </div>
                      {results.annual_savings > 0 && (
                        <p className="text-xs text-accent mt-1 font-medium">
                          Save {formatCurrency(results.annual_savings)} / yr
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-primary text-primary-foreground">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-sm opacity-90 mb-1">
                        Estimated ROI with Recouply
                      </div>
                      <div className="text-4xl font-bold">
                        {formatROI(results.roi_multiple)}
                      </div>
                      <p className="text-xs opacity-80 mt-1">
                        Total impact ÷ platform cost
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button asChild size="lg" variant="secondary">
                        <Link to="/signup">
                          Start free trial <ArrowRight className="w-4 h-4 ml-1" />
                        </Link>
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="text-primary-foreground hover:bg-primary-foreground/10"
                      >
                        <Link to="/collections-assessment">
                          Get full AI assessment
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid sm:grid-cols-3 gap-3 pt-2">
                {[
                  "7-day free trial",
                  "No credit card",
                  "Setup in minutes",
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
              <div className="font-semibold text-foreground mb-1">Cost of delay</div>
              Overdue AR × your cost of capital × months overdue. Every day cash sits in
              AR is a day you're financing your customers.
            </div>
            <div>
              <div className="font-semibold text-foreground mb-1">Write-off risk</div>
              Overdue AR × your historical loss rate. Older receivables collect less —
              acting earlier compresses both metrics.
            </div>
            <div>
              <div className="font-semibold text-foreground mb-1">Staff comparison</div>
              Fully-loaded collector cost benchmarked at $85K/yr (US mid-market).
              Recouply scales with invoice volume at $1.99 per invoice/mo.
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-6">
            Estimates only. Real results depend on customer mix, payment terms, and how
            quickly you act. Get a personalized breakdown with our{" "}
            <Link to="/collections-assessment" className="text-primary underline">
              free AI assessment
            </Link>
            .
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default RoiCalculator;
