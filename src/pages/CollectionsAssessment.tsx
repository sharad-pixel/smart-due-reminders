import { useState, useCallback, useEffect } from "react";
import MarketingLayout from "@/components/MarketingLayout";
import SEOHead from "@/components/SEOHead";
import CollectionsAssessmentWizard from "@/components/assessment/CollectionsAssessmentWizard";
import CollectionsAssessmentResults from "@/components/assessment/CollectionsAssessmentResults";
import { calculateAssessment, type AssessmentInputs, type AssessmentResults } from "@/lib/assessmentCalculator";
import { supabase } from "@/integrations/supabase/client";

const CollectionsAssessment = () => {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [inputs, setInputs] = useState<AssessmentInputs | null>(null);
  const [results, setResults] = useState<AssessmentResults | null>(null);
  const [gptResult, setGptResult] = useState<any>(null);

  useEffect(() => {
    supabase.from("assessment_events").insert({
      event_type: "assessment_started",
      session_id: sessionId,
    }).then(() => {});
  }, [sessionId]);

  const handleComplete = useCallback(
    (completedInputs: AssessmentInputs, gpt: any) => {
      const computed = calculateAssessment(completedInputs);
      setInputs(completedInputs);
      setResults(computed);
      setGptResult(gpt);
    },
    []
  );

  const handleReset = () => {
    setInputs(null);
    setResults(null);
    setGptResult(null);
  };

  return (
    <MarketingLayout>
      <SEOHead
        title="Free Collections Assessment | Recouply.ai"
        description="Get a free AI-powered assessment of your overdue invoices. Calculate ROI, estimate cost of delay, and receive prioritized next steps in under 60 seconds."
        keywords="collections assessment, AR assessment, invoice ROI, collections calculator, overdue invoices"
        canonical="https://recouply.ai/collections-assessment"
      />
      <section className="py-16 md:py-24 min-h-[70vh]">
        <div className="container mx-auto px-4">
          {results && inputs && gptResult ? (
            <CollectionsAssessmentResults
              inputs={inputs}
              results={results}
              gptResult={gptResult}
              sessionId={sessionId}
              onReset={handleReset}
            />
          ) : (
            <div className="text-center mb-10">
              <h1 className="text-3xl md:text-4xl font-bold mb-3">Free Collections Assessment</h1>
              <p className="text-muted-foreground max-w-xl mx-auto mb-8">
                Answer 5 quick questions. Get your ROI estimate, risk tier, and prioritized next steps — in under 60 seconds.
              </p>
              <CollectionsAssessmentWizard onComplete={handleComplete} sessionId={sessionId} />
            </div>
          )}
        </div>
      </section>
    </MarketingLayout>
  );
};

export default CollectionsAssessment;
