import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns CLM (Contract Lifecycle Management) entitlement for the current user's
 * effective account. CLM is a separately purchasable add-on toggled by Recouply admins.
 */
export const useClmEntitlement = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["clm-entitlement"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { isActive: false, entitlement: null };

      // Resolve effective account (parent owner if team member)
      const { data: memberships } = await supabase
        .from("account_users")
        .select("account_id, is_owner")
        .eq("user_id", user.id)
        .eq("status", "active");

      const teamAccount = memberships?.find((m) => !m.is_owner)?.account_id;
      const ownAccount = memberships?.find((m) => m.is_owner)?.account_id;
      const effectiveAccountId = teamAccount ?? ownAccount ?? user.id;

      const { data: ent } = await supabase
        .from("clm_entitlements")
        .select("*")
        .eq("account_id", effectiveAccountId)
        .maybeSingle();

      return {
        isActive: ent?.status === "active",
        entitlement: ent ?? null,
        accountId: effectiveAccountId,
      };
    },
    staleTime: 60_000,
  });

  return {
    isActive: data?.isActive ?? false,
    entitlement: data?.entitlement ?? null,
    accountId: data?.accountId,
    isLoading,
  };
};

/**
 * Admin-only: read & toggle CLM entitlement for a specific account.
 */
export const useAdminClmEntitlement = (accountId: string | null) => {
  const queryClient = useQueryClient();

  const { data: entitlement, isLoading } = useQuery({
    queryKey: ["admin-clm-entitlement", accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const { data } = await supabase
        .from("clm_entitlements")
        .select("*")
        .eq("account_id", accountId)
        .maybeSingle();
      return data;
    },
    enabled: !!accountId,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ enabled, notes }: { enabled: boolean; notes?: string }) => {
      if (!accountId) throw new Error("Account ID required");
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      const payload: Record<string, unknown> = {
        account_id: accountId,
        status: enabled ? "active" : "disabled",
        notes: notes ?? null,
      };
      if (enabled) {
        payload.enabled_at = now;
        payload.enabled_by = user?.id ?? null;
        payload.disabled_at = null;
      } else {
        payload.disabled_at = now;
      }

      const { error } = await supabase
        .from("clm_entitlements")
        .upsert(payload, { onConflict: "account_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clm-entitlement", accountId] });
      queryClient.invalidateQueries({ queryKey: ["clm-entitlement"] });
    },
  });

  return { entitlement, isLoading, toggleMutation };
};
