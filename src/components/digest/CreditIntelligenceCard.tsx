import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertTriangle, 
  CheckCircle2, 
  Users,
  CreditCard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PortfolioRiskSummary } from '@/hooks/useDailyDigest';

interface CreditIntelligenceCardProps {
  avgPaydexScore: number | null;
  avgPaydexRating: string | null;
  accountsPromptPayers: number;
  accountsSlowPayers: number;
  accountsDelinquent: number;
  avgPaymentTrend: string | null;
  totalCreditLimitRecommended: number;
  portfolioRiskSummary: PortfolioRiskSummary | null;
}

const formatCurrency = (amount: number, currency: string = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 0 }).format(amount);

const getPaydexColor = (score: number | null) => {
  if (score === null) return 'bg-muted';
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
};

const getPaydexTextColor = (score: number | null) => {
  if (score === null) return 'text-muted-foreground';
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
};

const getTrendIcon = (trend: string | null) => {
  switch (trend) {
    case 'Improving':
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'Declining':
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
};

export function CreditIntelligenceCard({
  avgPaydexScore,
  avgPaydexRating,
  accountsPromptPayers,
  accountsSlowPayers,
  accountsDelinquent,
  avgPaymentTrend,
  totalCreditLimitRecommended,
  portfolioRiskSummary,
}: CreditIntelligenceCardProps) {
  const totalAccounts = accountsPromptPayers + accountsSlowPayers + accountsDelinquent;

  if (totalAccounts === 0 && avgPaydexScore === null) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" />
            Credit Intelligence
          </CardTitle>
          <CardDescription>PAYDEX-style portfolio scoring</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Shield className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No credit intelligence data available.</p>
            <p className="text-xs mt-1">Run the risk engine on your accounts to generate scores.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className={cn("h-2", getPaydexColor(avgPaydexScore))} />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-primary" />
          Credit Intelligence
        </CardTitle>
        <CardDescription>PAYDEX-style portfolio scoring & risk analysis</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Main PAYDEX Score */}
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl",
            getPaydexColor(avgPaydexScore)
          )}>
            {avgPaydexScore ?? '—'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">Portfolio PAYDEX</h3>
              {avgPaydexRating && (
                <Badge variant="outline" className={cn("text-xs", getPaydexTextColor(avgPaydexScore))}>
                  {avgPaydexRating}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <span>Payment Trend:</span>
              {getTrendIcon(avgPaymentTrend)}
              <span className={cn(
                avgPaymentTrend === 'Improving' && 'text-green-600',
                avgPaymentTrend === 'Declining' && 'text-red-600'
              )}>
                {avgPaymentTrend || 'Stable'}
              </span>
            </div>
          </div>
        </div>

        {/* Account Distribution */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Account Payment Behavior</span>
            <span className="font-medium">{totalAccounts} accounts scored</span>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-center">
              <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-green-600">{accountsPromptPayers}</p>
              <p className="text-xs text-green-700">Prompt (80+)</p>
            </div>
            <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 text-center">
              <Users className="h-5 w-5 text-yellow-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-yellow-600">{accountsSlowPayers}</p>
              <p className="text-xs text-yellow-700">Slow (50-79)</p>
            </div>
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-center">
              <AlertTriangle className="h-5 w-5 text-red-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-red-600">{accountsDelinquent}</p>
              <p className="text-xs text-red-700">Delinquent (&lt;50)</p>
            </div>
          </div>

          {/* Distribution Progress */}
          {totalAccounts > 0 && (
            <div className="flex h-2 rounded-full overflow-hidden bg-muted">
              {accountsPromptPayers > 0 && (
                <div 
                  className="bg-green-500 transition-all"
                  style={{ width: `${(accountsPromptPayers / totalAccounts) * 100}%` }}
                />
              )}
              {accountsSlowPayers > 0 && (
                <div 
                  className="bg-yellow-500 transition-all"
                  style={{ width: `${(accountsSlowPayers / totalAccounts) * 100}%` }}
                />
              )}
              {accountsDelinquent > 0 && (
                <div 
                  className="bg-red-500 transition-all"
                  style={{ width: `${(accountsDelinquent / totalAccounts) * 100}%` }}
                />
              )}
            </div>
          )}
        </div>

        {/* Credit Limit & At-Risk AR */}
        <div className="grid grid-cols-2 gap-4 pt-3 border-t">
          <div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
              <CreditCard className="h-4 w-4" />
              <span>Recommended Credit</span>
            </div>
            <p className="text-lg font-semibold">{formatCurrency(totalCreditLimitRecommended)}</p>
          </div>
          {portfolioRiskSummary && (
            <div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
                <AlertTriangle className="h-4 w-4" />
                <span>AR at Risk</span>
              </div>
              <p className="text-lg font-semibold text-red-600">
                {formatCurrency(portfolioRiskSummary.total_ar_at_risk)}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
