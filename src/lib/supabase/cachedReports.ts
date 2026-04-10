import { supabase } from "@/integrations/supabase/client";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedReport<T = any> {
  data: T;
  generated_at: string;
  is_stale: boolean;
}

/**
 * Fetch a cached report from the database.
 * Returns null if no cache exists.
 */
export async function getCachedReport<T = any>(
  reportType: string
): Promise<CachedReport<T> | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("cached_reports")
    .select("report_data, generated_at")
    .eq("user_id", user.id)
    .eq("report_type", reportType)
    .maybeSingle();

  if (error || !data) return null;

  const generatedAt = new Date(data.generated_at).getTime();
  const isStale = Date.now() - generatedAt > CACHE_TTL_MS;

  return {
    data: data.report_data as T,
    generated_at: data.generated_at,
    is_stale: isStale,
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
  if (!user) return;

  await supabase
    .from("cached_reports")
    .upsert(
      {
        user_id: user.id,
        report_type: reportType,
        report_data: reportData,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,report_type" }
    );
}
