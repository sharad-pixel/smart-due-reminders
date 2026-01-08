import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Mail, Target, AlertTriangle, DollarSign, Clock, BarChart3, Brain } from "lucide-react";

const FeatureGrid = () => {
  const { t } = useTranslation();
  const [visibleItems, setVisibleItems] = useState<number[]>([]);
  const sectionRef = useRef<HTMLElement>(null);

  const features = [
    { icon: Users, titleKey: "features.multiAgent", descKey: "features.multiAgentDesc", microKey: "features.multiAgentMicro" },
    { icon: Mail, titleKey: "features.aiEmail", descKey: "features.aiEmailDesc", microKey: "features.aiEmailMicro" },
    { icon: Target, titleKey: "features.routing", descKey: "features.routingDesc", microKey: "features.routingMicro" },
    { icon: AlertTriangle, titleKey: "features.riskScoring", descKey: "features.riskScoringDesc", microKey: "features.riskScoringMicro" },
    { icon: DollarSign, titleKey: "features.paymentPlan", descKey: "features.paymentPlanDesc", microKey: "features.paymentPlanMicro" },
    { icon: Clock, titleKey: "features.agingBucket", descKey: "features.agingBucketDesc", microKey: "features.agingBucketMicro" },
    { icon: BarChart3, titleKey: "features.dashboard", descKey: "features.dashboardDesc", microKey: "features.dashboardMicro" },
    { icon: Brain, titleKey: "features.messageHistory", descKey: "features.messageHistoryDesc", microKey: "features.messageHistoryMicro" },
  ];

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
            {t("features.badge")}
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            {t("features.title")}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            {t("features.subtitle")}
          </p>
          <p className="text-sm text-muted-foreground/80 max-w-xl mx-auto mt-3">
            {t("features.subtext")}
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
                  <h4 className="font-semibold mb-2 group-hover:text-primary transition-colors">{t(feature.titleKey)}</h4>
                  <p className="text-sm text-muted-foreground mb-2">{t(feature.descKey)}</p>
                  <p className="text-xs text-primary/70 font-medium">{t(feature.microKey)}</p>
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
