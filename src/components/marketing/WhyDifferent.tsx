import { Brain, Mail, Zap, CheckCircle, TrendingUp, Shield } from "lucide-react";

const differentiators = [
  { icon: Brain, title: "360° Account Intelligence", description: "AI analyzes payment history, communication patterns, and risk factors for every account" },
  { icon: Mail, title: "Communication Intelligence", description: "Understands inbound/outbound messages, sentiment, and response patterns" },
  { icon: Zap, title: "Task & Resolution Intelligence", description: "Tracks task completion, resolution effectiveness, and team performance" },
  { icon: CheckCircle, title: "Payment Pattern Analysis", description: "Identifies payment behaviors, predicts delays, and optimizes collection timing" },
  { icon: TrendingUp, title: "Continuous Learning", description: "AI improves with every touchpoint—emails, notes, payments, and resolutions" },
  { icon: Shield, title: "Predictive Risk Scoring", description: "Early warning system identifies at-risk accounts before they become problems" },
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
            Intelligence at Every Touchpoint
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            AI that analyzes accounts, communications, payments, tasks, and notes to maximize recovery
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
