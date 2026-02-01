import { createContext, useContext, ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface AccessState {
  isLoading: boolean;
  isVerified: boolean;
  hasAccess: boolean;
  user: User | null;
  profile: ProfileData | null;
  effectiveAccountId: string | null;
  isTeamMember: boolean;
  ownerProfile: OwnerProfile | null;
  teamMemberLockout: TeamMemberLockoutState | null;
  lastVerifiedAt: number;
}

interface ProfileData {
  plan_type: string | null;
  subscription_status: string | null;
  is_admin: boolean | null;
  stripe_customer_id: string | null;
  trial_ends_at: string | null;
  created_at: string | null;
  admin_override: boolean | null;
  email_verified: boolean | null;
}

interface OwnerProfile {
  name: string | null;
  email: string | null;
  company_name: string | null;
  plan_type: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
}

interface TeamMemberLockoutState {
  isLocked: boolean;
  reason: 'past_due' | 'expired' | 'canceled' | 'locked';
  ownerName: string | null;
  ownerEmail: string | null;
  ownerCompanyName: string | null;
}

interface AccessContextType extends AccessState {
  refreshAccess: () => Promise<void>;
  clearAccess: () => void;
}

const AccessContext = createContext<AccessContextType | null>(null);

// Cache validity duration - 5 minutes
const CACHE_VALIDITY_MS = 5 * 60 * 1000;

export function AccessProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccessState>({
    isLoading: true,
    isVerified: false,
    hasAccess: false,
    user: null,
    profile: null,
    effectiveAccountId: null,
    isTeamMember: false,
    ownerProfile: null,
    teamMemberLockout: null,
    lastVerifiedAt: 0,
  });
  
  const verifyingRef = useRef(false);

  const verifyAccess = useCallback(async (forceRefresh = false) => {
    // Prevent concurrent verification
    if (verifyingRef.current) return;
    
    // Skip if cache is still valid and not forcing refresh
    const now = Date.now();
    if (!forceRefresh && state.isVerified && (now - state.lastVerifiedAt) < CACHE_VALIDITY_MS) {
      return;
    }

    verifyingRef.current = true;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setState({
          isLoading: false,
          isVerified: true,
          hasAccess: true, // Let route guards handle unauthenticated users
          user: null,
          profile: null,
          effectiveAccountId: null,
          isTeamMember: false,
          ownerProfile: null,
          teamMemberLockout: null,
          lastVerifiedAt: now,
        });
        return;
      }

      // Check blocked status (lightweight - only on initial load or force refresh)
      if (forceRefresh || !state.isVerified) {
        try {
          const { data: blockData } = await supabase.functions.invoke('check-blocked-user', {
            body: { email: user.email, userId: user.id }
          });
          
          if (blockData?.blocked) {
            await supabase.auth.signOut();
            setState(prev => ({
              ...prev,
              isLoading: false,
              isVerified: true,
              hasAccess: false,
              user: null,
              lastVerifiedAt: now,
            }));
            return;
          }
        } catch (e) {
          console.error('[AccessContext] Block check error:', e);
        }
      }

      // Fetch profile and effective account ID in parallel
      const [profileResult, effectiveAccountResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('plan_type, subscription_status, is_admin, stripe_customer_id, trial_ends_at, created_at, admin_override, email_verified')
          .eq('id', user.id)
          .single(),
        supabase.rpc('get_effective_account_id', { p_user_id: user.id })
      ]);

      const profile = profileResult.data as ProfileData | null;
      const effectiveAccountId = effectiveAccountResult.data as string | null;
      const isTeamMember = !!(effectiveAccountId && effectiveAccountId !== user.id);

      let ownerProfile: OwnerProfile | null = null;
      let teamMemberLockout: TeamMemberLockoutState | null = null;

      // For team members, fetch owner profile
      if (isTeamMember && effectiveAccountId) {
        const { data: ownerData, error: ownerError } = await supabase
          .from('profiles')
          .select('name, email, company_name, plan_type, subscription_status, trial_ends_at')
          .eq('id', effectiveAccountId)
          .single();

        if (ownerError) {
          teamMemberLockout = {
            isLocked: true,
            reason: 'expired',
            ownerName: null,
            ownerEmail: null,
            ownerCompanyName: null,
          };
        } else {
          ownerProfile = ownerData;
          
          // Check owner subscription status for lockout
          const ownerStatus = ownerProfile?.subscription_status;
          
          if (ownerStatus === 'past_due') {
            teamMemberLockout = {
              isLocked: true,
              reason: 'past_due',
              ownerName: ownerProfile?.name || null,
              ownerEmail: ownerProfile?.email || null,
              ownerCompanyName: ownerProfile?.company_name || null,
            };
          } else if (ownerStatus === 'canceled') {
            teamMemberLockout = {
              isLocked: true,
              reason: 'canceled',
              ownerName: ownerProfile?.name || null,
              ownerEmail: ownerProfile?.email || null,
              ownerCompanyName: ownerProfile?.company_name || null,
            };
          } else if (ownerStatus === 'inactive' || !ownerStatus) {
            // Check if owner has valid trial
            const ownerHasAccess = checkSubscriptionAccess(ownerProfile);
            if (!ownerHasAccess) {
              teamMemberLockout = {
                isLocked: true,
                reason: 'expired',
                ownerName: ownerProfile?.name || null,
                ownerEmail: ownerProfile?.email || null,
                ownerCompanyName: ownerProfile?.company_name || null,
              };
            }
          }
        }
      }

      // Determine if user has access
      let hasAccess = false;
      
      if (teamMemberLockout?.isLocked) {
        hasAccess = false;
      } else if (isTeamMember && ownerProfile) {
        hasAccess = checkSubscriptionAccess(ownerProfile);
      } else if (profile?.is_admin || profile?.admin_override) {
        hasAccess = true;
      } else {
        hasAccess = checkSubscriptionAccess(profile);
      }

      setState({
        isLoading: false,
        isVerified: true,
        hasAccess,
        user,
        profile,
        effectiveAccountId,
        isTeamMember,
        ownerProfile,
        teamMemberLockout,
        lastVerifiedAt: now,
      });

    } catch (error) {
      console.error('[AccessContext] Verification error:', error);
      // On error, be permissive
      setState(prev => ({
        ...prev,
        isLoading: false,
        isVerified: true,
        hasAccess: true,
        lastVerifiedAt: Date.now(),
      }));
    } finally {
      verifyingRef.current = false;
    }
  }, [state.isVerified, state.lastVerifiedAt]);

  const refreshAccess = useCallback(async () => {
    await verifyAccess(true);
  }, [verifyAccess]);

  const clearAccess = useCallback(() => {
    setState({
      isLoading: false,
      isVerified: false,
      hasAccess: false,
      user: null,
      profile: null,
      effectiveAccountId: null,
      isTeamMember: false,
      ownerProfile: null,
      teamMemberLockout: null,
      lastVerifiedAt: 0,
    });
  }, []);

  // Initial verification and auth state listener
  useEffect(() => {
    verifyAccess();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          clearAccess();
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Defer to avoid deadlock
          setTimeout(() => verifyAccess(true), 0);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AccessContext.Provider value={{ ...state, refreshAccess, clearAccess }}>
      {children}
    </AccessContext.Provider>
  );
}

export function useAccess() {
  const context = useContext(AccessContext);
  if (!context) {
    throw new Error('useAccess must be used within an AccessProvider');
  }
  return context;
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
  if (status === 'active') {
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
