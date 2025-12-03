import { useEffect, useRef, useState } from "react";
import { TrendingDown, Bot, Clock } from "lucide-react";

const metrics = [
  { 
    icon: TrendingDown, 
    value: 50, 
    suffix: "%", 
    prefix: "35-",
    label: "Reduce DSO",
    description: "Cut days sales outstanding dramatically"
  },
  { 
    icon: Bot, 
    value: 80, 
    suffix: "%", 
    label: "Automate AR Work",
    description: "Free your team from manual follow-ups"
  },
  { 
    icon: Clock, 
    value: 24, 
    suffix: "/7", 
    label: "Recover Payments",
    description: "AI agents never sleep or take breaks"
  },
];

const AnimatedMetrics = () => {
  const [counters, setCounters] = useState<number[]>(metrics.map(() => 0));
  const [hasAnimated, setHasAnimated] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          
          metrics.forEach((metric, index) => {
            const duration = 2000;
            const steps = 60;
            const stepValue = metric.value / steps;
            let current = 0;
            
            const timer = setInterval(() => {
              current += stepValue;
              if (current >= metric.value) {
                current = metric.value;
                clearInterval(timer);
              }
              setCounters((prev) => {
                const newCounters = [...prev];
                newCounters[index] = Math.round(current);
                return newCounters;
              });
            }, duration / steps);
          });
        }
      },
      { threshold: 0.5 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [hasAnimated]);

  return (
    <section ref={sectionRef} className="py-24 px-4 bg-gradient-to-r from-primary/5 via-background to-accent/5 relative overflow-hidden">
      {/* Animated background shapes */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute -bottom-1/2 -right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "1.5s" }}></div>
      </div>

      <div className="container mx-auto max-w-5xl relative z-10">
        <div className="grid md:grid-cols-3 gap-8">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div 
                key={index}
                className="text-center group"
              >
                <div className="relative inline-flex items-center justify-center mb-6">
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative bg-card border border-border/50 rounded-2xl p-6 shadow-lg group-hover:shadow-xl group-hover:border-primary/30 transition-all duration-300 group-hover:scale-105">
                    <Icon className="h-10 w-10 text-primary mb-4 mx-auto" />
                    <div className="text-5xl md:text-6xl font-bold text-foreground mb-2">
                      {metric.prefix && <span className="text-primary">{metric.prefix}</span>}
                      <span className="tabular-nums">{counters[index]}</span>
                      <span className="text-primary">{metric.suffix}</span>
                    </div>
                    <div className="text-lg font-semibold mb-1">{metric.label}</div>
                    <p className="text-sm text-muted-foreground">{metric.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default AnimatedMetrics;
