import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type PlanType } from '@/lib/subscriptionConfig';

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

// Stripe disconnected - all users get free access with full features
const FREE_INVOICE_LIMIT = 15;
const FREE_MAX_AGENTS = 6;

export function useSubscription(): SubscriptionState {
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    // Stripe disconnected - just verify user is logged in
    try {
      await supabase.auth.getSession();
    } catch (error) {
      console.error('Error checking session:', error);
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

  // All features enabled for free users (Stripe disconnected)
  const canAccessFeature = useCallback((_feature: string): boolean => {
    return true;
  }, []);

  return {
    plan: 'free',
    invoiceLimit: FREE_INVOICE_LIMIT,
    maxAgents: FREE_MAX_AGENTS,
    subscriptionStatus: 'active',
    isLoading,
    isSubscribed: true, // All users treated as subscribed
    isPastDue: false,
    canAccessFeature,
    refresh: fetchSubscription,
  };
}
