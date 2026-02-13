import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import nicolasAvatar from "@/assets/personas/nicolas.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  DollarSign,
  Clock,
  AlertTriangle,
  Percent,
  Loader2,
  Brain,
  Info,
  TrendingDown,
  ShieldAlert,
  Calculator,
  BarChart3,
} from "lucide-react";
import {
  AGE_BAND_OPTIONS,
  LOSS_PCT_OPTIONS,
  RATE_OPTIONS,
  type AgeBand,
  type LossPctBand,
  type AssessmentInputs,
} from "@/lib/assessmentCalculator";
import { supabase } from "@/integrations/supabase/client";

const OVERDUE_CHIPS = [
  { label: "1–10", value: 5 },
  { label: "11–50", value: 30 },
  { label: "51–200", value: 125 },
  { label: "201–500", value: 350 },
  { label: "500+", value: 750 },
];

interface StepMeta {
  icon: React.ElementType;
  title: string;
  question: string;
  whyItMatters: string;
  riskFactor: string;
  nicolasTip: string;
}

const STEP_META: StepMeta[] = [
  {
    icon: FileText,
    title: "Volume",
    question: "How many invoices are currently overdue?",
    whyItMatters: "Invoice volume determines your collection workload and operational complexity. Higher volumes multiply the cost of manual follow-ups and increase the chance of invoices slipping through the cracks.",
    riskFactor: "Workload & Capacity Risk",
    nicolasTip: "Even 10 overdue invoices can drain hours of follow-up time each week. Let's quantify your collection workload so we can estimate the real operational burden.",
  },
  {
    icon: DollarSign,
    title: "Exposure",
    question: "What's your total overdue balance?",
    whyItMatters: "Your total outstanding balance represents capital locked outside your business. The larger the exposure, the more significant the impact on cash flow, working capital, and growth potential.",
    riskFactor: "Cash Flow & Capital Risk",
    nicolasTip: "This is the total amount at risk. I'll use it to calculate your delay cost, write-off exposure, and the ROI of automated collections vs. doing nothing.",
  },
  {
    icon: Clock,
    title: "Aging",
    question: "How old is most of that overdue balance?",
    whyItMatters: "Aging is the single strongest predictor of collectability. Industry data shows that after 90 days, recovery rates drop by 30–50%. After 120 days, write-off probability increases dramatically.",
    riskFactor: "Recovery Probability Risk",
    nicolasTip: "This is the #1 factor in your risk tier. The older the debt, the harder it is to recover — I'll factor aging into your delay cost and recommended urgency level.",
  },
  {
    icon: AlertTriangle,
    title: "Loss Rate",
    question: "Roughly what % of overdue invoices become hard to collect?",
    whyItMatters: "Your historical loss rate reveals the real write-off exposure hiding in your receivables. Even a 5% loss rate on a $100K portfolio means $5K walking out the door annually.",
    riskFactor: "Write-Off Exposure Risk",
    nicolasTip: "Most businesses underestimate their actual loss rate until they see the numbers. I'll use this to calculate your annual write-off risk and show you the breakeven point.",
  },
  {
    icon: Percent,
    title: "Cost of Capital",
    question: "What's your cost of capital (APR) for cash tied up in receivables?",
    whyItMatters: "Every day an invoice goes unpaid, you're effectively financing your customer's operations at your cost of capital. This determines the true daily cost of delayed payments.",
    riskFactor: "Financing & Delay Cost",
    nicolasTip: "Your cost of capital turns unpaid invoices into a measurable daily expense. I'll calculate exactly how much each day of delay is costing you — it's usually more than people expect.",
  },
];

interface WizardProps {
  onComplete: (inputs: AssessmentInputs, gptResult: any) => void;
  sessionId: string;
}

