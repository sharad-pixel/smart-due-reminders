import { Brain, Mail, Zap, CheckCircle, TrendingUp, Shield } from "lucide-react";

const differentiators = [
  { icon: Brain, title: "Built on Modern AI Workflows", description: "Not legacy rules-based systems" },
  { icon: Mail, title: "Full Inbound Email Understanding", description: "Captures and understands complete email context" },
  { icon: Zap, title: "Reads, Classifies & Responds", description: "Identifies intent and takes appropriate action" },
  { icon: CheckCircle, title: "Automatic Task Generation", description: "Creates follow-up tasks from email responses" },
  { icon: TrendingUp, title: "Learns & Improves Monthly", description: "Gets smarter from every interaction" },
  { icon: Shield, title: "Reduces Human Error", description: "Consistent, timely follow-up every time" },
];

const WhyDifferent = () => {
  return (
    <section className="py-24 px-4 bg-background">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-1 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-4">
            Why We're Different
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Why Recouply.ai is Different
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Built on modern AI workflows that continuously improve
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
