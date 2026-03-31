import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDemoContext } from "@/contexts/DemoContext";
import { DemoOverview } from "@/components/demo/DemoOverview";
import { DemoActivation } from "@/components/demo/DemoActivation";
import { DemoDrafts } from "@/components/demo/DemoDrafts";
import { DemoSending } from "@/components/demo/DemoSending";
import { DemoPayments } from "@/components/demo/DemoPayments";
import { DemoResults } from "@/components/demo/DemoResults";
import { DemoProgressBar } from "@/components/demo/DemoProgressBar";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DemoMode = () => {
  const { isDemoMode, step, startDemo, exitDemo } = useDemoContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isDemoMode) startDemo();
  }, [isDemoMode, startDemo]);

  const handleExit = () => {
    exitDemo();
    navigate("/");
  };

  const stepComponents: Record<string, React.ReactNode> = {
    overview: <DemoOverview />,
    activate: <DemoActivation />,
    drafts: <DemoDrafts />,
    sending: <DemoSending />,
    payments: <DemoPayments />,
    results: <DemoResults />,
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Subtle gradient backdrop */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-foreground">Recouply.ai</span>
            <span className="px-2 py-0.5 text-xs font-semibold bg-primary/10 text-primary rounded-full">
              DEMO MODE
            </span>
          </div>
          <div className="flex items-center gap-3">
            <DemoProgressBar />
            <Button variant="ghost" size="sm" onClick={handleExit} className="text-muted-foreground">
              <X className="h-4 w-4 mr-1" /> Exit Demo
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {stepComponents[step]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DemoMode;