const CollectionsAssessmentWizard = ({ onComplete, sessionId }: WizardProps) => {
  const [step, setStep] = useState(0);
  const [overdueCount, setOverdueCount] = useState<number | null>(null);
  const [overdueCountCustom, setOverdueCountCustom] = useState("");
  const [overdueTotal, setOverdueTotal] = useState("");
  const [ageBand, setAgeBand] = useState<AgeBand | null>(null);
  const [lossPctBand, setLossPctBand] = useState<LossPctBand | null>(null);
  const [annualRate, setAnnualRate] = useState<number | null>(null);
  const [customRate, setCustomRate] = useState("");
  const [isCustomRate, setIsCustomRate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const trackEvent = useCallback((eventType: string, metadata?: any) => {
    supabase.from("assessment_events").insert({
      event_type: eventType,
      session_id: sessionId,
      metadata,
    }).then(() => {});
  }, [sessionId]);

  const totalSteps = 5;
  const progress = ((step + 1) / totalSteps) * 100;
  const meta = STEP_META[step];

  const canAdvance = (): boolean => {
    switch (step) {
      case 0: return overdueCount !== null && overdueCount > 0;
      case 1: return overdueTotal !== "" && parseFloat(overdueTotal) > 0;
      case 2: return ageBand !== null;
      case 3: return lossPctBand !== null;
      case 4: return annualRate !== null && annualRate > 0;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setError("");
      trackEvent(`step_${step}_completed`);
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setError("");
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!canAdvance()) return;
    setIsSubmitting(true);
    setError("");

    const inputs: AssessmentInputs = {
      overdue_count: overdueCount!,
      overdue_total: parseFloat(overdueTotal),
      age_band: ageBand!,
      loss_pct_band: lossPctBand!,
      annual_rate: annualRate!,
    };

    trackEvent("assessment_completed", inputs);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("collections-assessment", {
        body: { inputs },
      });

      if (fnError) throw fnError;
      onComplete(inputs, data);
    } catch (err) {
      console.error("Assessment error:", err);
      setError("Something went wrong generating your assessment. Please try again.");
      setIsSubmitting(false);
    }
  };

  const selectChipClass = (selected: boolean) =>
    `cursor-pointer rounded-lg border-2 px-4 py-3 text-center transition-all text-sm font-medium ${
      selected
        ? "border-primary bg-primary/10 text-primary shadow-md scale-[1.02]"
        : "border-border bg-card hover:border-primary/40 hover:bg-primary/5 hover:scale-[1.01]"
    }`;

  const stepContent = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {OVERDUE_CHIPS.map((chip) => (
                <motion.button
                  key={chip.label}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className={selectChipClass(overdueCount === chip.value && overdueCountCustom === "")}
                  onClick={() => { setOverdueCount(chip.value); setOverdueCountCustom(""); }}
                >
                  {chip.label}
                </motion.button>
              ))}
              <div className="col-span-2 sm:col-span-3">
                <Input
                  type="number"
                  placeholder="Or enter exact number..."
                  value={overdueCountCustom}
                  onChange={(e) => {
                    setOverdueCountCustom(e.target.value);
                    const v = parseInt(e.target.value);
                    setOverdueCount(isNaN(v) ? null : v);
                  }}
                  min={1}
                />
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
              <Input
                type="number"
                className="pl-7 text-lg h-12"
                placeholder="e.g. 50,000"
                value={overdueTotal}
                onChange={(e) => setOverdueTotal(e.target.value)}
                min={0}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AGE_BAND_OPTIONS.map((band) => (
                <motion.button
                  key={band}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className={selectChipClass(ageBand === band)}
                  onClick={() => setAgeBand(band)}
                >
                  {band} days
                </motion.button>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">If you're not sure, pick your best estimate.</p>
            <div className="grid grid-cols-2 gap-2">
              {LOSS_PCT_OPTIONS.map((band) => (
                <motion.button
                  key={band}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className={selectChipClass(lossPctBand === band)}
                  onClick={() => setLossPctBand(band)}
                >
                  {band}
                </motion.button>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {RATE_OPTIONS.map((rate) => (
                <motion.button
                  key={rate}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className={selectChipClass(annualRate === rate && !isCustomRate)}
                  onClick={() => { setAnnualRate(rate); setIsCustomRate(false); setCustomRate(""); }}
                >
                  {rate}%
                </motion.button>
              ))}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className={selectChipClass(isCustomRate)}
                onClick={() => { setIsCustomRate(true); setAnnualRate(null); }}
              >
                Custom
              </motion.button>
            </div>
            {isCustomRate && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="relative"
              >
                <Input
                  type="number"
                  placeholder="Enter APR %"
                  value={customRate}
                  onChange={(e) => {
                    setCustomRate(e.target.value);
                    const v = parseFloat(e.target.value);
                    setAnnualRate(isNaN(v) ? null : v);
                  }}
                  min={0}
                  max={100}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
              </motion.div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const StepIcon = meta.icon;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Step indicator pills */}
      <div className="flex justify-center gap-2 mb-6">
        {STEP_META.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={i}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                i === step
                  ? "bg-primary text-primary-foreground shadow-md"
                  : i < step
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
              animate={i === step ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{s.title}</span>
            </motion.div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>Step {step + 1} of {totalSteps}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Main card */}
      <Card className="relative overflow-hidden border-primary/10 shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-accent/[0.02]" />
        <CardContent className="relative p-6 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {/* Question header */}
              <div className="flex items-start gap-3 mb-5">
                <motion.div
                  className="p-2.5 rounded-xl bg-primary/10 shrink-0"
                  initial={{ rotate: -10, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  <StepIcon className="h-5 w-5 text-primary" />
                </motion.div>
                <div>
                  <h3 className="text-xl font-bold leading-tight">{meta.question}</h3>
                  <Badge variant="outline" className="mt-1.5 text-xs">
                    <BarChart3 className="w-3 h-3 mr-1" />
                    {meta.riskFactor}
                  </Badge>
                </div>
              </div>

              {/* Answer options */}
              {stepContent()}

              {/* Why It Matters card */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.35 }}
                className="mt-6 rounded-xl border border-accent/20 bg-accent/5 p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-accent shrink-0" />
                  <p className="text-sm font-semibold text-accent">Why This Matters for Your Risk Score</p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{meta.whyItMatters}</p>
              </motion.div>

              {/* Nicolas Agent Tip — large card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="mt-5 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent p-5 md:p-6"
              >
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  {/* Large Nicolas avatar */}
                  <div className="shrink-0 relative self-center sm:self-start">
                    <motion.div
                      className="absolute inset-0 rounded-2xl bg-primary/15 blur-2xl scale-125"
                      animate={{ scale: [1.15, 1.35, 1.15], opacity: [0.2, 0.5, 0.2] }}
                      transition={{ duration: 4, repeat: Infinity }}
                    />
                    <img
                      src={nicolasAvatar}
                      alt="Nicolas — AI Collections Advisor"
                      className="relative h-24 w-24 md:h-28 md:w-28 rounded-2xl object-cover border-2 border-primary/20 shadow-lg"
                    />
                  </div>
                  {/* Tip content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-primary mb-1 flex items-center gap-1.5">
                      <Brain className="w-4 h-4" />
                      Nicolas — AI Collections Advisor
                    </p>
                    <p className="text-sm text-foreground leading-relaxed mb-3">{meta.nicolasTip}</p>
                    <div className="border-l-2 border-primary/30 pl-3">
                      <p className="text-xs text-muted-foreground italic leading-relaxed">
                        "Understanding your <span className="text-primary font-medium">{meta.riskFactor.toLowerCase()}</span> is critical to building an accurate collections intelligence profile."
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-destructive text-sm mt-4"
            >
              {error}
            </motion.p>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <Button variant="outline" onClick={handleBack} disabled={step === 0 || isSubmitting} size="lg">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>

            {step < totalSteps - 1 ? (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button onClick={handleNext} disabled={!canAdvance()} size="lg">
                  Next <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </motion.div>
            ) : (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button onClick={handleSubmit} disabled={!canAdvance() || isSubmitting} size="lg">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Nicolas is analyzing...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" /> Get My Assessment
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CollectionsAssessmentWizard;
