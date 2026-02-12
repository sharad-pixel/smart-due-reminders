import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Brain, Sparkles, ArrowRight } from "lucide-react";

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
            <Brain className="h-4 w-4" />
            <span className="text-sm font-medium">Free Assessment</span>
          </div>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4">
            How Much Are Overdue Invoices Really Costing You?
          </h2>
          <p className="text-muted-foreground mb-8 text-base md:text-lg">
            Answer 5 quick questions and get your personalized ROI estimate, risk tier, and prioritized next steps — powered by AI.
          </p>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
            <Button
              size="lg"
              onClick={() => navigate("/collections-assessment")}
              className="text-lg px-8 py-6 shadow-lg shadow-primary/20 group"
            >
              <Brain className="h-5 w-5 mr-2" />
              Free Assessment
              <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
          <p className="mt-4 text-sm text-muted-foreground">
            Free Assessment
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default AssessmentCTA;
