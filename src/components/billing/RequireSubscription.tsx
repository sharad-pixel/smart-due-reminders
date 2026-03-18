import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { TeamMemberLockoutModal } from './TeamMemberLockoutModal';
import { useAccess } from '@/contexts/AccessContext';

interface RequireSubscriptionProps {
  children: ReactNode;
}

/**
 * OPTIMIZED: Gates access to the app for users without an active subscription or valid trial.
 * 
 * Uses AccessContext to cache verification state and avoid redundant checks on every route change.
 * Only performs full verification on:
 * - Initial page load
 * - Auth state changes (login/logout)
 * - Cache expiration (5 minutes)
 * 
 * EXEMPT PATHS: /profile, /settings, /upgrade, /billing, /checkout, etc.
 * These are always accessible when logged in.
 */
export function RequireSubscription({ children }: RequireSubscriptionProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    isLoading, 
    isVerified, 
    hasAccess, 
    user, 
    profile, 
    isTeamMember,
    teamMemberLockout,
    refreshAccess 
  } = useAccess();
  
  const [pathChecked, setPathChecked] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

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
    '/auth/reset-password',
    '/accept-invite',
    '/legal',
    '/terms',
    '/privacy',
    '/cookies',
    '/team',
    '/verify-email',
    '/email-verification-required',
  ];

  useEffect(() => {
    const cleanPath = location.pathname.replace(/#.*$/, '');
    
    // Check if this path is exempt
    const isExemptPath = exemptPaths.some(path => 
      cleanPath === path || cleanPath.startsWith(path + '/')
    );
    
    if (isExemptPath) {
      setPathChecked(true);
      setShouldRender(true);
      return;
    }

    // Wait for access verification to complete
    if (isLoading || !isVerified) {
      setPathChecked(false);
      setShouldRender(false);
      return;
    }

    // No user - let Layout handle redirect
    if (!user) {
      setPathChecked(true);
      setShouldRender(true);
      return;
    }

    // Check email verification for non-OAuth users
    const isOAuthUser = user.app_metadata?.provider && user.app_metadata.provider !== 'email';
    if (!isOAuthUser && profile?.email_verified === false) {
      navigate('/email-verification-required', { replace: true });
      setPathChecked(true);
      setShouldRender(false);
      return;
    }

    // Team member lockout check
    if (teamMemberLockout?.isLocked) {
      setPathChecked(true);
      setShouldRender(false);
      return;
    }

    // Check subscription access
    if (hasAccess) {
      setPathChecked(true);
      setShouldRender(true);
      return;
    }

    // Check trial validity for non-team members
    if (!isTeamMember) {
      checkTrialValidity(user.id, profile).then(trialValid => {
        if (trialValid) {
          setPathChecked(true);
          setShouldRender(true);
        } else {
          navigate('/upgrade', { replace: true });
          setPathChecked(true);
          setShouldRender(false);
        }
      });
      return;
    }

    // No valid access - redirect to upgrade
    navigate('/upgrade', { replace: true });
    setPathChecked(true);
    setShouldRender(false);

  }, [location.pathname, isLoading, isVerified, hasAccess, user, profile, teamMemberLockout, isTeamMember, navigate]);

  // Show loading only during initial verification
  if (isLoading || !isVerified || !pathChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show lockout modal for team members
  if (teamMemberLockout?.isLocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <TeamMemberLockoutModal
          open={true}
          ownerName={teamMemberLockout.ownerName}
          ownerEmail={teamMemberLockout.ownerEmail}
          ownerCompanyName={teamMemberLockout.ownerCompanyName}
          lockoutReason={teamMemberLockout.reason}
        />
      </div>
    );
  }

  if (!shouldRender) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Check if user is within their free trial limits (7 days, 5 invoices)
 */
async function checkTrialValidity(
  _userId: string, 
  profile: { 
    subscription_status?: string | null;
    trial_ends_at?: string | null;
    created_at?: string | null;
  } | null
): Promise<boolean> {
  if (!profile) return false;
  
  // Only check trial for users without active subscriptions
  const status = profile.subscription_status;
  if (status === 'active') {
    return true;
  }

  // Check trial time limit
  const trialEndsAt = profile.trial_ends_at;
  const createdAt = profile.created_at;
  
  if (trialEndsAt) {
    const trialEnds = new Date(trialEndsAt);
    if (trialEnds <= new Date()) {
      return false;
    }
  } else if (createdAt) {
    const accountCreated = new Date(createdAt);
    const trialEnds = new Date(accountCreated.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (trialEnds <= new Date()) {
      return false;
    }
  }

  // Check invoice usage limit (5 invoices during trial) - cached in React Query
  try {
    const { data: usageData } = await supabase.functions.invoke('get-monthly-usage');
    
    if (usageData) {
      const totalUsed = (usageData.includedInvoicesUsed || 0) + (usageData.overageInvoices || 0);
      const trialLimit = 5;
      
      if (totalUsed >= trialLimit) {
        return false;
      }
    }
  } catch (error) {
    console.error('[RequireSubscription] Error checking invoice usage:', error);
    return true;
  }

  return true;
}
