import { useTranslation } from "react-i18next";
import { Brain, Mail, Zap, CheckCircle, TrendingUp, Shield } from "lucide-react";

const WhyDifferent = () => {
  const { t } = useTranslation();

  const differentiators = [
    { icon: Brain, titleKey: "whyDifferent.accountIntelligence", descKey: "whyDifferent.accountIntelligenceDesc" },
    { icon: Mail, titleKey: "whyDifferent.commIntelligence", descKey: "whyDifferent.commIntelligenceDesc" },
    { icon: Zap, titleKey: "whyDifferent.taskIntelligence", descKey: "whyDifferent.taskIntelligenceDesc" },
    { icon: CheckCircle, titleKey: "whyDifferent.paymentBehavior", descKey: "whyDifferent.paymentBehaviorDesc" },
    { icon: TrendingUp, titleKey: "whyDifferent.compounds", descKey: "whyDifferent.compoundsDesc" },
    { icon: Shield, titleKey: "whyDifferent.proactiveRisk", descKey: "whyDifferent.proactiveRiskDesc" },
  ];

  return (
    <section className="py-24 px-4 bg-background">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-1 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-4">
            {t("hero.badge")}
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            {t("whyDifferent.title")}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            {t("whyDifferent.subtitle")}
          </p>
          <p className="text-sm text-muted-foreground/80 max-w-xl mx-auto mt-3">
            {t("whyDifferent.subtext")}
          </p>
          
          {/* Single Source of Truth Messaging */}
          <div className="mt-8 max-w-3xl mx-auto bg-muted/30 rounded-2xl p-6 border border-border/50">
            <p className="text-muted-foreground">
              {t("whyDifferent.sourceOfTruth")}
            </p>
            <p className="text-sm text-muted-foreground/80 mt-3 font-medium">
              {t("whyDifferent.noHandoffs")}
            </p>
          </div>
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
                  <h4 className="font-semibold mb-1 group-hover:text-primary transition-colors">{t(item.titleKey)}</h4>
                  <p className="text-sm text-muted-foreground">{t(item.descKey)}</p>
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
