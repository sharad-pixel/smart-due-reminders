import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgingBuckets } from "@/hooks/useAgingBuckets";
import { PersonaAvatar } from "./PersonaAvatar";
import { personaConfig } from "@/lib/personaConfig";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export const AgingBucketBreakdown = () => {
  const { data, isLoading } = useAgingBuckets();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Outstanding Balance by Aging & Persona</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const buckets = [
    { key: "current", label: "Current (Not Due)", persona: null, total: data.current.total_amount },
    { key: "dpd_1_30", label: "1-30 Days Past Due", persona: personaConfig.sam, total: data.dpd_1_30.total_amount },
    { key: "dpd_31_60", label: "31-60 Days Past Due", persona: personaConfig.james, total: data.dpd_31_60.total_amount },
    { key: "dpd_61_90", label: "61-90 Days Past Due", persona: personaConfig.katy, total: data.dpd_61_90.total_amount },
    { key: "dpd_91_120", label: "91-120 Days Past Due", persona: personaConfig.troy, total: data.dpd_91_120.total_amount },
    { key: "dpd_120_plus", label: "121+ Days Past Due", persona: personaConfig.gotti, total: data.dpd_120_plus.total_amount },
  ];

  const totalBalance = buckets.reduce((sum, bucket) => sum + bucket.total, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Outstanding Balance by Aging & Persona</CardTitle>
        <CardDescription>See how your receivables are distributed across aging buckets and AI collection personas</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="text-center pb-4 border-b">
            <p className="text-sm text-muted-foreground">Total Outstanding</p>
            <p className="text-3xl font-bold">${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>

          <div className="space-y-4">
            {buckets.map((bucket) => {
              const percentage = totalBalance > 0 ? (bucket.total / totalBalance) * 100 : 0;
              
              return (
                <div key={bucket.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {bucket.persona ? (
                        <PersonaAvatar persona={bucket.persona} size="sm" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-xs">✓</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{bucket.label}</p>
                        {bucket.persona && (
                          <p className="text-xs text-muted-foreground">{bucket.persona.name} - {bucket.persona.tone}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">${bucket.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                  <Progress 
                    value={percentage} 
                    className="h-2"
                    style={{ 
                      // @ts-ignore
                      "--progress-background": bucket.persona?.color || "hsl(var(--muted))" 
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Persona Summary */}
          <div className="pt-4 border-t">
            <h4 className="text-sm font-semibold mb-3">Active Personas</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.values(personaConfig).map((persona) => {
                const bucket = buckets.find(b => b.persona === persona);
                const hasBalance = bucket && bucket.total > 0;
                
                return (
                  <div 
                    key={persona.name} 
                    className={`flex flex-col items-center p-3 rounded-lg border ${hasBalance ? 'border-border bg-card' : 'border-muted bg-muted/20 opacity-50'}`}
                  >
                    <PersonaAvatar persona={persona} size="sm" />
                    <p className="text-xs font-medium mt-2">{persona.name}</p>
                    {hasBalance && bucket && (
                      <p className="text-xs text-muted-foreground">${bucket.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
