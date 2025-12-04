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
}

export const useRiskEngine = (debtorId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Calculate risk for a single debtor or all debtors
  const calculateRisk = useMutation({
    mutationFn: async ({ debtor_id, recalculate_all }: { debtor_id?: string; recalculate_all?: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("risk-engine", {
        body: { debtor_id, recalculate_all, user_id: user.id },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["debtors"] });
      queryClient.invalidateQueries({ queryKey: ["debtor", debtorId] });
      queryClient.invalidateQueries({ queryKey: ["debtor-risk-history", debtorId] });
      queryClient.invalidateQueries({ queryKey: ["debtor-dashboard"] });
      toast({
        title: "Success",
        description: `Risk assessment updated for ${data.processed} account(s)`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to calculate risk score",
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
      return data as RiskHistory[];
    },
    enabled: !!debtorId,
  });

  return {
    calculateRisk,
    riskHistory: riskHistory.data || [],
    isLoadingHistory: riskHistory.isLoading,
  };
};

// Hook for dashboard-level risk summary
export const useRiskDashboard = () => {
  return useQuery({
    queryKey: ["risk-dashboard-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debtors")
        .select("id, company_name, payment_score, payment_risk_tier, risk_status_note, total_open_balance")
        .eq("is_archived", false)
        .order("payment_score", { ascending: true, nullsFirst: true });

      if (error) throw error;

      const total = data.length;
      const stillLearning = data.filter(d => !d.payment_risk_tier || d.payment_risk_tier === "Still learning").length;
      const low = data.filter(d => d.payment_risk_tier === "Low").length;
      const medium = data.filter(d => d.payment_risk_tier === "Medium").length;
      const high = data.filter(d => d.payment_risk_tier === "High").length;
      const critical = data.filter(d => d.payment_risk_tier === "Critical").length;

      // High risk accounts by balance
      const highRiskAccounts = data
        .filter(d => d.payment_risk_tier === "High" || d.payment_risk_tier === "Critical")
        .sort((a, b) => (b.total_open_balance || 0) - (a.total_open_balance || 0))
        .slice(0, 5);

      return {
        total,
        stillLearning,
        low,
        medium,
        high,
        critical,
        highRiskAccounts,
        distribution: {
          stillLearning: total > 0 ? (stillLearning / total) * 100 : 0,
          low: total > 0 ? (low / total) * 100 : 0,
          medium: total > 0 ? (medium / total) * 100 : 0,
          high: total > 0 ? (high / total) * 100 : 0,
          critical: total > 0 ? (critical / total) * 100 : 0,
        },
      };
    },
  });
};
