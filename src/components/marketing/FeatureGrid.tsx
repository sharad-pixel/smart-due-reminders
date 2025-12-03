import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Mail, Target, AlertTriangle, DollarSign, Clock, BarChart3, Brain } from "lucide-react";

const features = [
  { icon: Users, title: "Multi-Agent Workflow Automation", description: "6 specialized AI collectors working in sync around the clock" },
  { icon: Mail, title: "AI Email Reading + Smart Response", description: "Automatically reads, understands, and responds to customer emails" },
  { icon: Target, title: "Invoice & Debtor-Level Routing", description: "Smart routing based on customer value, history, and risk tier" },
  { icon: AlertTriangle, title: "Risk Scoring & Early Warning", description: "Proactive alerts before accounts go delinquent" },
  { icon: DollarSign, title: "Payment Plan Negotiation", description: "AI-assisted payment arrangement and settlement workflows" },
  { icon: Clock, title: "Aging Bucket Automation", description: "Automated escalation based on days past due" },
  { icon: BarChart3, title: "Real-time Dashboard", description: "Cash Operations HQ with full visibility into AR health" },
  { icon: Brain, title: "Full Message History + AI Summary", description: "Complete audit trail with intelligent conversation summaries" },
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
            Everything You Need to Automate Collections
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            A complete Cash Operations platform powered by AI
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
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
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
