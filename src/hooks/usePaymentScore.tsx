import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PaymentScoreData {
  debtor_id: string;
  payment_score: number;
  payment_risk_tier: string;
  avg_days_to_pay: number | null;
  max_days_past_due: number;
  open_invoices_count: number;
  disputed_invoices_count: number;
  in_payment_plan_invoices_count: number;
  written_off_invoices_count: number;
  aging_mix: {
    current_pct: number;
    dpd_1_30_pct: number;
    dpd_31_60_pct: number;
    dpd_61_90_pct: number;
    dpd_91_120_pct: number;
    dpd_121_plus_pct: number;
  };
  breakdown: string[];
}

export const usePaymentScore = (debtorId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const calculateScore = useMutation({
    mutationFn: async ({ debtor_id, recalculate_all }: { debtor_id?: string; recalculate_all?: boolean }) => {
      const { data, error } = await supabase.functions.invoke("calculate-payment-score", {
        body: { debtor_id, recalculate_all },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debtors"] });
      queryClient.invalidateQueries({ queryKey: ["debtor", debtorId] });
      toast({
        title: "Success",
        description: "Payment score recalculated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to calculate payment score",
        variant: "destructive",
      });
    },
  });

  return {
    calculateScore,
  };
};

export const useDebtorDashboard = () => {
  return useQuery({
    queryKey: ["debtor-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debtors")
        .select("*")
        .order("payment_score", { ascending: false });

      if (error) throw error;

      const totalDebtors = data.length;
      const avgScore = data.reduce((sum, d) => sum + (d.payment_score || 50), 0) / (totalDebtors || 1);
      const lowRisk = data.filter(d => d.payment_risk_tier === "low").length;
      const mediumRisk = data.filter(d => d.payment_risk_tier === "medium").length;
      const highRisk = data.filter(d => d.payment_risk_tier === "high").length;

      return {
        debtors: data,
        summary: {
          totalDebtors,
          avgScore: Math.round(avgScore),
          lowRisk,
          mediumRisk,
          highRisk,
        },
      };
    },
  });
};
