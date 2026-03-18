import { Card, CardContent } from "@/components/ui/card";
import { Mail, Brain, Heart, Clock, Shield, TrendingUp } from "lucide-react";

const AIAgentRoles = () => {
  const roles = [
    {
      icon: Mail,
      name: "Outreach Agent",
      description: "Personalized messaging tailored to invoice age and customer context"
    },
    {
      icon: Brain,
      name: "Risk Analysis Agent",
      description: "Scores payment likelihood and prioritizes accounts needing attention"
    },
    {
      icon: Heart,
      name: "Sentiment Agent",
      description: "Reads customer responses and adjusts tone accordingly"
    },
    {
      icon: Clock,
      name: "Timing Agent",
      description: "Optimizes send times based on engagement patterns"
    },
    {
      icon: Shield,
      name: "Escalation Agent",
      description: "Routes high-risk accounts and flags potential issues"
    },
    {
      icon: TrendingUp,
      name: "Strategy Agent",
      description: "Continuously improves sequences based on payment outcomes"
    }
  ];

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {roles.map((role, idx) => {
        const Icon = role.icon;
        return (
          <Card key={idx} className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">{role.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{role.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default AIAgentRoles;
