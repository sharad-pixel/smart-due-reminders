import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RevenueRiskAggregate {
  total_ar: number;
  overdue_ar: number;
  pct_overdue: number;
  total_ecl: number;
  engagement_adjusted_ecl: number;
  pct_at_risk: number;
  avg_collectability: number;
  invoice_count: number;
  debtor_count: number;
  collectability_distribution: {
    high: number;
    moderate: number;
    at_risk: number;
    high_risk: number;
  };
  engagement_breakdown: {
    active: { count: number; ar_value: number };
    no_response: { count: number; ar_value: number };
    moderate: { count: number; ar_value: number };
  };
}

export interface TopRiskAccount {
  debtor_id: string;
  debtor_name: string;
  balance: number;
  collectability_score: number;
  engagement_score: number;
  engagement_level: string;
  ecl: number;
  engagement_adjusted_ecl: number;
  recommended_action: string;
  conversation_state: string;
  invoice_count: number;
}

export interface InvoiceScore {
  invoice_id: string;
  debtor_id: string;
  collectability_score: number;
  collectability_tier: string;
  aging_penalty: number;
  behavioral_penalty: number;
  status_penalty: number;
  engagement_boost: number;
  probability_of_default: number;
  expected_credit_loss: number;
  engagement_adjusted_pd: number;
  engagement_adjusted_ecl: number;
  risk_factors: string[];
  recommended_action: string;
  payment_likelihood: string;
  amount: number;
  days_past_due: number;
}

export interface AIInsights {
  risk_summary: string;
  engagement_insight: string;
  recommendations: string[];
  key_drivers: string[];
  recommended_reserve_amount?: number;
  reserve_rationale?: string;
}

export interface RevenueRiskData {
  success: boolean;
  generated_at: string;
  aggregate: RevenueRiskAggregate;
  top_risk_accounts: TopRiskAccount[];
  invoice_scores: InvoiceScore[];
  ai_insights: AIInsights | null;
  disclaimer: string;
}

export function useRevenueRisk() {
  const [generatingAI, setGeneratingAI] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["revenue-risk"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("revenue-risk-engine", {
        body: { user_id: session.user.id, generate_ai_summary: false },
      });

      if (error) throw error;
      return data as RevenueRiskData;
    },
    staleTime: 5 * 60 * 1000,
  });

  const regenerateWithAI = async () => {
    setGeneratingAI(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data: result, error } = await supabase.functions.invoke("revenue-risk-engine", {
        body: { user_id: session.user.id, generate_ai_summary: true },
      });

      if (error) throw error;
      refetch();
      toast.success("AI insights generated");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate AI insights");
    } finally {
      setGeneratingAI(false);
    }
  };

  return {
    data,
    isLoading,
    isFetching,
    refetch,
    generatingAI,
    regenerateWithAI,
  };
}
