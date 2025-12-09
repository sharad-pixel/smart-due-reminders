import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, TrendingUp, Mail, BarChart3, AlertTriangle, Zap } from "lucide-react";

const showcaseItems = [
  {
    id: "account-intelligence",
    title: "Account Intelligence",
    subtitle: "360° view of every customer",
    description: "AI analyzes payment history, communication patterns, risk factors, and behavioral signals to give you complete visibility into each account.",
    icon: Brain,
    accentColor: "from-violet-500 to-purple-600",
    features: ["Payment Score", "Risk Tier", "Sentiment Analysis", "Behavioral Patterns"],
  },
  {
    id: "predictive-risk",
    title: "Predictive Risk Scoring",
    subtitle: "Know before they're late",
    description: "Early warning system identifies at-risk accounts before they become problems. Prioritize outreach based on AI-calculated collectability scores.",
    icon: AlertTriangle,
    accentColor: "from-orange-500 to-red-500",
    features: ["Risk Tiers", "Collectability Score", "Early Warnings", "Aging Analysis"],
  },
  {
    id: "communication-intelligence",
    title: "Communication Intelligence",
    subtitle: "Understand every interaction",
    description: "AI reads and understands all inbound and outbound messages, extracts action items, and tracks sentiment to optimize your collection strategy.",
    icon: Mail,
    accentColor: "from-blue-500 to-cyan-500",
    features: ["AI Summaries", "Action Extraction", "Sentiment Tracking", "Response Analysis"],
  },
  {
    id: "analytics-dashboard",
    title: "Collections Analytics",
    subtitle: "Real-time health insights",
    description: "Comprehensive dashboard with AI-driven insights, aging bucket breakdowns, collection trends, and predictive forecasting.",
    icon: BarChart3,
    accentColor: "from-emerald-500 to-teal-500",
    features: ["Daily Digest", "Health Score", "Trend Analysis", "Predictive Insights"],
  },
];

// Dummy screenshot component that renders a stylized mockup
const DummyScreenshot = ({ item, isVisible }: { item: typeof showcaseItems[0]; isVisible: boolean }) => {
  const Icon = item.icon;
  
  return (
    <div 
      className={`relative rounded-xl overflow-hidden shadow-2xl border border-border/50 bg-card transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      }`}
    >
      {/* Browser chrome mockup */}
      <div className="bg-muted/50 px-4 py-3 flex items-center gap-2 border-b border-border/50">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="bg-background/80 rounded-md px-4 py-1 text-xs text-muted-foreground">
            app.recouply.ai
          </div>
        </div>
      </div>
      
      {/* Screenshot content area */}
      <div className="p-6 min-h-[280px] bg-gradient-to-br from-background to-muted/30">
        {/* Header area */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.accentColor} flex items-center justify-center`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-semibold text-sm">{item.title}</div>
              <div className="text-xs text-muted-foreground">{item.subtitle}</div>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">Live</Badge>
        </div>
        
        {/* Metrics row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {item.features.map((feature, idx) => (
            <div key={idx} className="bg-background/60 rounded-lg p-3 border border-border/30">
              <div className="text-xs text-muted-foreground mb-1">{feature}</div>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full bg-gradient-to-r ${item.accentColor}`} />
                <div className="text-sm font-medium">{Math.floor(Math.random() * 50) + 50}%</div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Chart mockup */}
        <div className="bg-background/40 rounded-lg p-4 border border-border/30">
          <div className="flex items-end gap-1 h-20">
            {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((height, idx) => (
              <div 
                key={idx}
                className={`flex-1 bg-gradient-to-t ${item.accentColor} rounded-t opacity-70 transition-all duration-300 hover:opacity-100`}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Jan</span>
            <span>Jun</span>
            <span>Dec</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const IntelligenceShowcase = () => {
  const [visibleItems, setVisibleItems] = useState<string[]>([]);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-showcase-id");
            if (id) {
              setVisibleItems((prev) => [...new Set([...prev, id])]);
            }
          }
        });
      },
      { threshold: 0.2 }
    );

    const items = document.querySelectorAll("[data-showcase-id]");
    items.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-24 px-4 bg-gradient-to-b from-muted/30 to-background overflow-hidden">
      <div className="container mx-auto max-w-6xl">
        {/* Section header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            <Zap className="h-4 w-4" />
            Collection Intelligence
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            See Intelligence in Action
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            AI-powered insights at every stage of your collection workflow
          </p>
        </div>

        {/* Alternating showcase items */}
        <div className="space-y-32">
          {showcaseItems.map((item, idx) => {
            const isReversed = idx % 2 === 1;
            const isVisible = visibleItems.includes(item.id);
            const Icon = item.icon;
            
            return (
              <div 
                key={item.id}
                data-showcase-id={item.id}
                className={`grid lg:grid-cols-2 gap-12 items-center ${isReversed ? "lg:direction-rtl" : ""}`}
              >
                {/* Text content */}
                <div className={`space-y-6 ${isReversed ? "lg:order-2" : ""}`}>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r ${item.accentColor} text-white text-sm font-medium`}>
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </div>
                  
                  <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold">
                    {item.subtitle}
                  </h3>
                  
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    {item.description}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 pt-2">
                    {item.features.map((feature, fIdx) => (
                      <Badge key={fIdx} variant="outline" className="px-3 py-1">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                {/* Screenshot */}
                <div className={isReversed ? "lg:order-1" : ""}>
                  <DummyScreenshot item={item} isVisible={isVisible} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default IntelligenceShowcase;
