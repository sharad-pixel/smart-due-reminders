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
    dpd_121_150_pct: number;
    dpd_150_plus_pct: number;
  };
  breakdown: string[];
}

export const usePaymentScore = (debtorId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const calculateScore = useMutation({
    mutationFn: async ({ debtor_id, recalculate_all }: { debtor_id?: string; recalculate_all?: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("risk-engine", {
        body: { debtor_id, recalculate_all, user_id: user.id },
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
      // Ensure user is authenticated before querying
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch debtors
      const { data, error } = await supabase
        .from("debtors")
        .select("*")
        .eq("is_archived", false)
        .order("payment_score", { ascending: true, nullsFirst: true });

      if (error) throw error;

      // Fetch invoices from last 90 days for DSO calculation
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];

      const { data: invoices, error: invoicesError } = await supabase
        .from("invoices")
        .select("amount_original, amount_outstanding, status, issue_date")
        .gte("issue_date", ninetyDaysAgoStr)
        .not("status", "eq", "Draft");

      if (invoicesError) throw invoicesError;

      // Calculate DSO using proper formula:
      // DSO = (Total Outstanding Amount / Total Original Invoice Amount) × 90
      let totalOutstanding = 0;
      let totalOriginal = 0;

      (invoices || []).forEach((inv: any) => {
        const original = Number(inv.amount_original) || Number(inv.amount_outstanding) || 0;
        totalOriginal += original;
        
        // Paid invoices contribute 0 outstanding_amount
        if (inv.status === "Paid" || inv.status === "Settled" || inv.status === "Canceled") {
          totalOutstanding += 0;
        } else {
          // Open, Partial, Overdue invoices
          totalOutstanding += Number(inv.amount_outstanding) || 0;
        }
      });

      let dso = totalOriginal > 0 ? Math.round((totalOutstanding / totalOriginal) * 90) : 0;
      // Cap DSO at maximum 365
      dso = Math.min(dso, 365);

      const totalDebtors = data.length;
      const avgScore = data.filter(d => d.payment_score !== null).reduce((sum, d) => sum + (d.payment_score || 0), 0) / 
        (data.filter(d => d.payment_score !== null).length || 1);
      
      // Count by risk tiers (case-insensitive matching)
      const tier = (d: typeof data[0]) => d.payment_risk_tier?.toLowerCase();
      const stillLearning = data.filter(d => !d.payment_risk_tier || tier(d) === "still learning").length;
      const lowRisk = data.filter(d => tier(d) === "low").length;
      const mediumRisk = data.filter(d => tier(d) === "medium").length;
      const highRisk = data.filter(d => tier(d) === "high").length;
      const criticalRisk = data.filter(d => tier(d) === "critical").length;
      
      // Calculate total AR
      const totalAR = data.reduce((sum, d) => sum + (d.total_open_balance || 0), 0);

      return {
        debtors: data,
        summary: {
          totalDebtors,
          avgScore: Math.round(avgScore),
          stillLearning,
          lowRisk,
          mediumRisk,
          highRisk,
          criticalRisk,
          dso,
          totalAR,
        },
      };
    },
  });
};
