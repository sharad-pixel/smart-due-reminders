import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle, X, Zap, Clock } from 'lucide-react';
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
 * Respects admin overrides - hides banner when admin_override is enabled.
 */
export function TrialBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isTrial, trialEndsAt, subscriptionStatus, plan, isLoading } = useSubscription();
  const [usage, setUsage] = useState<TrialUsage | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [hoursRemaining, setHoursRemaining] = useState<number | null>(null);
  const [hasAdminOverride, setHasAdminOverride] = useState(false);
  const [checkingOverride, setCheckingOverride] = useState(true);

  // Check for admin override on the user's profile
  useEffect(() => {
    const checkAdminOverride = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          setCheckingOverride(false);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('admin_override')
          .eq('id', session.user.id)
          .single();

        setHasAdminOverride(profile?.admin_override === true);
      } catch (error) {
        console.error('Error checking admin override:', error);
      } finally {
        setCheckingOverride(false);
      }
    };

    checkAdminOverride();
  }, []);

  // Calculate days and hours remaining
  useEffect(() => {
    if (trialEndsAt) {
      const endDate = new Date(trialEndsAt);
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
      setDaysRemaining(Math.max(0, diffDays));
      setHoursRemaining(Math.max(0, diffHours));
    }
  }, [trialEndsAt]);

  // Fetch invoice usage
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const { data } = await supabase.functions.invoke('get-monthly-usage');
        if (data) {
          setUsage({
            includedInvoicesUsed: data.included_invoices_used || 0,
            overageInvoices: data.overage_invoices || 0,
            includedAllowance: data.included_allowance || 5,
          });
        }
      } catch (error) {
        console.error('Error fetching usage:', error);
      }
    };

    fetchUsage();
  }, []);

  // Force redirect to billing when trial expires (except on allowed pages)
  // Skip redirect if admin_override is enabled
  useEffect(() => {
    const allowedPaths = ['/billing', '/upgrade', '/profile', '/login', '/signup', '/auth'];
    const isOnAllowedPath = allowedPaths.some(path => location.pathname.startsWith(path));
    
    // Don't redirect if admin override is enabled
    if (hasAdminOverride) return;
    
    if (!isLoading && daysRemaining !== null && daysRemaining <= 0 && !isOnAllowedPath) {
      const isTrialUser = isTrial || subscriptionStatus === 'trialing';
      const isFreePlan = plan === 'free' && (!subscriptionStatus || subscriptionStatus === 'inactive');
      
      if (isTrialUser || isFreePlan) {
        navigate('/billing', { replace: true });
      }
    }
  }, [isLoading, daysRemaining, isTrial, subscriptionStatus, plan, location.pathname, navigate, hasAdminOverride]);

  // Don't show if loading, dismissed, has admin override, or user has active subscription
  if (isLoading || checkingOverride || dismissed) return null;
  
  // Hide banner completely if admin_override is enabled
  if (hasAdminOverride) return null;
  
  // Only show for trial users or free plan users
  const isTrialUser = isTrial || subscriptionStatus === 'trialing';
  const isFreePlan = plan === 'free' && (!subscriptionStatus || subscriptionStatus === 'inactive');
  
  if (!isTrialUser && !isFreePlan) return null;

  const invoicesUsed = usage ? usage.includedInvoicesUsed + usage.overageInvoices : 0;
  const invoiceLimit = usage?.includedAllowance || 5; // Use allowance from backend
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
    if (isExpiringSoon) {
      return <Clock className="h-4 w-4 flex-shrink-0" />;
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
    if (daysRemaining === null) {
      return "Choose a plan to continue using Recouply.ai";
    }

    return (
      <>
        <span className="hidden sm:inline">Trial: </span>
        <span className="font-semibold">{daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</span>
        <span className="hidden sm:inline"> remaining</span>
        <span className="mx-2 opacity-60">•</span>
        <span className="font-semibold">{invoicesUsed}/{invoiceLimit}</span>
        <span className="hidden sm:inline"> invoices used</span>
      </>
    );
  };

  return (
    <div className={`fixed top-0 left-0 right-0 z-[110] flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium ${getBannerStyle()}`}>
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
