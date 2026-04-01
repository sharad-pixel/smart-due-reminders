import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RevenueRiskSummary } from '@/hooks/useDailyDigest';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

const getRiskColor = (classification: string) => {
  switch (classification?.toLowerCase()) {
    case 'low risk': return 'text-green-600';
    case 'moderate': return 'text-yellow-600';
    case 'at risk': return 'text-orange-600';
    case 'high risk': return 'text-red-600';
    default: return 'text-muted-foreground';
  }
};

const getRiskBadgeVariant = (classification: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (classification?.toLowerCase()) {
    case 'high risk': return 'destructive';
    case 'at risk': return 'secondary';
    default: return 'outline';
  }
};

const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
};

const getScoreBg = (score: number) => {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
};

interface RevenueRiskDigestCardProps {
  revenueRiskSummary: RevenueRiskSummary | null;
}

export function RevenueRiskDigestCard({ revenueRiskSummary }: RevenueRiskDigestCardProps) {
  if (!revenueRiskSummary || revenueRiskSummary.accounts_scored === 0) {
    return (
      <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Revenue Risk & ECL Intelligence
          </CardTitle>
          <CardDescription>Expected Credit Loss analysis across your portfolio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No revenue risk data available.</p>
            <p className="text-xs mt-1">Run the risk engine to generate ECL scores.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { total_ecl, total_open_balance, avg_collectability_score, accounts_scored, risk_tiers, top_risk_accounts } = revenueRiskSummary;
  const eclPct = total_open_balance > 0 ? ((total_ecl / total_open_balance) * 100).toFixed(1) : '0.0';

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/20">
      <div className={cn("h-2", getScoreBg(avg_collectability_score))} />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          Revenue Risk & ECL Intelligence
        </CardTitle>
        <CardDescription>Expected Credit Loss analysis · {accounts_scored} accounts scored</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-2",
              getScoreBg(avg_collectability_score)
            )}>
              {Math.round(avg_collectability_score)}
            </div>
            <p className="text-xs text-muted-foreground">Avg Collectability</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{formatCurrency(total_ecl)}</p>
            <p className="text-xs text-muted-foreground">Total ECL</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-muted-foreground">{eclPct}%</p>
            <p className="text-xs text-muted-foreground">ECL Rate</p>
          </div>
        </div>

        {/* Risk Tier Distribution */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Risk Tier Distribution</p>
          <div className="grid grid-cols-4 gap-2">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-center">
              <p className="text-lg font-bold text-green-600">{risk_tiers.low}</p>
              <p className="text-[10px] text-green-700">Low Risk</p>
            </div>
            <div className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 text-center">
              <p className="text-lg font-bold text-yellow-600">{risk_tiers.moderate}</p>
              <p className="text-[10px] text-yellow-700">Moderate</p>
            </div>
            <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 text-center">
              <p className="text-lg font-bold text-orange-600">{risk_tiers.at_risk}</p>
              <p className="text-[10px] text-orange-700">At Risk</p>
            </div>
            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-center">
              <p className="text-lg font-bold text-red-600">{risk_tiers.high_risk}</p>
              <p className="text-[10px] text-red-700">High Risk</p>
            </div>
          </div>
          {accounts_scored > 0 && (
            <div className="flex h-2 rounded-full overflow-hidden bg-muted">
              {risk_tiers.low > 0 && <div className="bg-green-500" style={{ width: `${(risk_tiers.low / accounts_scored) * 100}%` }} />}
              {risk_tiers.moderate > 0 && <div className="bg-yellow-500" style={{ width: `${(risk_tiers.moderate / accounts_scored) * 100}%` }} />}
              {risk_tiers.at_risk > 0 && <div className="bg-orange-500" style={{ width: `${(risk_tiers.at_risk / accounts_scored) * 100}%` }} />}
              {risk_tiers.high_risk > 0 && <div className="bg-red-500" style={{ width: `${(risk_tiers.high_risk / accounts_scored) * 100}%` }} />}
            </div>
          )}
        </div>

        {/* Top Risk Accounts */}
        {top_risk_accounts && top_risk_accounts.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Top Risk Accounts</p>
            <div className="space-y-2">
              {top_risk_accounts.slice(0, 5).map((account, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg border bg-card">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs",
                      getScoreBg(account.collectability_score)
                    )}>
                      {Math.round(account.collectability_score)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{account.company_name}</p>
                      <Badge variant={getRiskBadgeVariant(account.risk_classification)} className="text-[10px]">
                        {account.risk_classification}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-600">{formatCurrency(account.ecl)}</p>
                    <p className="text-[10px] text-muted-foreground">of {formatCurrency(account.open_balance)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button asChild variant="outline" className="w-full">
          <Link to="/revenue-risk">View Full Revenue Risk Report →</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
