import { useEffect, useRef, useState } from "react";
import { Upload, Brain, Zap, CreditCard, BarChart3, ArrowRight } from "lucide-react";

const steps = [
  { icon: Upload, title: "Upload or Sync Invoices", description: "Import from any ERP or billing system", comingSoon: "Sync" },
  { icon: Brain, title: "AI Agents Read, Classify & Engage", description: "Smart analysis and customer profiling" },
  { icon: Zap, title: "Smart Follow-Up & Escalation", description: "Automated outreach based on aging" },
  { icon: CreditCard, title: "Payment Captured", description: "Seamless payment collection" },
  { icon: BarChart3, title: "Dashboard Updates Automatically", description: "Real-time cash operations visibility" },
];

const ScrollPipeline = () => {
  const [visibleSteps, setVisibleSteps] = useState<number[]>([]);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const stepIndex = parseInt(entry.target.getAttribute("data-step") || "0");
            setVisibleSteps((prev) => [...new Set([...prev, stepIndex])]);
          }
        });
      },
      { threshold: 0.3, rootMargin: "-50px" }
    );

    const stepElements = document.querySelectorAll("[data-step]");
    stepElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-24 px-4 bg-gradient-to-b from-muted/10 to-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
      
      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-1 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-4">
            How It Works
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Automate Collections from Day One
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            A streamlined pipeline that handles everything from invoice upload to payment capture
          </p>
          <p className="text-sm text-muted-foreground/80 max-w-xl mx-auto mt-3">
            Every action is automatically logged for visibility, compliance, and seamless team handoffs
          </p>
        </div>

        {/* Pipeline Steps */}
        <div className="relative">
          {/* Connection line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-accent to-primary/30 -translate-x-1/2 hidden md:block"></div>

          <div className="space-y-12 md:space-y-0">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isVisible = visibleSteps.includes(index);
              const isLeft = index % 2 === 0;

              return (
                <div
                  key={index}
                  data-step={index}
                  className={`relative md:grid md:grid-cols-2 gap-8 items-center py-8 transition-all duration-700 ${
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                  }`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  {/* Step content */}
                  <div className={`${isLeft ? "" : "md:order-2"} ${isLeft ? "md:text-right" : ""}`}>
                    <div className={`bg-card rounded-2xl p-6 border border-border/50 shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-300 ${isLeft ? "md:ml-auto md:mr-8" : "md:mr-auto md:ml-8"} max-w-md`}>
                      <div className={`flex items-center gap-4 ${isLeft ? "md:flex-row-reverse" : ""}`}>
                        <div className="bg-primary/10 p-3 rounded-xl">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <div className={isLeft ? "md:text-right" : ""}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-lg mb-1">{step.title}</h3>
                            {step.comingSoon && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent font-medium mb-1">
                                {step.comingSoon} Coming Soon
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{step.description}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Center node */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex">
                    <div className={`w-12 h-12 rounded-full bg-background border-4 flex items-center justify-center font-bold text-lg transition-all duration-500 ${
                      isVisible ? "border-primary text-primary scale-100" : "border-muted text-muted-foreground scale-75"
                    }`}>
                      {index + 1}
                    </div>
                  </div>

                  {/* Empty space for grid alignment */}
                  <div className={`hidden md:block ${isLeft ? "md:order-2" : ""}`}></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile step indicators */}
        <div className="flex justify-center gap-2 mt-8 md:hidden">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                visibleSteps.includes(index) ? "bg-primary scale-125" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ScrollPipeline;
