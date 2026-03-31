import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDemoContext, DEMO_STEPS } from "@/contexts/DemoContext";
import { DemoEmailGate } from "@/components/demo/DemoEmailGate";
import { DemoWelcome } from "@/components/demo/DemoWelcome";
import { DemoSetupAccounts } from "@/components/demo/DemoSetupAccounts";
import { DemoSetupInvoices } from "@/components/demo/DemoSetupInvoices";
import { DemoIntegrations } from "@/components/demo/DemoIntegrations";
import { DemoDataImport } from "@/components/demo/DemoDataImport";
import { DemoRevenueRisk } from "@/components/demo/DemoRevenueRisk";
import { DemoCollectionIntelligence } from "@/components/demo/DemoCollectionIntelligence";
import { DemoActivation } from "@/components/demo/DemoActivation";
import { DemoInboundAI } from "@/components/demo/DemoInboundAI";
import { DemoDrafts } from "@/components/demo/DemoDrafts";
import { DemoOutreachForecast } from "@/components/demo/DemoOutreachForecast";
import { DemoSending } from "@/components/demo/DemoSending";
import { DemoOutreachHistory } from "@/components/demo/DemoOutreachHistory";
import { DemoPayments } from "@/components/demo/DemoPayments";
import { DemoDataExport } from "@/components/demo/DemoDataExport";
import { DemoResults } from "@/components/demo/DemoResults";
import { DemoProgressBar } from "@/components/demo/DemoProgressBar";
import { RecouplyLogo } from "@/components/layout/RecouplyLogo";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DemoMode = () => {
  const { isDemoMode, step, startDemo, exitDemo, goToStep, nextStep, prevStep, completedSteps, setDemoEmail } = useDemoContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Handle token-based email auto-fill: /demo?token=base64(email)
  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      try {
        const email = atob(token);
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setDemoEmail(email);
          // Skip email gate, go to welcome
          if (step === "email_gate") {
            goToStep("welcome");
          }
        }
      } catch {
        // Invalid token, continue normally
      }
    }
  }, [searchParams, setDemoEmail, goToStep, step]);

  useEffect(() => {
    if (!isDemoMode) startDemo();
  }, [isDemoMode, startDemo]);

  const handleExit = () => {
    exitDemo();
    navigate("/");
  };

  const currentIdx = DEMO_STEPS.findIndex(s => s.key === step);
  const currentStepInfo = DEMO_STEPS[currentIdx];

  const stepComponents: Record<string, React.ReactNode> = {
    email_gate: <DemoEmailGate />,
    welcome: <DemoWelcome />,
    setup_accounts: <DemoSetupAccounts />,
    setup_invoices: <DemoSetupInvoices />,
    integrations: <DemoIntegrations />,
    data_import: <DemoDataImport />,
    revenue_risk: <DemoRevenueRisk />,
    collection_intelligence: <DemoCollectionIntelligence />,
    inbound_ai: <DemoInboundAI />,
    activate: <DemoActivation />,
    drafts: <DemoDrafts />,
    outreach_forecast: <DemoOutreachForecast />,
    sending: <DemoSending />,
    outreach_history: <DemoOutreachHistory />,
    payments: <DemoPayments />,
    data_export: <DemoDataExport />,
    results: <DemoResults />,
  };

  // Sidebar groups
  const groups = Array.from(new Set(DEMO_STEPS.map(s => s.group)));
  const showSidebar = step !== "email_gate";

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Subtle gradient backdrop */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RecouplyLogo size="md" animated />
            <span className="px-2 py-0.5 text-xs font-semibold bg-primary/10 text-primary rounded-full">
              INTERACTIVE DEMO
            </span>
            {showSidebar && currentStepInfo && (
              <span className="hidden sm:inline text-sm text-muted-foreground">
                Step {currentIdx} of {DEMO_STEPS.length - 1} · {currentStepInfo.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <DemoProgressBar />
            {showSidebar && currentIdx > 1 && (
              <Button variant="ghost" size="sm" onClick={prevStep} className="text-muted-foreground">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            {showSidebar && currentIdx < DEMO_STEPS.length - 1 && (
              <Button variant="ghost" size="sm" onClick={nextStep} className="text-muted-foreground">
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleExit} className="text-muted-foreground">
              <X className="h-4 w-4 mr-1" /> Exit
            </Button>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex">
        {/* Sidebar navigation */}
        {showSidebar && (
          <div className="hidden lg:block w-56 shrink-0 border-r border-border bg-background/50 backdrop-blur-sm min-h-[calc(100vh-57px)] sticky top-[57px]">
            <nav className="p-3 space-y-4">
              {groups.filter(g => g !== "Start").map(group => (
                <div key={group}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1">
                    {group}
                  </p>
                  <div className="space-y-0.5">
                    {DEMO_STEPS.filter(s => s.group === group && s.key !== "email_gate").map(s => {
                      const sIdx = DEMO_STEPS.findIndex(st => st.key === s.key);
                      const isActive = s.key === step;
                      const isDone = completedSteps.includes(s.key) || sIdx < currentIdx;
                      return (
                        <button
                          key={s.key}
                          onClick={() => (isDone || isActive) && goToStep(s.key)}
                          className={`w-full text-left text-xs px-2 py-1.5 rounded-md transition-all ${
                            isActive
                              ? "bg-primary/10 text-primary font-semibold"
                              : isDone
                              ? "text-foreground hover:bg-muted/50 cursor-pointer"
                              : "text-muted-foreground/50 cursor-default"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {isDone && !isActive && (
                              <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                            )}
                            {isActive && (
                              <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                            )}
                            {!isDone && !isActive && (
                              <span className="h-1.5 w-1.5 rounded-full bg-muted shrink-0" />
                            )}
                            {s.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        )}

        {/* Main content */}
        <div className={`flex-1 ${showSidebar ? "max-w-5xl" : "max-w-7xl"} mx-auto px-4 sm:px-6 py-8`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              {stepComponents[step]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <MarketingFooter />
    </div>
  );
};

export default DemoMode;
