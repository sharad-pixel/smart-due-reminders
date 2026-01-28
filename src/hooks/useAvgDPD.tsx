import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AccountAvgDPD {
  debtor_id: string;
  avg_dpd: number | null;
  open_invoices_count: number;
  max_dpd: number;
}

export interface OrgAvgDPD {
  avg_dpd: number | null;
  total_open_invoices: number;
  accounts_with_overdue: number;
}

/**
 * Calculate Average Days Past Due for all accounts
 * Formula: For each account, average the DPD of all open invoices past their due date
 */
export const useAccountsAvgDPD = () => {
  return useQuery({
    queryKey: ["accounts-avg-dpd"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get effective account ID for team member support
      const { data: effectiveAccountId } = await supabase
        .rpc('get_effective_account_id', { p_user_id: user.id });
      
      const accountId = effectiveAccountId || user.id;

      // Fetch all open invoices with their due dates
      const { data: invoices, error } = await supabase
        .from("invoices")
        .select("id, debtor_id, due_date, amount_outstanding, status")
        .eq("user_id", accountId)
        .in("status", ["Open", "PartiallyPaid", "InPaymentPlan"])
        .not("due_date", "is", null);

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Group by debtor and calculate avg DPD
      const debtorStats = new Map<string, { totalDpd: number; count: number; maxDpd: number }>();

      (invoices || []).forEach((inv: any) => {
        const dueDate = new Date(inv.due_date);
        dueDate.setHours(0, 0, 0, 0);
        
        // Calculate days past due (only count if past due)
        const diffTime = today.getTime() - dueDate.getTime();
        const dpd = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

        const current = debtorStats.get(inv.debtor_id) || { totalDpd: 0, count: 0, maxDpd: 0 };
        current.totalDpd += dpd;
        current.count += 1;
        current.maxDpd = Math.max(current.maxDpd, dpd);
        debtorStats.set(inv.debtor_id, current);
      });

      // Convert to array with calculated averages
      const result: AccountAvgDPD[] = [];
      debtorStats.forEach((stats, debtorId) => {
        result.push({
          debtor_id: debtorId,
          avg_dpd: stats.count > 0 ? Math.round(stats.totalDpd / stats.count) : null,
          open_invoices_count: stats.count,
          max_dpd: stats.maxDpd,
        });
      });

      return result;
    },
    staleTime: 60000, // 1 minute
  });
};

/**
 * Calculate organization-level Average Days Past Due
 * This is the average DPD across all open invoices in the org
 */
export const useOrgAvgDPD = () => {
  return useQuery({
    queryKey: ["org-avg-dpd"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get effective account ID for team member support
      const { data: effectiveAccountId } = await supabase
        .rpc('get_effective_account_id', { p_user_id: user.id });
      
      const accountId = effectiveAccountId || user.id;

      // Fetch all open invoices with their due dates
      const { data: invoices, error } = await supabase
        .from("invoices")
        .select("id, debtor_id, due_date, amount_outstanding, status")
        .eq("user_id", accountId)
        .in("status", ["Open", "PartiallyPaid", "InPaymentPlan"])
        .not("due_date", "is", null);

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let totalDpd = 0;
      let overdueCount = 0;
      const accountsWithOverdue = new Set<string>();

      (invoices || []).forEach((inv: any) => {
        const dueDate = new Date(inv.due_date);
        dueDate.setHours(0, 0, 0, 0);
        
        const diffTime = today.getTime() - dueDate.getTime();
        const dpd = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        
        totalDpd += dpd;
        if (dpd > 0) {
          overdueCount++;
          accountsWithOverdue.add(inv.debtor_id);
        }
      });

      const invoiceCount = invoices?.length || 0;

      return {
        avg_dpd: invoiceCount > 0 ? Math.round(totalDpd / invoiceCount) : null,
        total_open_invoices: invoiceCount,
        accounts_with_overdue: accountsWithOverdue.size,
      } as OrgAvgDPD;
    },
    staleTime: 60000, // 1 minute
  });
};

/**
 * Get Avg DPD for a specific account from the pre-calculated map
 */
export const getAccountAvgDPD = (
  accountsData: AccountAvgDPD[] | undefined,
  debtorId: string
): number | null => {
  if (!accountsData) return null;
  const account = accountsData.find(a => a.debtor_id === debtorId);
  return account?.avg_dpd ?? null;
};
