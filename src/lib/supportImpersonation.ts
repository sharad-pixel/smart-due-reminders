// Support-team impersonation helpers.
// Lets a Recouply admin "open" a customer workspace when a valid
// support_access_grant is active for that account.
// The actual security gate lives in RLS via has_active_support_access().
// This module only mirrors that intent on the client so UI/data hooks
// resolve the correct effective account.

import { supabase } from "@/integrations/supabase/client";

const KEY = "recouply.support_impersonation_account_id";

export const getImpersonatedAccountId = (): string | null => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const setImpersonatedAccountId = (accountId: string | null) => {
  try {
    if (accountId) sessionStorage.setItem(KEY, accountId);
    else sessionStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent("support-impersonation-change"));
  } catch {
    /* ignore */
  }
};

/**
 * Validates that the current user is a Recouply admin and that there is
 * an active, non-revoked support grant for the target account.
 * Returns the accountId if valid, otherwise null (and clears the flag).
 */
export const validateImpersonation = async (): Promise<string | null> => {
  const accountId = getImpersonatedAccountId();
  if (!accountId) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    setImpersonatedAccountId(null);
    return null;
  }

  const { data: isAdmin } = await supabase.rpc("is_recouply_admin", { p_user_id: user.id });
  if (!isAdmin) {
    setImpersonatedAccountId(null);
    return null;
  }

  const { data: grant } = await supabase
    .from("support_access_grants")
    .select("id")
    .eq("account_id", accountId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();

  if (!grant) {
    setImpersonatedAccountId(null);
    return null;
  }
  return accountId;
};
