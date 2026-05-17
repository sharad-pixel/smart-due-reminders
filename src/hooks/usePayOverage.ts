import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Shared "Pay outstanding overage now" flow.
 * Opens a Stripe Checkout session that settles `pending_overage_credits`
 * at $1.00/credit (no discount). Does NOT add new credits to the wallet.
 */
export function usePayOverage(accountId: string | null | undefined) {
  const [loading, setLoading] = useState(false);

  const payOverage = useCallback(async () => {
    if (!accountId) {
      toast.error("No active account");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("asc606-purchase-credits", {
        body: { mode: "overage", accountId },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to start checkout");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  return { payOverage, loading };
}
