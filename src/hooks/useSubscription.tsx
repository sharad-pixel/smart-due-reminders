import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAccountId } from '@/hooks/useAccountId';
import { type PlanType, PLAN_CONFIGS, TRIAL_CONFIG } from '@/lib/subscriptionConfig';

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
  trialInvoiceLimit: number;
  canAccessFeature: (feature: string) => boolean;
  refresh: () => Promise<void>;
}

const TRIAL_INVOICE_LIMIT = TRIAL_CONFIG.invoiceLimit; // 5 invoices during trial
const FREE_MAX_AGENTS = 6;

/**
 * SaaS Subscription Hook
 * 
 * - Account owners have their own subscription
 * - Team members inherit account owner's subscription
 * - Trial is 7 days with 5 invoice limit
 * - Trial auto-converts to Starter unless cancelled
 */
export function useSubscription(): SubscriptionState {
  const [isLoading, setIsLoading] = useState(true);
  const [plan, setPlan] = useState<PlanType>('free');
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('inactive');
  const [invoiceLimit, setInvoiceLimit] = useState(TRIAL_INVOICE_LIMIT);
  const [maxAgents, setMaxAgents] = useState(FREE_MAX_AGENTS);
  const [isTrial, setIsTrial] = useState(false);
  const [hasUsedTrial, setHasUsedTrial] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year' | null>(null);
  const [isAccountOwner, setIsAccountOwner] = useState(true);
  const [canUpgrade, setCanUpgrade] = useState(true);
  const [trialInvoiceLimit] = useState(TRIAL_INVOICE_LIMIT);
  const { accountId, userId, isTeamMember, isLoading: accountIdLoading } = useAccountId();

  const getFallbackOwnerProfile = useCallback(async (isOwner: boolean, effectiveAccountId: string) => {
    if (isOwner) {
      const { data } = await supabase
        .from('profiles')
        .select('plan_type, subscription_status, invoice_limit, trial_ends_at, current_period_end, billing_interval, trial_used_at, created_at')
        .eq('id', effectiveAccountId)
        .maybeSingle();

      return data;
    }

    const { data: rows } = await supabase
      .rpc('get_owner_account_info', { p_account_id: effectiveAccountId });

    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;

    return {
      plan_type: row.plan_type,
      subscription_status: row.subscription_status,
      invoice_limit: null,
      trial_ends_at: row.trial_ends_at,
      current_period_end: row.current_period_end,
      billing_interval: row.billing_interval,
      trial_used_at: null,
      created_at: null,
    };
  }, []);

  const fetchSubscription = useCallback(async () => {
    try {
      if (accountIdLoading) return;

      if (!userId || !accountId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const isOwner = !isTeamMember;

      setIsAccountOwner(isOwner);
      setCanUpgrade(isOwner);

      const [fallbackOwnerProfile, syncedSubscriptionResponse] = await Promise.all([
        getFallbackOwnerProfile(isOwner, accountId),
        supabase.functions.invoke('sync-subscription'),
      ]);

      if (syncedSubscriptionResponse.error) {
        console.warn('sync-subscription fallback in useSubscription:', syncedSubscriptionResponse.error);
      }

      const syncedSubscription = syncedSubscriptionResponse.data;

      const ownerProfile = {
        ...(fallbackOwnerProfile || {}),
        ...(syncedSubscription ? {
          plan_type: syncedSubscription.plan_type ?? fallbackOwnerProfile?.plan_type ?? null,
          subscription_status: syncedSubscription.subscription_status ?? fallbackOwnerProfile?.subscription_status ?? null,
          invoice_limit: syncedSubscription.invoice_limit ?? fallbackOwnerProfile?.invoice_limit ?? null,
          trial_ends_at: syncedSubscription.trial_ends_at ?? fallbackOwnerProfile?.trial_ends_at ?? null,
          current_period_end: syncedSubscription.current_period_end ?? fallbackOwnerProfile?.current_period_end ?? null,
          billing_interval: syncedSubscription.billing_interval ?? fallbackOwnerProfile?.billing_interval ?? null,
        } : {}),
      };

      if (ownerProfile && (ownerProfile.plan_type || ownerProfile.subscription_status || ownerProfile.current_period_end)) {
        applySubscriptionData(ownerProfile);
        setHasUsedTrial(isOwner ? !!fallbackOwnerProfile?.trial_used_at : false);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setIsLoading(false);
    }
  }, [accountId, userId, isTeamMember, accountIdLoading, getFallbackOwnerProfile]);

  const applySubscriptionData = (profile: any) => {
    const planType = (profile.plan_type as PlanType) || 'free';
    setPlan(planType);
    setSubscriptionStatus(profile.subscription_status || 'inactive');
    setBillingInterval(profile.billing_interval as 'month' | 'year' | null);
    setCurrentPeriodEnd(profile.current_period_end || null);

    // Compute trial end date robustly.
    // Some accounts only have current_period_end populated during trialing.
    const explicitTrialEnd: string | null = profile.trial_ends_at || null;
    const isTrialing = profile.subscription_status === 'trialing';

    const trialStart: string | null = profile.trial_used_at || profile.created_at || null;
    const fallbackTrialEnd = trialStart
      ? new Date(new Date(trialStart).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const computedTrialEnd: string | null =
      explicitTrialEnd || (isTrialing ? (profile.current_period_end || fallbackTrialEnd) : null);

    setTrialEndsAt(computedTrialEnd);

    // Check if in trial
    if (isTrialing && computedTrialEnd) {
      setIsTrial(true);
      // During trial, limit to 5 invoices
      setInvoiceLimit(TRIAL_INVOICE_LIMIT);
      setMaxAgents(FREE_MAX_AGENTS);
    } else {
      setIsTrial(false);

      // Set limits based on plan for active subscriptions
      if (planType !== 'free' && profile.subscription_status === 'active') {
        const config = PLAN_CONFIGS[planType as keyof typeof PLAN_CONFIGS];
        if (config) {
          setInvoiceLimit(profile.invoice_limit || config.invoiceLimit);
          setMaxAgents(config.maxAgents);
        }
      } else {
        // Free/inactive users get trial limits
        setInvoiceLimit(TRIAL_INVOICE_LIMIT);
        setMaxAgents(FREE_MAX_AGENTS);
      }
    }
  };

  useEffect(() => {
    if (accountIdLoading) return;

    fetchSubscription();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchSubscription();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchSubscription, accountIdLoading]);

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
    trialInvoiceLimit,
    canAccessFeature,
    refresh: fetchSubscription,
  };
}