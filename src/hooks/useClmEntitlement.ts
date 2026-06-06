import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the effective account id for the current user and reports Contract
 * Intelligence as always-enabled. The previous entitlement gating has been
 * removed — Contract Intelligence is available to every account.
 */
export const useClmEntitlement = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["clm-entitlement"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { isActive: false, accountId: undefined as string | undefined };

      const { data: memberships } = await supabase
        .from("account_users")
        .select("account_id, is_owner")
        .eq("user_id", user.id)
        .eq("status", "active");

      const teamAccount = memberships?.find((m) => !m.is_owner)?.account_id;
      const ownAccount = memberships?.find((m) => m.is_owner)?.account_id;
      const effectiveAccountId = teamAccount ?? ownAccount ?? user.id;

      return { isActive: true, accountId: effectiveAccountId };
    },
    staleTime: 60_000,
  });

  return {
    isActive: data?.isActive ?? true,
    entitlement: null,
    accountId: data?.accountId,
    isLoading,
  };
};
