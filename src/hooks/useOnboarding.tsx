import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OnboardingProgress {
  id: string;
  current_step: number;
  business_profile_completed: boolean;
  documents_uploaded: boolean;
  branding_completed: boolean;
  ar_introduction_sent: boolean;
  training_viewed: boolean;
  completed_at: string | null;
  dismissed_at: string | null;
}

export function useOnboarding() {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProgress = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: _eff } = user
        ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
        : { data: null };
      const accountId = (_eff as string | null) || user?.id;
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('user_id', accountId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching onboarding:', error);
        setLoading(false);
        return;
      }

      if (!data) {
        // Create record if missing (for existing users)
        const { data: newRecord } = await supabase
          .from('onboarding_progress')
          .insert({ user_id: accountId })
          .select()
          .single();
        setProgress(newRecord as OnboardingProgress | null);
      } else {
        setProgress(data as OnboardingProgress);
      }
    } catch (err) {
      console.error('Error in useOnboarding:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  const updateStep = useCallback(async (updates: Partial<OnboardingProgress>) => {
    if (!progress) return;
    const { error } = await supabase
      .from('onboarding_progress')
      .update(updates)
      .eq('id', progress.id);
    if (!error) {
      setProgress(prev => prev ? { ...prev, ...updates } : prev);
    }
  }, [progress]);

  const completeOnboarding = useCallback(async () => {
    await updateStep({ completed_at: new Date().toISOString() });
  }, [updateStep]);

  const dismissOnboarding = useCallback(async () => {
    await updateStep({ dismissed_at: new Date().toISOString() });
  }, [updateStep]);

  const isComplete = !!progress?.completed_at;
  const isDismissed = !!progress?.dismissed_at;
  const needsOnboarding = !loading && progress && !isComplete && !isDismissed;

  return {
    progress,
    loading,
    isComplete,
    isDismissed,
    needsOnboarding,
    updateStep,
    completeOnboarding,
    dismissOnboarding,
    refresh: fetchProgress,
  };
}
