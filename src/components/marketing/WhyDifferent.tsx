import { Brain, Mail, Zap, CheckCircle, TrendingUp, Shield } from "lucide-react";

const differentiators = [
  { icon: Brain, title: "360° Account Intelligence", description: "Payment history, communication patterns, and risk signals—synthesized into actionable context" },
  { icon: Mail, title: "Communication Intelligence", description: "Understands sentiment and intent to guide your next action, not just respond" },
  { icon: Zap, title: "Task & Resolution Intelligence", description: "Tracks what works, surfaces what doesn't—informing team decisions" },
  { icon: CheckCircle, title: "Payment Behavior as Insight", description: "Learns from every payment pattern to help you act before risk compounds" },
  { icon: TrendingUp, title: "Intelligence That Compounds", description: "Every touchpoint makes the system smarter—better signals over time" },
  { icon: Shield, title: "Proactive Risk Signals", description: "Early visibility into at-risk accounts—designed to support predictable cash flow" },
];

const WhyDifferent = () => {
  return (
    <section className="py-24 px-4 bg-background">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-1 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-4">
            Collection Intelligence Platform
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Intelligence That Informs Action
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Signals from accounts, communications, and payments—guiding decisions, not just automating tasks
          </p>
          <p className="text-sm text-muted-foreground/80 max-w-xl mx-auto mt-3">
            Your single system of record for all collection activities
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {differentiators.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="flex gap-4 group">
                <div className="flex-shrink-0">
                  <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-110 transition-all">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-1 group-hover:text-primary transition-colors">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhyDifferent;
