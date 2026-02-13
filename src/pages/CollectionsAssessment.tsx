import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import MarketingLayout from "@/components/MarketingLayout";
import SEOHead from "@/components/SEOHead";
import CollectionsAssessmentWizard from "@/components/assessment/CollectionsAssessmentWizard";
import CollectionsAssessmentResults from "@/components/assessment/CollectionsAssessmentResults";
import { calculateAssessment, type AssessmentInputs, type AssessmentResults } from "@/lib/assessmentCalculator";
import { supabase } from "@/integrations/supabase/client";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { Badge } from "@/components/ui/badge";
import { Brain, Shield, Zap, Clock } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

const CollectionsAssessment = () => {
  usePageTitle("Free Collections Assessment");
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

      {results && inputs && gptResult ? (
        <section className="py-16 md:py-24 min-h-[70vh]">
          <div className="container mx-auto px-4">
            <CollectionsAssessmentResults
              inputs={inputs}
              results={results}
              gptResult={gptResult}
              sessionId={sessionId}
              onReset={handleReset}
            />
          </div>
        </section>
      ) : (
        <>
          {/* Hero with Nicolas */}
          <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5 py-16 md:py-24">
            <div className="absolute inset-0 bg-grid-pattern opacity-5" />
            {/* Floating particles */}
            <motion.div
              className="absolute top-20 left-[10%] w-64 h-64 rounded-full bg-primary/10 blur-3xl"
              animate={{ y: [0, -20, 0], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute bottom-10 right-[15%] w-48 h-48 rounded-full bg-accent/10 blur-3xl"
              animate={{ y: [0, 15, 0], opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            />

            <div className="container mx-auto px-4 relative z-10">
              <div className="max-w-3xl mx-auto text-center">
                {/* Nicolas intro */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, type: "spring" }}
                  className="flex justify-center mb-6"
                >
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl scale-150 animate-pulse" />
                    <PersonaAvatar persona="nicolas" size="xl" />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  <Badge variant="secondary" className="mb-4 px-4 py-2 text-sm">
                    <Brain className="w-4 h-4 mr-2 inline" />
                    Guided by Nicolas — AI Collections Advisor
                  </Badge>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="text-3xl md:text-5xl font-bold mb-4 leading-tight"
                >
                  <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                    Free Collections
                  </span>{" "}
                  Risk Assessment
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="text-lg text-muted-foreground max-w-xl mx-auto mb-6"
                >
                  5 questions. 60 seconds. Get your risk tier, ROI estimate, and a prioritized action plan — powered by AI.
                </motion.p>

                {/* Trust badges */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="flex flex-wrap justify-center gap-4 mb-10"
                >
                  {[
                    { icon: Shield, label: "No credit card required" },
                    { icon: Clock, label: "Under 60 seconds" },
                    { icon: Zap, label: "Instant AI analysis" },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground bg-card/50 border rounded-full px-4 py-2">
                      <Icon className="w-4 h-4 text-primary" />
                      {label}
                    </div>
                  ))}
                </motion.div>
              </div>
            </div>
          </section>

          {/* Wizard Section */}
          <section className="py-12 md:py-16 -mt-8 relative z-20">
            <div className="container mx-auto px-4">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                <CollectionsAssessmentWizard onComplete={handleComplete} sessionId={sessionId} />
              </motion.div>
            </div>
          </section>
        </>
      )}
    </MarketingLayout>
  );
};

export default CollectionsAssessment;
