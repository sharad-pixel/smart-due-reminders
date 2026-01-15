import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface RequireSubscriptionProps {
  children: ReactNode;
}

/**
 * Gates access to the app for users without an active subscription.
 * Redirects new users (free plan with inactive status) to the upgrade page.
 * This enforces the requirement that users must select a paid plan to use the app.
 */
export function RequireSubscription({ children }: RequireSubscriptionProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);

  // Pages that don't require an active subscription
  const exemptPaths = [
    '/upgrade',
    '/checkout',
    '/billing',
    '/profile',
    '/settings',
    '/login',
    '/signup',
    '/auth',
    '/reset-password',
    '/accept-invite',
    '/legal',
    '/terms',
    '/privacy',
    '/cookies',
  ];

  const isExemptPath = exemptPaths.some(path => 
    location.pathname === path || location.pathname.startsWith(path)
  );

  useEffect(() => {
    const checkSubscription = async () => {
      // Skip check for exempt paths (also handle hash fragments from OAuth)
      const cleanPath = location.pathname.replace(/#.*$/, '');
      const isExemptClean = exemptPaths.some(path => 
        cleanPath === path || cleanPath.startsWith(path)
      );
      
      if (isExemptPath || isExemptClean) {
        setHasSubscription(true);
        setIsChecking(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          // Not logged in - let the normal auth flow handle it
          setHasSubscription(true);
          setIsChecking(false);
          return;
        }

        // Check if user is blocked
        try {
          const { data: blockData } = await supabase.functions.invoke('check-blocked-user', {
            body: { email: user.email, userId: user.id }
          });
          
          if (blockData?.blocked) {
            console.log('[RequireSubscription] User is blocked, signing out');
            await supabase.auth.signOut();
            navigate('/login', { replace: true });
            return;
          }
        } catch (blockError) {
          console.error('[RequireSubscription] Error checking blocked status:', blockError);
        }

        // Get user's subscription status and history
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan_type, subscription_status, is_admin, stripe_customer_id, created_at')
          .eq('id', user.id)
          .single();

        // Admins always have access
        if (profile?.is_admin) {
          setHasSubscription(true);
          setIsChecking(false);
          return;
        }

        // Check if user is a team member (they use owner's subscription)
        const { data: effectiveAccountId } = await supabase
          .rpc('get_effective_account_id', { p_user_id: user.id });

        const isTeamMember = effectiveAccountId && effectiveAccountId !== user.id;

        if (isTeamMember) {
          // Team members use owner's subscription - get owner's profile
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('plan_type, subscription_status')
            .eq('id', effectiveAccountId)
            .single();

          const ownerHasSubscription = 
            ownerProfile?.subscription_status === 'active' || 
            ownerProfile?.subscription_status === 'trialing' ||
            ownerProfile?.subscription_status === 'past_due';
          
          if (ownerHasSubscription) {
            setHasSubscription(true);
            setIsChecking(false);
            return;
          }
        }

        const subscriptionStatus = profile?.subscription_status;
        const planType = profile?.plan_type;
        const hasStripeCustomer = !!profile?.stripe_customer_id;
        
        // CASE 1: Active subscription members → allow access to dashboard
        const hasActiveSubscription = 
          subscriptionStatus === 'active' || 
          subscriptionStatus === 'trialing' ||
          subscriptionStatus === 'past_due';

        if (hasActiveSubscription) {
          setHasSubscription(true);
          setIsChecking(false);
          return;
        }

        // CASE 2: No active subscription → require upgrade before accessing the app
        // (This includes expired/canceled subscriptions; users must renew/select a plan.)
        console.log('[RequireSubscription] No active subscription, redirecting to upgrade', {
          planType,
          subscriptionStatus,
          hasStripeCustomer,
        });

        // Use replace to prevent back button from going to the gated page
        navigate('/upgrade', { replace: true });
        setHasSubscription(false);
        setIsChecking(false);
        return;
      } catch (error) {
        console.error('[RequireSubscription] Error checking subscription:', error);
        // On error, allow access to prevent blocking legitimate users
        setHasSubscription(true);
        setIsChecking(false);
      }
    };

    checkSubscription();
  }, [location.pathname, isExemptPath, navigate]);

  // Re-check when location changes
  useEffect(() => {
    setIsChecking(true);
  }, [location.pathname]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasSubscription) {
    return null;
  }

  return <>{children}</>;
}
