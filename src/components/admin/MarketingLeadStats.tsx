import { Card, CardContent } from "@/components/ui/card";
import { Users, Target, TrendingUp, Mail, Zap, BarChart3 } from "lucide-react";

interface MarketingLeadStatsProps {
  totalLeads: number;
  newLeads: number;
  hotLeads: number;
  campaignsActive: number;
  emailsSent: number;
  conversionRate: number;
}

export const MarketingLeadStats = ({
  totalLeads,
  newLeads,
  hotLeads,
  campaignsActive,
  emailsSent,
  conversionRate,
}: MarketingLeadStatsProps) => {
  const stats = [
    {
      label: "Total Leads",
      value: totalLeads.toLocaleString(),
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "New This Week",
      value: newLeads.toLocaleString(),
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      label: "Hot Leads",
      value: hotLeads.toLocaleString(),
      icon: Zap,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      description: "Score ≥ 80",
    },
    {
      label: "Active Campaigns",
      value: campaignsActive.toLocaleString(),
      icon: Target,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      label: "Emails Sent",
      value: emailsSent.toLocaleString(),
      icon: Mail,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      label: "Conversion Rate",
      value: `${conversionRate.toFixed(1)}%`,
      icon: BarChart3,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
