import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the *effective* account ID the current user is operating under.
 *
 * - For account owners → returns their own user id.
 * - For team members → returns the parent account owner's user id.
 *
 * All workspace data (debtors, invoices, workflows, branding, drafts,
 * tasks, payments, etc.) is stored under the owner's `user_id`. Team
 * members must query/insert against the owner's id so they see the same
 * workspace as the owner. RLS (`can_access_account_data` /
 * `can_write_as_account`) enforces what they're permitted to do.
 *
 * Use this in place of `auth.user.id` whenever filtering or writing
 * workspace-scoped rows.
 */
export const useAccountId = () => {
  const query = useQuery({
    queryKey: ["effective-account-id"],
    queryFn: async (): Promise<{ accountId: string | null; userId: string | null; isTeamMember: boolean }> => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return { accountId: null, userId: null, isTeamMember: false };

      const { data: effective } = await supabase.rpc("get_effective_account_id", {
        p_user_id: user.id,
      });
      const accountId = (effective as string | null) || user.id;
      return {
        accountId,
        userId: user.id,
        isTeamMember: accountId !== user.id,
      };
    },
    staleTime: 1000 * 60 * 10,
  });

  return {
    accountId: query.data?.accountId ?? null,
    userId: query.data?.userId ?? null,
    isTeamMember: query.data?.isTeamMember ?? false,
    isLoading: query.isLoading,
  };
};

/**
 * Imperative variant for non-React contexts (utils, edge function callers).
 * Returns the effective account id (owner's user id) for the current session.
 */
export async function getEffectiveAccountId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;
  const { data } = await supabase.rpc("get_effective_account_id", {
    p_user_id: user.id,
  });
  return (data as string | null) || user.id;
}
