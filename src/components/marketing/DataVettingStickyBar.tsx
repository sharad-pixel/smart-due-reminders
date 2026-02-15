import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Shield, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";

const DISMISS_KEY = "data_vetting_banner_dismissed";

const DataVettingStickyBar = () => {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show on the professional-services page itself
  const isTargetPage = location.pathname === "/professional-services";

  useEffect(() => {
    if (isTargetPage) return;
    const dismissed = sessionStorage.getItem(DISMISS_KEY);
    if (!dismissed) {
      // Delay appearance so it doesn't flash on load
      const t = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(t);
    }
  }, [isTargetPage]);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem(DISMISS_KEY, "1");
  };

  if (isTargetPage) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pointer-events-none"
        >
          <div className="container mx-auto max-w-4xl pointer-events-auto">
            <div className="relative rounded-xl border border-primary/20 bg-background/95 backdrop-blur-md shadow-lg p-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">Don't Trust Your Data Yet?</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">We'll help you vet it first — structured onboarding & founder-led oversight.</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    dismiss();
                    navigate("/professional-services");
                  }}
                >
                  Learn More
                  <ArrowRight className="h-3 w-3" />
                </Button>
                <button
                  onClick={dismiss}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DataVettingStickyBar;
