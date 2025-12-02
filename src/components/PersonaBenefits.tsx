import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Users, Briefcase, Settings } from "lucide-react";

const PersonaBenefits = () => {
  const personas = [
    {
      icon: TrendingUp,
      title: "CFO / Head of Finance",
      tagline: "Your 24/7 AI-powered AR workforce.",
      benefits: [
        "Turn unpredictable payments into predictable cash flow",
        "Automated follow-up eliminates manual AR work",
        "Intelligent risk scoring prioritizes high-impact accounts",
        "Reduce DSO and minimize write-offs",
        "Real-time visibility into CashOps pipeline"
      ]
    },
    {
      icon: Users,
      title: "AR / Collections Manager",
      tagline: "Let AI handle repetitive follow-up.",
      benefits: [
        "Eliminate manual outreach and reminders",
        "Centralized communication threads per debtor",
        "AI-driven next actions and recommendations",
        "Agents that learn what messaging works best",
        "Real-time intelligence improves recovery rates"
      ]
    },
    {
      icon: Briefcase,
      title: "Small Business Owner",
      tagline: "Six AI agents working for you, 24/7.",
      benefits: [
        "Plug in your invoices—agents do the rest",
        "Hands-off cash collection with full control",
        "Faster payments without hiring staff",
        "Affordable CashOps at a fraction of employee cost",
        "Easy setup with no technical expertise needed"
      ]
    },
    {
      icon: Settings,
      title: "RevOps / Operations Leader",
      tagline: "The CashOps layer your systems have been missing.",
      benefits: [
        "Operational efficiency meets AI-driven recovery",
        "Clean workflows and data-driven insights",
        "Integration-ready with your billing stack",
        "AI summaries + automatic task creation",
        "Improving revenue efficiency across the board"
      ]
    }
  ];

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {personas.map((persona, idx) => {
        const Icon = persona.icon;
        return (
          <Card key={idx} className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{persona.title}</h3>
                  <p className="text-sm text-primary font-medium">{persona.tagline}</p>
                </div>
              </div>
              <ul className="space-y-2">
                {persona.benefits.map((benefit, bidx) => (
                  <li key={bidx} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default PersonaBenefits;
