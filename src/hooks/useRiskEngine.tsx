import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface RiskHistory {
  id: string;
  debtor_id: string;
  snapshot_at: string;
  risk_payment_score: number | null;
  risk_tier: string | null;
  risk_status_note: string | null;
  basis_invoices_count: number;
  basis_payments_count: number;
  basis_days_observed: number;
  calculation_details: object;
  created_at: string;
  // Enterprise fields
  collections_health_score: number | null;
  collections_risk_score: number | null;
  health_tier: string | null;
  ai_sentiment_score: number | null;
  score_components: ScoreComponents | null;
}

export interface ScoreComponents {
  payment_history_score: number;
  dpd_score: number;
  outstanding_balance_score: number;
  ai_sentiment_health_score: number;
  dpd_risk: number;
  negative_payment_trend: number;
  ai_sentiment_risk: number;
  balance_concentration_risk: number;
  data_sufficient: boolean;
  on_time_payment_pct: number;
  avg_days_late: number;
  broken_promises_count: number;
  max_dpd: number;
  total_outstanding: number;
  high_aging_concentration_pct: number;
  engagement_rate: number;
  penalties: { reason: string; amount: number; category: string }[];
}

export interface EnterpriseScoreResult {
  collections_health_score: number | null;
  collections_risk_score: number | null;
  health_tier: string | null;
  risk_tier_detailed: string | null;
  ai_sentiment_score: number | null;
  ai_sentiment_category: string | null;
  score_components: ScoreComponents | null;
  last_score_change_reason: string | null;
  // D&B PAYDEX-style fields
  paydex_score: number | null;
  paydex_rating: string | null;
  payment_trend: string | null;
  credit_limit_recommendation: number | null;
  payment_experience_summary: PaymentExperienceSummary | null;
}

export interface PaymentExperienceSummary {
  prompt_payments_pct: number;
  slow_payments_pct: number;
  very_slow_payments_pct: number;
  delinquent_payments_pct: number;
  weighted_avg_days_beyond_terms: number;
  total_payment_experiences: number;
  high_credit_amount: number;
  current_owing: number;
  past_due_amount: number;
  payment_manner_description: string;
}

export const useRiskEngine = (debtorId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Calculate risk for a single debtor or all debtors (batched)
  const calculateRisk = useMutation({
    mutationFn: async ({ 
      debtor_id, 
      recalculate_all, 
      analyze_sentiment 
    }: { 
      debtor_id?: string; 
      recalculate_all?: boolean;
      analyze_sentiment?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Single debtor - direct call
      if (debtor_id && !recalculate_all) {
        const { data, error } = await supabase.functions.invoke("risk-engine", {
          body: { debtor_id, user_id: user.id, analyze_sentiment },
        });
        if (error) throw error;
        return data;
      }

      // Recalculate all - batch to avoid timeout
      const { data: debtors, error: fetchErr } = await supabase
        .from("debtors")
        .select("id")
        .eq("is_archived", false);

      if (fetchErr) throw fetchErr;
      if (!debtors || debtors.length === 0) return { processed: 0 };

      const BATCH_SIZE = 3;
      const ids = debtors.map(d => d.id);
      let processed = 0;

      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(id =>
            supabase.functions.invoke("risk-engine", {
              body: { debtor_id: id, user_id: user.id, analyze_sentiment },
            })
          )
        );
        results.forEach(r => {
          if (r.status === "fulfilled" && !r.value.error) processed++;
        });
        if (i + BATCH_SIZE < ids.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      return { success: true, processed };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["debtors"] });
      queryClient.invalidateQueries({ queryKey: ["debtor", debtorId] });
      queryClient.invalidateQueries({ queryKey: ["debtor-risk-history", debtorId] });
      queryClient.invalidateQueries({ queryKey: ["debtor-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["score-change-history", debtorId] });
      toast({
        title: "Success",
        description: `Enterprise scoring updated for ${data?.processed ?? 0} account(s)`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to calculate scores",
        variant: "destructive",
      });
    },
  });

  // Get risk history for a debtor
  const riskHistory = useQuery({
    queryKey: ["debtor-risk-history", debtorId],
    queryFn: async () => {
      if (!debtorId) return [];

      const { data, error } = await supabase
        .from("debtor_risk_history")
        .select("*")
        .eq("debtor_id", debtorId)
        .order("snapshot_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      return (data || []).map(d => ({
        ...d,
        score_components: d.score_components as unknown as ScoreComponents | null
      })) as RiskHistory[];
    },
    enabled: !!debtorId,
  });

  // Get enterprise score for a debtor
  const enterpriseScore = useQuery({
    queryKey: ["debtor-enterprise-score", debtorId],
    queryFn: async () => {
      if (!debtorId) return null;

      const { data, error } = await supabase
        .from("debtors")
        .select(`
          collections_health_score,
          collections_risk_score,
          health_tier,
          risk_tier_detailed,
          ai_sentiment_score,
          ai_sentiment_category,
          score_components,
          last_score_change_reason,
          paydex_score,
          paydex_rating,
          payment_trend,
          credit_limit_recommendation,
          payment_experience_summary
        `)
        .eq("id", debtorId)
        .single();

      if (error) throw error;
      return {
        ...data,
        score_components: data.score_components as unknown as ScoreComponents | null,
        payment_experience_summary: data.payment_experience_summary as unknown as PaymentExperienceSummary | null
      } as EnterpriseScoreResult;
    },
    enabled: !!debtorId,
  });

  return {
    calculateRisk,
    riskHistory: riskHistory.data || [],
    isLoadingHistory: riskHistory.isLoading,
    enterpriseScore: enterpriseScore.data,
    isLoadingEnterpriseScore: enterpriseScore.isLoading,
  };
};

