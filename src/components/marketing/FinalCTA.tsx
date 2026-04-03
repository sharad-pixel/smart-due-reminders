import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const FinalCTA = () => {
  const navigate = useNavigate();

  return (
    <section className="py-24 px-4 relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent animate-pulse-slow"></div>
      </div>

      {/* Animated particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-primary/30 rounded-full animate-float-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>

      <div className="container mx-auto max-w-4xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="bg-card/80 backdrop-blur-xl rounded-3xl border border-primary/20 p-8 md:p-16 shadow-2xl shadow-primary/10"
        >
          <div className="text-center">
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6"
              animate={{ boxShadow: ["0 0 0 0 hsla(var(--primary), 0.2)", "0 0 0 8px hsla(var(--primary), 0)", "0 0 0 0 hsla(var(--primary), 0)"] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles className="h-4 w-4" />
              Agentic Revenue Recovery Platform
            </motion.div>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              Deploy AI Agents. Recover Revenue.
            </h2>
            
            <p className="text-xl md:text-2xl text-primary font-semibold mb-4">
              Autonomous Recovery, Human-Controlled Outcomes
            </p>
            
            <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
              Six AI agents autonomously manage follow-ups, assess risk, negotiate payments, and escalate — while you maintain full control over every decision.
            </p>
            <p className="text-sm text-muted-foreground/80 mb-10 max-w-xl mx-auto">
              Agentic workflows • Revenue risk scoring • Autonomous execution
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }}>
                <Button 
                  size="lg" 
                  onClick={() => navigate("/signup")} 
                  className="text-lg px-10 py-6 relative group overflow-hidden w-full sm:w-auto"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-primary-foreground/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></span>
                  <span className="relative flex items-center gap-2">
                    Deploy Your AI Agents
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Button>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }}>
                <Button 
                  size="lg" 
                  variant="outline" 
                  onClick={() => navigate("/contact")} 
                  className="text-lg px-10 py-6 border-2 bg-background/50 backdrop-blur-sm w-full sm:w-auto"
                >
                  Talk to Sales
                </Button>
              </motion.div>
            </div>

            <p className="mt-8 text-sm text-muted-foreground">
              No credit card required during trial • 7-day free trial • Cancel anytime
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FinalCTA;
