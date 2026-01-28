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
    staleTime: 0,
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

      // Fetch invoices for DSO and Average Days to Pay calculation
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];

      // Get all invoices for calculations (exclude Draft)
      const { data: invoices, error: invoicesError } = await supabase
        .from("invoices")
        .select("amount, amount_original, amount_outstanding, status, issue_date, paid_date")
        .not("status", "eq", "Draft");

      if (invoicesError) throw invoicesError;

      // Filter invoices from last 90 days for DSO calculation
      const recentInvoices = (invoices || []).filter((inv: any) => {
        if (!inv.issue_date) return false;
        return inv.issue_date >= ninetyDaysAgoStr;
      });

      // Calculate DSO using proper formula:
      // DSO = (Accounts Receivable / Total Credit Sales in Period) × Number of Days in Period
      let totalOutstanding = 0;
      let totalCreditSales = 0;

      recentInvoices.forEach((inv: any) => {
        const original = Number(inv.amount_original) || Number(inv.amount) || 0;
        totalCreditSales += original;
        
        // Paid invoices contribute 0 to outstanding
        if (inv.status === "Paid" || inv.status === "Settled" || inv.status === "Canceled") {
          totalOutstanding += 0;
        } else {
          // Open, Partial, Overdue, etc. invoices
          totalOutstanding += Number(inv.amount_outstanding) || Number(inv.amount) || 0;
        }
      });

      // DSO = (Accounts Receivable / Total Credit Sales) × Days in Period (90 days)
      let dso = totalCreditSales > 0 ? Math.round((totalOutstanding / totalCreditSales) * 90) : 0;
      // Cap DSO at maximum 365
      dso = Math.min(dso, 365);
      
      // Calculate Average Days to Pay using proper formula:
      // Average Days to Pay = Total Days Taken to Pay All Invoices / Number of Paid Invoices
      // Days Taken to Pay = Invoice Payment Date - Invoice Issue Date
      const paidInvoices = (invoices || []).filter((inv: any) => 
        inv.status === "Paid" && inv.paid_date && inv.issue_date
      );
      
      let avgDaysToPay: number | null = null;
      if (paidInvoices.length > 0) {
        const totalDays = paidInvoices.reduce((sum: number, inv: any) => {
          const issueDate = new Date(inv.issue_date);
          const paidDate = new Date(inv.paid_date);
          const days = Math.max(0, Math.floor(
            (paidDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)
          ));
          return sum + days;
        }, 0);
        avgDaysToPay = Math.round(totalDays / paidInvoices.length);
        // Cap at 365 to avoid extreme outliers
        avgDaysToPay = Math.min(avgDaysToPay, 365);
      }

      const totalDebtors = data.length;
      const scoredDebtors = data.filter(d => d.payment_score !== null);
      const avgScore = scoredDebtors.length > 0 
        ? scoredDebtors.reduce((sum, d) => sum + (d.payment_score || 0), 0) / scoredDebtors.length
        : 50;
      
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
          avgDaysToPay,
          totalAR,
        },
      };
    },
  });
};
