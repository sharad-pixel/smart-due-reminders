import { Button } from "@/components/ui/button";
import SEOHead from "@/components/seo/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Building2, Workflow, Zap } from "lucide-react";
import MarketingLayout from "@/components/layout/MarketingLayout";
import { motion } from "framer-motion";
import brainIcon from "@/assets/brain-icon.png";

const IntelligentAR = () => {
  const navigate = useNavigate();

  return (
    <MarketingLayout>
      <SEOHead
        title="Intelligent AR | Your Receivables Should Think | Recouply.ai"
        description="Recouply.ai transforms receivables into a real-time intelligence engine—automating collections, predicting risk, and driving cash flow without manual effort."
        keywords="intelligent AR, AI accounts receivable, automated collections, receivables intelligence, finance automation"
      />

      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Animated gradient background: blue to white */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background" />
        <motion.div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-accent/10"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-primary/15 rounded-full blur-[120px]"
          animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Brain icon - pulsing */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="flex justify-center mb-10"
            >
              <motion.div
                className="relative"
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <motion.div
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-primary/30 blur-2xl"
                  animate={{ opacity: [0.4, 0.8, 0.4], scale: [0.9, 1.15, 0.9] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                />
                <img
                  src={brainIcon}
                  alt="Recouply.ai intelligence brain"
                  className="relative w-28 h-28 md:w-36 md:h-36 object-contain"
                />
              </motion.div>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.7 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight"
            >
              <span className="bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
                Your AR shouldn't just track cash — it should think.
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.7 }}
              className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed"
            >
              Recouply.ai transforms receivables into a real-time intelligence engine—automating
              collections, predicting risk, and driving cash flow without manual effort.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.7 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
            >
              <Button
                size="lg"
                onClick={() => navigate("/collections-assessment")}
                className="text-base md:text-lg px-8 py-6 shadow-lg shadow-primary/20 group"
              >
                Run Free Assessment
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/integrations")}
                className="text-base md:text-lg px-8 py-6 border-2 border-primary/30 hover:border-primary hover:bg-primary/5"
              >
                Connect Stripe
              </Button>
            </motion.div>

            {/* Trust messaging */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.8 }}
              className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-muted-foreground"
            >
              <span className="inline-flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Built for Finance Teams
              </span>
              <span className="hidden sm:inline text-border">|</span>
              <span className="inline-flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Stripe &amp; QuickBooks Native
              </span>
              <span className="hidden sm:inline text-border">|</span>
              <span className="inline-flex items-center gap-2">
                <Workflow className="h-4 w-4 text-primary" />
                Fully Automated Workflows
              </span>
            </motion.div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default IntelligentAR;
