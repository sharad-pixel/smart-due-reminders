import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
        ? "border-primary bg-primary/10 text-primary shadow-md"
        : "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
    }`;

  const stepContent = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10"><FileText className="h-5 w-5 text-primary" /></div>
              <h3 className="text-lg font-semibold">How many invoices are currently overdue?</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {OVERDUE_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  className={selectChipClass(overdueCount === chip.value && overdueCountCustom === "")}
                  onClick={() => { setOverdueCount(chip.value); setOverdueCountCustom(""); }}
                >
                  {chip.label}
                </button>
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
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10"><DollarSign className="h-5 w-5 text-primary" /></div>
              <h3 className="text-lg font-semibold">What's your total overdue balance?</h3>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
              <Input
                type="number"
                className="pl-7"
                placeholder="e.g. 50000"
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
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10"><Clock className="h-5 w-5 text-primary" /></div>
              <h3 className="text-lg font-semibold">How old is most of that overdue balance?</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AGE_BAND_OPTIONS.map((band) => (
                <button key={band} className={selectChipClass(ageBand === band)} onClick={() => setAgeBand(band)}>
                  {band} days
                </button>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10"><AlertTriangle className="h-5 w-5 text-primary" /></div>
              <h3 className="text-lg font-semibold">
                Roughly what % of overdue invoices become hard to collect?
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">If you're not sure, pick your best estimate.</p>
            <div className="grid grid-cols-2 gap-2">
              {LOSS_PCT_OPTIONS.map((band) => (
                <button key={band} className={selectChipClass(lossPctBand === band)} onClick={() => setLossPctBand(band)}>
                  {band}
                </button>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10"><Percent className="h-5 w-5 text-primary" /></div>
              <h3 className="text-lg font-semibold">
                What's your cost of capital (APR) for cash tied up in receivables?
              </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {RATE_OPTIONS.map((rate) => (
                <button
                  key={rate}
                  className={selectChipClass(annualRate === rate && !isCustomRate)}
                  onClick={() => { setAnnualRate(rate); setIsCustomRate(false); setCustomRate(""); }}
                >
                  {rate}%
                </button>
              ))}
              <button
                className={selectChipClass(isCustomRate)}
                onClick={() => { setIsCustomRate(true); setAnnualRate(null); }}
              >
                Custom
              </button>
            </div>
            {isCustomRate && (
              <div className="relative">
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
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>Step {step + 1} of {totalSteps}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25 }}
        >
          {stepContent()}
        </motion.div>
      </AnimatePresence>

      {error && (
        <p className="text-destructive text-sm mt-3">{error}</p>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={handleBack} disabled={step === 0 || isSubmitting}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        {step < totalSteps - 1 ? (
          <Button onClick={handleNext} disabled={!canAdvance()}>
            Next <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={!canAdvance() || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" /> Get Assessment
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default CollectionsAssessmentWizard;
