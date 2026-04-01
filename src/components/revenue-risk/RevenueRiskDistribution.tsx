import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface Props {
  distribution: {
    high: number;
    moderate: number;
    at_risk: number;
    high_risk: number;
  };
}

const COLORS = [
  "hsl(142, 71%, 45%)",  // green - high
  "hsl(48, 96%, 53%)",   // yellow - moderate
  "hsl(25, 95%, 53%)",   // orange - at risk
  "hsl(0, 84%, 60%)",    // red - high risk
];

const LABELS = ["Low Risk (80–100)", "Moderate (60–79)", "At Risk (40–59)", "High Risk (<40)"];

export function RevenueRiskDistribution({ distribution }: Props) {
  const chartData = [
    { name: LABELS[0], value: distribution.high },
    { name: LABELS[1], value: distribution.moderate },
    { name: LABELS[2], value: distribution.at_risk },
    { name: LABELS[3], value: distribution.high_risk },
  ].filter(d => d.value > 0);

  const total = distribution.high + distribution.moderate + distribution.at_risk + distribution.high_risk;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Collectability Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            No invoices to display
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <div className="w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((_, index) => (
                      <Cell key={index} fill={COLORS[LABELS.indexOf(chartData[index].name)]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value, "Invoices"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 flex-1">
              {[
                { label: "Low Risk", value: distribution.high, color: COLORS[0] },
                { label: "Moderate", value: distribution.moderate, color: COLORS[1] },
                { label: "At Risk", value: distribution.at_risk, color: COLORS[2] },
                { label: "High Risk", value: distribution.high_risk, color: COLORS[3] },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{item.value}</span>
                    <span className="text-muted-foreground text-xs">
                      ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
