import { supabase } from "@/integrations/supabase/client";

/**
 * Get the current authenticated user. Throws if not authenticated.
 */
export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Not authenticated");
  return user;
}

/**
 * Get the effective account ID (for team member support).
 */
export async function getEffectiveAccountId(userId: string): Promise<string> {
  const { data } = await supabase.rpc("get_effective_account_id", {
    p_user_id: userId,
  });
  return data || userId;
}

/**
 * Get the user's organization ID.
 */
export async function getUserOrganizationId(
  userId: string
): Promise<string | null> {
  const { data } = await supabase.rpc("get_user_organization_id", {
    p_user_id: userId,
  });
  return data;
}
