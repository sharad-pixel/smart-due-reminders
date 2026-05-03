// Support-team impersonation helpers.
// Lets a Recouply admin "open" a customer workspace when a valid
// support_access_grant is active for that account.
// The actual security gate lives in RLS via has_active_support_access()
// and the SECURITY DEFINER function validate_support_impersonation().
// This module mirrors that intent on the client so UI/data hooks
// resolve the correct effective account, and provides invokeFunction()
// which forwards the impersonation context to edge functions via header.

import { supabase } from "@/integrations/supabase/client";
import type { FunctionInvokeOptions } from "@supabase/supabase-js";

const KEY = "recouply.support_impersonation_account_id";
export const SUPPORT_IMPERSONATION_HEADER = "x-support-impersonate-account";

export const isImpersonating = (): boolean => !!getImpersonatedAccountId();

/**
 * Wrapper around supabase.functions.invoke that automatically forwards
 * the support-impersonation account id as a header. Edge functions that
 * accept impersonation MUST validate the header server-side via
 * validate_support_impersonation() before honoring it.
 */
export async function invokeFunction<T = any>(
  name: string,
  options: FunctionInvokeOptions = {},
): Promise<{ data: T | null; error: any }> {
  const impersonatedId = getImpersonatedAccountId();
  const headers: Record<string, string> = { ...(options.headers as any) };
  if (impersonatedId) headers[SUPPORT_IMPERSONATION_HEADER] = impersonatedId;
  return await supabase.functions.invoke<T>(name, { ...options, headers });
}

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

  const { data: isAdmin } = await supabase.rpc("is_recouply_admin", { _user_id: user.id });
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
