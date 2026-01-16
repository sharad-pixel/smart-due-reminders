import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Zap, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';

interface TrialCountdownProps {
  variant?: 'card' | 'inline' | 'compact';
  showUpgradeButton?: boolean;
}

/**
 * Trial Countdown Component
 * Reusable component to show trial status with countdown
 * Can be used in Profile, Billing, and other pages
 */
export function TrialCountdown({ variant = 'card', showUpgradeButton = true }: TrialCountdownProps) {
  const {
    isTrial,
    trialEndsAt,
    currentPeriodEnd,
    subscriptionStatus,
    isLoading,
  } = useSubscription();

  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [hoursRemaining, setHoursRemaining] = useState<number | null>(null);
  const [invoicesUsed, setInvoicesUsed] = useState(0);

  const invoiceLimit = 5;

  const effectiveTrialEndsAt =
    trialEndsAt || (subscriptionStatus === 'trialing' ? currentPeriodEnd : null);

  const isTrialUser = isTrial || subscriptionStatus === 'trialing';

  // Calculate countdown (and keep it fresh)
  useEffect(() => {
    if (!effectiveTrialEndsAt) {
      setDaysRemaining(null);
      setHoursRemaining(null);
      return;
    }

    const tick = () => {
      const endDate = new Date(effectiveTrialEndsAt);
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();

      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));

      setDaysRemaining(Math.max(0, diffDays));
      setHoursRemaining(Math.max(0, diffHours));
    };

    tick();
    const id = window.setInterval(tick, 60 * 1000);
    return () => window.clearInterval(id);
  }, [effectiveTrialEndsAt]);

  // Fetch usage
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const { data } = await supabase.functions.invoke('get-monthly-usage');
        if (data) {
          setInvoicesUsed((data.includedInvoicesUsed || 0) + (data.overageInvoices || 0));
        }
      } catch (error) {
        console.error('Error fetching usage:', error);
      }
    };
    fetchUsage();
  }, []);

  // Only show for trial users
  if (isLoading || !isTrialUser) return null;

  const isExpired = daysRemaining !== null && daysRemaining <= 0;
  const isExpiringSoon = daysRemaining !== null && daysRemaining <= 2;
  const progressPercent = daysRemaining !== null ? Math.max(0, ((7 - daysRemaining) / 7) * 100) : 0;
  const invoiceProgressPercent = (invoicesUsed / invoiceLimit) * 100;

  const trialEndDate = effectiveTrialEndsAt
    ? new Date(effectiveTrialEndsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  // Compact inline variant
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 text-sm ${isExpired ? 'text-destructive' : isExpiringSoon ? 'text-amber-600' : 'text-muted-foreground'}`}>
        {isExpired ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <Clock className="h-4 w-4" />
        )}
        <span>
          {isExpired 
            ? 'Trial expired' 
            : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left`}
        </span>
        {showUpgradeButton && (
          <Button asChild size="sm" variant={isExpired ? "destructive" : "outline"} className="h-6 text-xs">
            <Link to="/upgrade">Upgrade</Link>
          </Button>
        )}
      </div>
    );
  }

  // Inline variant
  if (variant === 'inline') {
    return (
      <div className={`flex items-center justify-between p-4 rounded-lg border ${
        isExpired ? 'border-destructive bg-destructive/10' : 
        isExpiringSoon ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20' : 
        'border-primary/30 bg-primary/5'
      }`}>
        <div className="flex items-center gap-3">
          {isExpired ? (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          ) : (
            <Clock className={`h-5 w-5 ${isExpiringSoon ? 'text-amber-600' : 'text-primary'}`} />
          )}
          <div>
            <p className={`font-medium ${isExpired ? 'text-destructive' : ''}`}>
              {isExpired 
                ? 'Your trial has expired' 
                : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining in trial`}
            </p>
            <p className="text-sm text-muted-foreground">
              {isExpired 
                ? 'Upgrade to continue using Recouply.ai'
                : `${invoicesUsed}/${invoiceLimit} invoices used • Ends ${trialEndDate}`}
            </p>
          </div>
        </div>
        {showUpgradeButton && (
          <Button asChild variant={isExpired ? "destructive" : "default"}>
            <Link to="/upgrade">{isExpired ? 'Upgrade Now' : 'Choose Plan'}</Link>
          </Button>
        )}
      </div>
    );
  }

  // Full card variant (default)
  return (
    <Card className={`${
      isExpired ? 'border-destructive' : 
      isExpiringSoon ? 'border-amber-500' : 
      'border-primary/30'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {isExpired ? (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            ) : (
              <Zap className={`h-5 w-5 ${isExpiringSoon ? 'text-amber-600' : 'text-primary'}`} />
            )}
            {isExpired ? 'Trial Expired' : 'Free Trial'}
          </CardTitle>
          <Badge variant={isExpired ? 'destructive' : isExpiringSoon ? 'secondary' : 'default'}>
            {isExpired ? 'Expired' : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left`}
          </Badge>
        </div>
        <CardDescription>
          {isExpired 
            ? 'Your 7-day trial has ended. Upgrade to a paid plan to continue using Recouply.ai.'
            : 'Your trial includes 5 invoices and access to all features.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Days Progress */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Trial Period</span>
            <span className={isExpired ? 'text-destructive' : ''}>
              {isExpired ? 'Expired' : `${daysRemaining} of 7 days remaining`}
            </span>
          </div>
          <Progress 
            value={progressPercent} 
            className={`h-2 ${isExpired ? '[&>div]:bg-destructive' : isExpiringSoon ? '[&>div]:bg-amber-500' : ''}`}
          />
          {trialEndDate && !isExpired && (
            <p className="text-xs text-muted-foreground mt-1">Ends {trialEndDate}</p>
          )}
        </div>

        {/* Invoice Usage */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Invoices Used</span>
            <span>{invoicesUsed} of {invoiceLimit}</span>
          </div>
          <Progress 
            value={invoiceProgressPercent} 
            className={`h-2 ${invoicesUsed >= invoiceLimit ? '[&>div]:bg-destructive' : invoicesUsed >= 4 ? '[&>div]:bg-amber-500' : ''}`}
          />
        </div>

        {showUpgradeButton && (
          <Button asChild className="w-full" variant={isExpired ? "destructive" : "default"}>
            <Link to="/upgrade">
              {isExpired ? 'Upgrade Now to Continue' : 'Choose a Plan'}
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
