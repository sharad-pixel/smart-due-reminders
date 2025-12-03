import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type PlanType, getInvoiceLimit, getMaxAgents, PLAN_CONFIGS } from '@/lib/subscriptionConfig';

interface SubscriptionState {
  plan: PlanType;
  invoiceLimit: number;
  maxAgents: number;
  subscriptionStatus: string;
  isLoading: boolean;
  isSubscribed: boolean;
  isPastDue: boolean;
  canAccessFeature: (feature: string) => boolean;
  refresh: () => Promise<void>;
}

export function useSubscription(): SubscriptionState {
  const [plan, setPlan] = useState<PlanType>('free');
  const [subscriptionStatus, setSubscriptionStatus] = useState('inactive');
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setPlan('free');
        setSubscriptionStatus('inactive');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('plan_type, subscription_status')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        setPlan((profile.plan_type as PlanType) || 'free');
        setSubscriptionStatus(profile.subscription_status || 'inactive');
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchSubscription();
    });

    // Refresh periodically
    const interval = setInterval(fetchSubscription, 60000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [fetchSubscription]);

  const canAccessFeature = useCallback((feature: string): boolean => {
    if (plan === 'enterprise') return true;
    if (plan === 'free') return false;
    
    const config = PLAN_CONFIGS[plan];
    if (!config) return false;
    
    return config.features.some(f => 
      f.toLowerCase().includes(feature.toLowerCase())
    );
  }, [plan]);

  return {
    plan,
    invoiceLimit: getInvoiceLimit(plan),
    maxAgents: getMaxAgents(plan),
    subscriptionStatus,
    isLoading,
    isSubscribed: ['active', 'trialing'].includes(subscriptionStatus),
    isPastDue: subscriptionStatus === 'past_due',
    canAccessFeature,
    refresh: fetchSubscription,
  };
}
