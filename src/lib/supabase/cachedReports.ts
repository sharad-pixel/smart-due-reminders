import { supabase } from "@/integrations/supabase/client";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedReport<T = any> {
  data: T;
  generated_at: string;
  is_stale: boolean;
  last_manual_refresh_at: string | null;
}

/**
 * Fetch a cached report from the database.
 * Returns null if no cache exists.
 */
export async function getCachedReport<T = any>(
  reportType: string
): Promise<CachedReport<T> | null> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: _eff } = user
    ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
    : { data: null };
  const accountId = (_eff as string | null) || user?.id;
  if (!user) return null;

  const { data, error } = await supabase
    .from("cached_reports")
    .select("report_data, generated_at, last_manual_refresh_at")
    .eq("user_id", accountId)
    .eq("report_type", reportType)
    .maybeSingle();

  if (error || !data) return null;

  const generatedAt = new Date(data.generated_at).getTime();
  const isStale = Date.now() - generatedAt > CACHE_TTL_MS;

  return {
    data: data.report_data as T,
    generated_at: data.generated_at,
    is_stale: isStale,
    last_manual_refresh_at: data.last_manual_refresh_at,
  };
}

/**
 * Upsert a cached report into the database.
 */
export async function setCachedReport(
  reportType: string,
  reportData: any
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: _eff } = user
    ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
    : { data: null };
  const accountId = (_eff as string | null) || user?.id;
  if (!user) return;

  await supabase
    .from("cached_reports")
    .upsert(
      {
        user_id: accountId,
        report_type: reportType,
        report_data: reportData,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,report_type" }
    );
}

/**
 * Check if the user can manually refresh a report today.
 * Returns true if no manual refresh has been done today (UTC).
 */
export function canManualRefreshToday(lastManualRefreshAt: string | null): boolean {
  if (!lastManualRefreshAt) return true;
  const lastRefresh = new Date(lastManualRefreshAt);
  const now = new Date();
  // Compare UTC dates
  return lastRefresh.toISOString().slice(0, 10) !== now.toISOString().slice(0, 10);
}

/**
 * Mark a manual refresh as used for today.
 */
export async function markManualRefresh(reportType: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: _eff } = user
    ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
    : { data: null };
  const accountId = (_eff as string | null) || user?.id;
  if (!user) return;

  await supabase
    .from("cached_reports")
    .update({ last_manual_refresh_at: new Date().toISOString() })
    .eq("user_id", accountId)
    .eq("report_type", reportType);
}
