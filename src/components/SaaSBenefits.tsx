import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Brain } from "lucide-react";

const SaaSBenefits = () => {
  const benefits = [
    "Six AI agents working 24/7 at a fraction of one employee's cost",
    "Frees up CSMs & AEs from uncomfortable payment conversations",
    "Customer-friendly tone maintains NRR and reduces churn risk",
    "Agents learn and improve recovery rates with every interaction",
    "Stripe + Chargebee payment link embedding",
    "Full CashOps DSO dashboard with real-time visibility",
    "AI-driven follow-up that adapts to customer behavior",
    "Sentiment-aware messaging that boosts response rates"
  ];

  return (
    <Card className="bg-gradient-to-br from-card to-primary/5">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-xl font-semibold">SaaS-Specific Advantages</h3>
        </div>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {benefits.map((benefit, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <span className="text-sm">{benefit}</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground italic text-center pt-4 border-t">
          "Continuous learning improves recovery rates, reduces churn risk, and strengthens your cash flow."
        </p>
      </CardContent>
    </Card>
  );
};

export default SaaSBenefits;