// Hook for dashboard-level risk summary with enterprise scoring
export const useRiskDashboard = () => {
  return useQuery({
    queryKey: ["risk-dashboard-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debtors")
        .select(`
          id, 
          company_name, 
          payment_score, 
          payment_risk_tier, 
          risk_status_note, 
          total_open_balance,
          collections_health_score,
          collections_risk_score,
          health_tier,
          risk_tier_detailed,
          ai_sentiment_category
        `)
        .eq("is_archived", false)
        .order("collections_health_score", { ascending: true, nullsFirst: true });

      if (error) throw error;

      const total = data.length;
      
      // Enterprise tiers
      const stillLearning = data.filter(d => !d.health_tier || d.health_tier === "Still Learning").length;
      const healthy = data.filter(d => d.health_tier === "Healthy").length;
      const watch = data.filter(d => d.health_tier === "Watch").length;
      const atRisk = data.filter(d => d.health_tier === "At Risk").length;
      const critical = data.filter(d => d.health_tier === "Critical").length;

      // Risk tiers
      const lowRisk = data.filter(d => d.risk_tier_detailed === "Low Risk").length;
      const mediumRisk = data.filter(d => d.risk_tier_detailed === "Medium Risk").length;
      const highRisk = data.filter(d => d.risk_tier_detailed === "High Risk").length;
      const criticalRisk = data.filter(d => d.risk_tier_detailed === "Critical Risk").length;

      // Legacy tiers (for backward compatibility)
      const low = data.filter(d => d.payment_risk_tier === "Low").length;
      const medium = data.filter(d => d.payment_risk_tier === "Medium").length;
      const high = data.filter(d => d.payment_risk_tier === "High").length;
      const criticalLegacy = data.filter(d => d.payment_risk_tier === "Critical").length;

      // High risk accounts by balance (using enterprise scoring)
      const highRiskAccounts = data
        .filter(d => d.health_tier === "At Risk" || d.health_tier === "Critical")
        .sort((a, b) => (b.total_open_balance || 0) - (a.total_open_balance || 0))
        .slice(0, 5);

      // Average scores
      const accountsWithScores = data.filter(d => d.collections_health_score !== null);
      const avgHealthScore = accountsWithScores.length > 0
        ? accountsWithScores.reduce((sum, d) => sum + (d.collections_health_score || 0), 0) / accountsWithScores.length
        : null;
      const avgRiskScore = accountsWithScores.length > 0
        ? accountsWithScores.reduce((sum, d) => sum + (d.collections_risk_score || 0), 0) / accountsWithScores.length
        : null;

      return {
        total,
        stillLearning,
        // Enterprise health tiers
        healthy,
        watch,
        atRisk,
        critical,
        // Enterprise risk tiers
        lowRisk,
        mediumRisk,
        highRisk,
        criticalRisk,
        // Legacy tiers
        low,
        medium,
        high,
        criticalLegacy,
        highRiskAccounts,
        avgHealthScore: avgHealthScore ? Math.round(avgHealthScore) : null,
        avgRiskScore: avgRiskScore ? Math.round(avgRiskScore) : null,
        distribution: {
          stillLearning: total > 0 ? (stillLearning / total) * 100 : 0,
          healthy: total > 0 ? (healthy / total) * 100 : 0,
          watch: total > 0 ? (watch / total) * 100 : 0,
          atRisk: total > 0 ? (atRisk / total) * 100 : 0,
          critical: total > 0 ? (critical / total) * 100 : 0,
          // Legacy
          low: total > 0 ? (low / total) * 100 : 0,
          medium: total > 0 ? (medium / total) * 100 : 0,
          high: total > 0 ? (high / total) * 100 : 0,
        },
      };
    },
  });
};
