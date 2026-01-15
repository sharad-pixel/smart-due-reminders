import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';

interface TrialUsage {
  includedInvoicesUsed: number;
  overageInvoices: number;
  includedAllowance: number;
}

/**
 * Trial Banner Component
 * Shows trial countdown and usage for users on a free trial.
 * Forces users to upgrade when trial expires or invoice limit is reached.
 */
export function TrialBanner() {
  const { isTrial, trialEndsAt, subscriptionStatus, plan, isLoading } = useSubscription();
  const [usage, setUsage] = useState<TrialUsage | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  // Calculate days remaining
  useEffect(() => {
    if (trialEndsAt) {
      const endDate = new Date(trialEndsAt);
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setDaysRemaining(Math.max(0, diffDays));
    }
  }, [trialEndsAt]);

  // Fetch invoice usage
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const { data } = await supabase.functions.invoke('get-monthly-usage');
        if (data) {
          setUsage({
            includedInvoicesUsed: data.includedInvoicesUsed || 0,
            overageInvoices: data.overageInvoices || 0,
            includedAllowance: data.includedAllowance || 5,
          });
        }
      } catch (error) {
        console.error('Error fetching usage:', error);
      }
    };

    fetchUsage();
  }, []);

  // Don't show if loading, dismissed, or user has active subscription
  if (isLoading || dismissed) return null;
  
  // Only show for trial users or free plan users
  const isTrialUser = isTrial || subscriptionStatus === 'trialing';
  const isFreePlan = plan === 'free' && (!subscriptionStatus || subscriptionStatus === 'inactive');
  
  if (!isTrialUser && !isFreePlan) return null;

  const invoicesUsed = usage ? usage.includedInvoicesUsed + usage.overageInvoices : 0;
  const invoiceLimit = 5; // Trial limit
  const invoicesRemaining = Math.max(0, invoiceLimit - invoicesUsed);
  
  // Determine urgency level
  const isExpiringSoon = daysRemaining !== null && daysRemaining <= 2;
  const isInvoiceLimitClose = invoicesRemaining <= 1;
  const isExpired = daysRemaining !== null && daysRemaining <= 0;
  const isLimitReached = invoicesRemaining <= 0;

  // Banner styling based on urgency
  const getBannerStyle = () => {
    if (isExpired || isLimitReached) {
      return 'bg-destructive text-destructive-foreground';
    }
    if (isExpiringSoon || isInvoiceLimitClose) {
      return 'bg-amber-500 text-white';
    }
    return 'bg-primary text-primary-foreground';
  };

  const getIcon = () => {
    if (isExpired || isLimitReached) {
      return <AlertTriangle className="h-4 w-4 flex-shrink-0" />;
    }
    return <Zap className="h-4 w-4 flex-shrink-0" />;
  };

  const getMessage = () => {
    if (isExpired) {
      return "Your free trial has expired. Upgrade now to continue using Recouply.ai";
    }
    if (isLimitReached) {
      return "You've used all 5 free invoices. Upgrade now to continue adding invoices";
    }
    if (isExpiringSoon && isInvoiceLimitClose) {
      return `Trial ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} with ${invoicesRemaining} invoice${invoicesRemaining !== 1 ? 's' : ''} remaining`;
    }
    if (isExpiringSoon) {
      return `Your trial ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}. Upgrade now to keep your data`;
    }
    if (isInvoiceLimitClose) {
      return `Only ${invoicesRemaining} free invoice${invoicesRemaining !== 1 ? 's' : ''} remaining`;
    }
    
    // Default message
    return (
      <>
        <span className="hidden sm:inline">Free trial: </span>
        <span className="font-semibold">{daysRemaining} days</span>
        <span className="hidden sm:inline"> remaining</span>
        <span className="mx-2 opacity-60">•</span>
        <span className="font-semibold">{invoicesUsed}/{invoiceLimit}</span>
        <span className="hidden sm:inline"> invoices used</span>
      </>
    );
  };

  return (
    <div className={`flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium ${getBannerStyle()}`}>
      <div className="flex items-center gap-2">
        {getIcon()}
        <span>{getMessage()}</span>
      </div>
      
      <Button 
        asChild 
        size="sm" 
        variant={isExpired || isLimitReached ? "secondary" : "outline"}
        className="h-7 px-3 text-xs font-semibold bg-white/20 hover:bg-white/30 border-white/30 text-inherit"
      >
        <Link to="/upgrade">
          {isExpired || isLimitReached ? "Upgrade Now" : "Choose Plan"}
        </Link>
      </Button>
      
      {!isExpired && !isLimitReached && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-white/20 text-inherit"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
