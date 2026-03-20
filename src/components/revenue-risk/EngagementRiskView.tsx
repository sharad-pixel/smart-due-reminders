import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  engagement: {
    active: { count: number; ar_value: number };
    no_response: { count: number; ar_value: number };
    moderate: { count: number; ar_value: number };
  };
}

export function EngagementRiskView({ engagement }: Props) {
  const data = [
    {
      name: "Active Engagement",
      accounts: engagement.active.count,
      ar_value: engagement.active.ar_value,
      risk: "Lower Risk",
      color: "hsl(142, 71%, 45%)",
    },
    {
      name: "Moderate",
      accounts: engagement.moderate.count,
      ar_value: engagement.moderate.ar_value,
      risk: "Neutral",
      color: "hsl(48, 96%, 53%)",
    },
    {
      name: "No Response",
      accounts: engagement.no_response.count,
      ar_value: engagement.no_response.ar_value,
      risk: "Higher Risk",
      color: "hsl(0, 84%, 60%)",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Engagement vs Risk</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), "AR Value"]}
                labelFormatter={(label) => {
                  const item = data.find(d => d.name === label);
                  return `${label} — ${item?.accounts || 0} accounts (${item?.risk})`;
                }}
              />
              <Bar dataKey="ar_value" radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t">
          {data.map(item => (
            <div key={item.name} className="text-center">
              <div className="text-xs text-muted-foreground">{item.name}</div>
              <div className="font-semibold text-sm">{item.accounts} accts</div>
              <div className="text-xs" style={{ color: item.color }}>{item.risk}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
