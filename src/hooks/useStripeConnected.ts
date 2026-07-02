import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useStripeConnected() {
  const { data, isLoading } = useQuery({
    queryKey: ["stripe-connected"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;

      // Use effective account ID for team support (matches StripeIntegrationCard)
      const { data: effectiveAccountId } = await supabase.rpc(
        "get_effective_account_id",
        { p_user_id: userData.user.id }
      );
      const accountId = (effectiveAccountId as string) || userData.user.id;

      const { data: row } = await supabase
        .from("stripe_integrations")
        .select("id, is_connected, stripe_account_id, last_sync_at")
        .eq("user_id", accountId)
        .maybeSingle();

      if (!row?.is_connected) return null;
      return row;
    },
    staleTime: 60_000,
  });
  return { connected: !!data, integration: data, isLoading };
}
