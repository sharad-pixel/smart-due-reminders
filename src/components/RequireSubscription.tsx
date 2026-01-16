import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface RequireSubscriptionProps {
  children: ReactNode;
}

/**
 * Gates access to the app for users without an active subscription or valid trial.
 * 
 * FREE TRIAL FLOW (like Lovable):
 * - New users get 7 days free trial with 5 invoice credits
 * - Trial is valid if: (now < trial_ends_at) AND (invoices_used < 5)
 * - When trial expires OR credits exhausted → force redirect to /upgrade
 * - Users must select a paid plan to continue using the app
 * 
 * EXEMPT PATHS: /profile, /settings, /upgrade, /billing, /checkout, etc.
 * These are always accessible when logged in.
 */
export function RequireSubscription({ children }: RequireSubscriptionProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  // Pages that don't require an active subscription - always accessible when logged in
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
    '/team', // Allow team page access for invites
  ];

  useEffect(() => {
    const checkAccess = async () => {
      // Clean path (remove hash fragments from OAuth)
      const cleanPath = location.pathname.replace(/#.*$/, '');
      
      // Check if this path is exempt
      const isExemptPath = exemptPaths.some(path => 
        cleanPath === path || cleanPath.startsWith(path + '/')
      );
      
      if (isExemptPath) {
        setHasAccess(true);
        setIsChecking(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          // Not logged in - let Layout handle redirect to login
          setHasAccess(true);
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

        // Get user's subscription status and trial info
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan_type, subscription_status, is_admin, stripe_customer_id, trial_ends_at, created_at, admin_override')
          .eq('id', user.id)
          .single();

        // Admins always have access
        if (profile?.is_admin) {
          setHasAccess(true);
          setIsChecking(false);
          return;
        }

        // Users with admin override always have access
        if (profile?.admin_override) {
          console.log('[RequireSubscription] User has admin override, granting access');
          setHasAccess(true);
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
            .select('plan_type, subscription_status, trial_ends_at')
            .eq('id', effectiveAccountId)
            .single();

          const ownerHasAccess = checkSubscriptionAccess(ownerProfile);
          
          if (ownerHasAccess) {
            setHasAccess(true);
            setIsChecking(false);
            return;
          }
          
          // Owner doesn't have access, but team member can still go to /upgrade
          console.log('[RequireSubscription] Team owner has no active subscription');
          navigate('/upgrade', { replace: true });
          setHasAccess(false);
          setIsChecking(false);
          return;
        }

        // Check user's own subscription/trial access
        const userHasAccess = checkSubscriptionAccess(profile);
        
        if (userHasAccess) {
          // User has valid subscription or trial
          setHasAccess(true);
          setIsChecking(false);
          return;
        }

        // Check trial invoice usage
        const trialValid = await checkTrialValidity(user.id, profile);
        
        if (trialValid) {
          setHasAccess(true);
          setIsChecking(false);
          return;
        }

        // No valid access - redirect to upgrade
        console.log('[RequireSubscription] No valid subscription or trial, redirecting to upgrade', {
          planType: profile?.plan_type,
          subscriptionStatus: profile?.subscription_status,
          trialEndsAt: profile?.trial_ends_at,
        });

        navigate('/upgrade', { replace: true });
        setHasAccess(false);
        setIsChecking(false);
      } catch (error) {
        console.error('[RequireSubscription] Error checking access:', error);
        // On error, allow access to prevent blocking legitimate users
        setHasAccess(true);
        setIsChecking(false);
      }
    };

    setIsChecking(true);
    checkAccess();
  }, [location.pathname, navigate]);

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

  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Check if profile has active subscription access
 */
function checkSubscriptionAccess(profile: {
  subscription_status?: string | null;
  trial_ends_at?: string | null;
} | null): boolean {
  if (!profile) return false;
  
  const status = profile.subscription_status;
  
  // Active paid subscriptions
  if (status === 'active' || status === 'past_due') {
    return true;
  }
  
  // Trialing with valid trial period
  if (status === 'trialing' && profile.trial_ends_at) {
    const trialEnds = new Date(profile.trial_ends_at);
    if (trialEnds > new Date()) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if user is within their free trial limits (7 days, 5 invoices)
 */
async function checkTrialValidity(
  userId: string, 
  profile: { 
    subscription_status?: string | null;
    trial_ends_at?: string | null;
    created_at?: string | null;
  } | null
): Promise<boolean> {
  if (!profile) return false;
  
  // Only check trial for users without active subscriptions
  const status = profile.subscription_status;
  if (status === 'active' || status === 'past_due') {
    return true; // Already has access
  }

  // Check trial time limit
  const trialEndsAt = profile.trial_ends_at;
  const createdAt = profile.created_at;
  
  // If trial_ends_at is set, use it
  if (trialEndsAt) {
    const trialEnds = new Date(trialEndsAt);
    if (trialEnds <= new Date()) {
      console.log('[RequireSubscription] Trial period expired');
      return false;
    }
  } else if (createdAt) {
    // Fallback: 7 days from account creation
    const accountCreated = new Date(createdAt);
    const trialEnds = new Date(accountCreated.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (trialEnds <= new Date()) {
      console.log('[RequireSubscription] Trial period expired (based on created_at)');
      return false;
    }
  }

  // Check invoice usage limit (5 invoices during trial)
  try {
    const { data: usageData } = await supabase.functions.invoke('get-monthly-usage');
    
    if (usageData) {
      const totalUsed = (usageData.includedInvoicesUsed || 0) + (usageData.overageInvoices || 0);
      const trialLimit = 5;
      
      if (totalUsed >= trialLimit) {
        console.log('[RequireSubscription] Trial invoice limit reached', { totalUsed, trialLimit });
        return false;
      }
    }
  } catch (error) {
    console.error('[RequireSubscription] Error checking invoice usage:', error);
    // On error, be permissive
    return true;
  }

  // Trial is still valid
  return true;
}
