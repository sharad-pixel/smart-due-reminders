import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type BillingSyncStatus =
  | "not_connected"
  | "ready"
  | "pending_review"
  | "ready_for_stripe"
  | "synchronized"
  | "error"
  | "needs_attention";

export interface BillingSyncRow {
  id: string;
  contract_id: string;
  status: BillingSyncStatus;
  readiness_score: number;
  blocking_issues: Array<{ field: string; message: string }>;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_schedule_id: string | null;
  last_sync_at: string | null;
  last_error: any;
}

export function useContractBillingSync(contractId: string | null) {
  const qc = useQueryClient();

  const syncQuery = useQuery({
    queryKey: ["contract-stripe-sync", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data } = await supabase
        .from("contract_stripe_sync")
        .select("*")
        .eq("contract_id", contractId!)
        .maybeSingle();
      return (data as unknown) as BillingSyncRow | null;
    },
  });

  const mappingsQuery = useQuery({
    queryKey: ["contract-stripe-mappings", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data } = await supabase
        .from("contract_stripe_product_map")
        .select("*")
        .eq("contract_id", contractId!);
      return data ?? [];
    },
  });

  const linksQuery = useQuery({
    queryKey: ["contract-stripe-invoice-links", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data } = await supabase
        .from("contract_stripe_invoice_link")
        .select("*")
        .eq("contract_id", contractId!);
      return data ?? [];
    },
  });

  const computeReadiness = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-billing-readiness", {
        body: { contract_id: contractId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-stripe-sync", contractId] });
      toast.success("Billing readiness recalculated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to compute readiness"),
  });

  const syncToStripe = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-billing-sync", {
        body: { contract_id: contractId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-stripe-sync", contractId] });
      qc.invalidateQueries({ queryKey: ["contract-stripe-invoice-links", contractId] });
      toast.success("Synced to Stripe");
    },
    onError: (e: any) => toast.error(e.message || "Sync failed"),
  });

  return {
    sync: syncQuery.data,
    mappings: mappingsQuery.data ?? [],
    invoiceLinks: linksQuery.data ?? [],
    isLoading: syncQuery.isLoading || mappingsQuery.isLoading,
    computeReadiness,
    syncToStripe,
  };
}
