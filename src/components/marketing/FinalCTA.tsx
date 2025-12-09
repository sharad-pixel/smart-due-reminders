import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

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
        <div className="bg-card/80 backdrop-blur-xl rounded-3xl border border-primary/20 p-8 md:p-16 shadow-2xl shadow-primary/10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
              <Sparkles className="h-4 w-4 animate-pulse" />
              Collection Intelligence Platform
            </div>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              Collect Your Money. Intelligently.
            </h2>
            
            <p className="text-xl md:text-2xl text-primary font-semibold mb-4">
              AI That Analyzes Every Touchpoint
            </p>
            
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
              Accounts, communications, payments, tasks, and notes—all analyzed by AI to maximize your receivables recovery.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => navigate("/signup")} 
                className="text-lg px-10 py-6 relative group overflow-hidden"
              >
                {/* Glow effect */}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-primary-foreground/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></span>
                <span className="relative flex items-center gap-2">
                  Get Started
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
              
              <Button 
                size="lg" 
                variant="outline" 
                onClick={() => navigate("/contact")} 
                className="text-lg px-10 py-6 border-2 bg-background/50 backdrop-blur-sm"
              >
                Talk to Sales
              </Button>
            </div>

            <p className="mt-8 text-sm text-muted-foreground">
              No credit card required • 14-day free trial • Cancel anytime
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
