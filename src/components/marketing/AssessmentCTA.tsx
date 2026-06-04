import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Brain, ArrowRight, TrendingUp, Calculator } from "lucide-react";

const AssessmentCTA = () => {
  const navigate = useNavigate();

  return (
    <section className="py-12 md:py-16 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
            <Calculator className="h-4 w-4" />
            <span className="text-sm font-medium">Free ROI Calculators</span>
          </div>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4">
            See what overdue AR and slow contracts are costing you
          </h2>
          <p className="text-muted-foreground mb-8 text-base md:text-lg">
            Move a few sliders. Get an instant breakdown of your cost of delay,
            write-off risk, legal time, and revenue leakage — with the savings
            Recouply would unlock.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
              <Button
                size="lg"
                onClick={() => navigate("/roi-calculator")}
                className="text-lg px-8 py-6 shadow-lg shadow-primary/20 group"
              >
                <Calculator className="h-5 w-5 mr-2" />
                Collections ROI Calculator
                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/contract-roi-calculator")}
                className="text-lg px-8 py-6 group border-accent/40"
              >
                <FileSignature className="h-5 w-5 mr-2" />
                Contract Intelligence ROI
                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </motion.div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No signup • Instant results • Personalized to your numbers
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default AssessmentCTA;
