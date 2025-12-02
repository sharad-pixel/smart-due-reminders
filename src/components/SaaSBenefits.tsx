import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

const SaaSBenefits = () => {
  const benefits = [
    "No collection staff needed",
    "Frees up CSMs & AEs",
    "Customer-friendly tone maintains NRR and reduces churn",
    "Integrates with CRM → customer-aware outreach",
    "Stripe + Chargebee payment link embedding",
    "Full CashOps DSO dashboard"
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-xl font-semibold mb-4">SaaS-Specific Advantages</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {benefits.map((benefit, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SaaSBenefits;
