import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Mail, Target, AlertTriangle, DollarSign, Clock, BarChart3, Brain } from "lucide-react";

const features = [
  { icon: Users, title: "Multi-Agent Workflow Automation", description: "6 specialized agents working in sync, guided by payment behavior signals", micro: "All collection activity stored in one centralized repository" },
  { icon: Mail, title: "AI Email Reading + Smart Response", description: "Understands customer intent, drafts responses—reviewed before sending", micro: "Complete visibility into every customer interaction" },
  { icon: Target, title: "Invoice & Account-Level Routing", description: "Context-aware routing based on value, history, and risk signals", micro: "Eliminate handoffs between finance, ops, and sales" },
  { icon: AlertTriangle, title: "Risk Scoring & Early Warning", description: "Proactive signals before risk compounds—act earlier, not later", micro: "AI-driven risk assessment and engagement insights" },
  { icon: DollarSign, title: "Payment Plan Negotiation", description: "AI-assisted arrangements with human oversight at every step", micro: "Full transparency across finance, ops, and leadership" },
  { icon: Clock, title: "Aging Bucket Automation", description: "Risk-aware escalation aligned with cash flow outcomes", micro: "No handoffs between systems or teams" },
  { icon: BarChart3, title: "Real-time Dashboard", description: "Full visibility into AR health and actionable next steps", micro: "Centralized, audit-ready collection history" },
  { icon: Brain, title: "Full Message History + AI Summary", description: "Complete audit trail with intelligence that informs decisions", micro: "Turn collections data into future expansion intelligence" },
];

const FeatureGrid = () => {
  const [visibleItems, setVisibleItems] = useState<number[]>([]);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute("data-feature-index") || "0");
            setVisibleItems((prev) => [...new Set([...prev, index])]);
          }
        });
      },
      { threshold: 0.2 }
    );

    const items = document.querySelectorAll("[data-feature-index]");
    items.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-24 px-4 bg-background">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            Features
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Everything You Need for Risk-Aware Collections
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            A complete platform designed to support predictable cash outcomes
          </p>
          <p className="text-sm text-muted-foreground/80 max-w-xl mx-auto mt-3">
            Replace scattered inboxes and spreadsheets with centralized workflows and built-in audit trails
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            const isVisible = visibleItems.includes(idx);
            return (
              <Card 
                key={idx} 
                data-feature-index={idx}
                className={`bg-card hover:shadow-xl transition-all duration-500 hover:border-primary/30 group ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: `${idx * 50}ms` }}
              >
                <CardContent className="p-6">
                  <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="font-semibold mb-2 group-hover:text-primary transition-colors">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground mb-2">{feature.description}</p>
                  <p className="text-xs text-primary/70 font-medium">{feature.micro}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeatureGrid;
