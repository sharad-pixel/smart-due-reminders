import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PortfolioRiskSummary {
  total_accounts_scored: number;
  prompt_payers_pct: number;
  slow_payers_pct: number;
  delinquent_pct: number;
  avg_score: number;
  rating: string;
  trend: string;
  total_ar_at_risk: number;
}

export interface DailyDigest {
  id: string;
  user_id: string;
  digest_date: string;
  open_tasks_count: number;
  overdue_tasks_count: number;
  tasks_created_today: number;
  total_ar_outstanding: number;
  ar_current: number;
  ar_1_30: number;
  ar_31_60: number;
  ar_61_90: number;
  ar_91_120: number;
  ar_120_plus: number;
  payments_collected_today: number;
  payments_collected_last_7_days: number;
  payments_collected_prev_7_days: number;
  collection_trend: string;
  high_risk_customers_count: number;
  high_risk_ar_outstanding: number;
  health_score: number;
  health_label: string;
  email_sent_at: string | null;
  created_at: string;
  // PAYDEX / Credit Intelligence fields
  avg_paydex_score: number | null;
  avg_paydex_rating: string | null;
  accounts_prompt_payers: number;
  accounts_slow_payers: number;
  accounts_delinquent: number;
  avg_payment_trend: string | null;
  total_credit_limit_recommended: number;
  portfolio_risk_summary: PortfolioRiskSummary | null;
}

export const useDailyDigest = (date?: string) => {
  const targetDate = date || new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['daily-digest', targetDate],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get effective account ID for team member support
      const { data: effectiveAccountId } = await supabase
        .rpc('get_effective_account_id', { p_user_id: user.id });
      
      const accountId = effectiveAccountId || user.id;

      const { data, error } = await supabase
        .from('daily_digests')
        .select('*')
        .eq('user_id', accountId)
        .eq('digest_date', targetDate)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as DailyDigest | null;
    },
  });
};

export const useLatestDigest = () => {
  return useQuery({
    queryKey: ['latest-digest'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get effective account ID for team member support
      const { data: effectiveAccountId } = await supabase
        .rpc('get_effective_account_id', { p_user_id: user.id });
      
      const accountId = effectiveAccountId || user.id;

      const { data, error } = await supabase
        .from('daily_digests')
        .select('*')
        .eq('user_id', accountId)
        .order('digest_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as DailyDigest | null;
    },
  });
};

export const useDigestHistory = (limit = 30) => {
  return useQuery({
    queryKey: ['digest-history', limit],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get effective account ID for team member support
      const { data: effectiveAccountId } = await supabase
        .rpc('get_effective_account_id', { p_user_id: user.id });
      
      const accountId = effectiveAccountId || user.id;

      const { data, error } = await supabase
        .from('daily_digests')
        .select('*')
        .eq('user_id', accountId)
        .order('digest_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as unknown as DailyDigest[];
    },
  });
};
