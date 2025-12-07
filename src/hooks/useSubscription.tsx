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
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  billingInterval: 'month' | 'year' | null;
  canAccessFeature: (feature: string) => boolean;
  refresh: () => Promise<void>;
}

const FREE_INVOICE_LIMIT = 15;
const FREE_MAX_AGENTS = 6;

export function useSubscription(): SubscriptionState {
  const [isLoading, setIsLoading] = useState(true);
  const [plan, setPlan] = useState<PlanType>('free');
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('inactive');
  const [invoiceLimit, setInvoiceLimit] = useState(FREE_INVOICE_LIMIT);
  const [maxAgents, setMaxAgents] = useState(FREE_MAX_AGENTS);
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year' | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setIsLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('plan_type, subscription_status, invoice_limit, trial_ends_at, current_period_end, billing_interval')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile) {
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
        if (planType !== 'free' && profile.subscription_status === 'active') {
          const config = PLAN_CONFIGS[planType as keyof typeof PLAN_CONFIGS];
          if (config) {
            setInvoiceLimit(profile.invoice_limit || config.invoiceLimit);
            setMaxAgents(config.maxAgents);
          }
        } else {
          setInvoiceLimit(FREE_INVOICE_LIMIT);
          setMaxAgents(FREE_MAX_AGENTS);
        }
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    // Free users get basic access
    if (plan === 'free') {
      return true; // All features available, just limited invoices
    }
    // Enterprise gets everything
    if (plan === 'enterprise') return true;
    // Check plan config
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
    trialEndsAt,
    currentPeriodEnd,
    billingInterval,
    canAccessFeature,
    refresh: fetchSubscription,
  };
}