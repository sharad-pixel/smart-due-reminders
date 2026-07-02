import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useStripeConnected() {
  const { data, isLoading } = useQuery({
    queryKey: ["stripe-connected"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data: row } = await supabase
        .from("stripe_integrations")
        .select("id, is_connected, stripe_account_id, last_sync_at")
        .eq("user_id", userData.user.id)
        .eq("is_connected", true)
        .maybeSingle();
      return row;
    },
    staleTime: 60_000,
  });
  return { connected: !!data, integration: data, isLoading };
}
