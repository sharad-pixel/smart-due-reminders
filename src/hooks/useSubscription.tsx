import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type PlanType, PLAN_CONFIGS } from '@/lib/subscriptionConfig';

interface SubscriptionState {
  plan: PlanType;
  invoiceLimit: number;
  maxAgents: number;
  subscriptionStatus: string;
  isLoading: boolean;
  isSubscribed: boolean;
  isPastDue: boolean;
  isTrial: boolean;
  hasUsedTrial: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  billingInterval: 'month' | 'year' | null;
  isAccountOwner: boolean;
  canUpgrade: boolean;
  canAccessFeature: (feature: string) => boolean;
  refresh: () => Promise<void>;
}

const FREE_INVOICE_LIMIT = 15;
const FREE_MAX_AGENTS = 6;

/**
 * SaaS Subscription Hook
 * 
 * - Account owners have their own subscription
 * - Team members inherit account owner's subscription
 * - Trial is one-time per email (tracked via trial_used_at)
 */
export function useSubscription(): SubscriptionState {
  const [isLoading, setIsLoading] = useState(true);
  const [plan, setPlan] = useState<PlanType>('free');
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('inactive');
  const [invoiceLimit, setInvoiceLimit] = useState(FREE_INVOICE_LIMIT);
  const [maxAgents, setMaxAgents] = useState(FREE_MAX_AGENTS);
  const [isTrial, setIsTrial] = useState(false);
  const [hasUsedTrial, setHasUsedTrial] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year' | null>(null);
  const [isAccountOwner, setIsAccountOwner] = useState(true);
  const [canUpgrade, setCanUpgrade] = useState(true);

  const fetchSubscription = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setIsLoading(false);
        return;
      }

      const userId = session.user.id;

      // Check if user is a team member (not owner)
      const { data: membership } = await supabase
        .from('account_users')
        .select('account_id, role, user_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      // If user is a team member, get the owner's subscription
      if (membership && membership.role !== 'owner') {
        setIsAccountOwner(false);
        setCanUpgrade(false);

        // Find the account owner
        const { data: ownerMembership } = await supabase
          .from('account_users')
          .select('user_id')
          .eq('account_id', membership.account_id)
          .eq('role', 'owner')
          .eq('status', 'active')
          .maybeSingle();

        if (ownerMembership) {
          // Get owner's profile for subscription info
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('plan_type, subscription_status, invoice_limit, trial_ends_at, current_period_end, billing_interval')
            .eq('id', ownerMembership.user_id)
            .maybeSingle();

          if (ownerProfile) {
            applySubscriptionData(ownerProfile);
          }
        }
      } else {
        // User is owner or standalone - get their own subscription
        setIsAccountOwner(true);
        setCanUpgrade(true);

        const { data: profile } = await supabase
          .from('profiles')
          .select('plan_type, subscription_status, invoice_limit, trial_ends_at, current_period_end, billing_interval, trial_used_at')
          .eq('id', userId)
          .maybeSingle();

        if (profile) {
          applySubscriptionData(profile);
          setHasUsedTrial(!!profile.trial_used_at);
        }
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const applySubscriptionData = (profile: any) => {
    const planType = (profile.plan_type as PlanType) || 'free';
    setPlan(planType);
    setSubscriptionStatus(profile.subscription_status || 'inactive');
    setBillingInterval(profile.billing_interval as 'month' | 'year' | null);
    setCurrentPeriodEnd(profile.current_period_end || null);
    setTrialEndsAt(profile.trial_ends_at || null);
    
    // Check if in trial
    if (profile.subscription_status === 'trialing' && profile.trial_ends_at) {
      setIsTrial(true);
    } else {
      setIsTrial(false);
    }

    // Set limits based on plan
    if (planType !== 'free' && (profile.subscription_status === 'active' || profile.subscription_status === 'trialing')) {
      const config = PLAN_CONFIGS[planType as keyof typeof PLAN_CONFIGS];
      if (config) {
        setInvoiceLimit(profile.invoice_limit || config.invoiceLimit);
        setMaxAgents(config.maxAgents);
      }
    } else {
      setInvoiceLimit(FREE_INVOICE_LIMIT);
      setMaxAgents(FREE_MAX_AGENTS);
    }
  };

  useEffect(() => {
    fetchSubscription();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchSubscription();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchSubscription]);

  const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
  const isPastDue = subscriptionStatus === 'past_due';

  const canAccessFeature = useCallback((feature: string): boolean => {
    if (plan === 'free') {
      return true; // All features available, just limited invoices
    }
    if (plan === 'enterprise') return true;
    const config = PLAN_CONFIGS[plan as keyof typeof PLAN_CONFIGS];
    return config?.features.includes(feature) || false;
  }, [plan]);

  return {
    plan,
    invoiceLimit,
    maxAgents,
    subscriptionStatus,
    isLoading,
    isSubscribed,
    isPastDue,
    isTrial,
    hasUsedTrial,
    trialEndsAt,
    currentPeriodEnd,
    billingInterval,
    isAccountOwner,
    canUpgrade,
    canAccessFeature,
    refresh: fetchSubscription,
  };
}