import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch recent failed security events for a user.
 */
export async function fetchFailedSecurityEvents(
  userId: string,
  since: string
) {
  const { data, error } = await supabase
    .from("security_events")
    .select("*")
    .eq("user_id", userId)
    .eq("success", false)
    .gte("created_at", since);

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch recent user sessions.
 */
export async function fetchRecentSessions(userId: string, since: string) {
  const { data, error } = await supabase
    .from("user_sessions")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch audit logs (admin).
 */
export async function fetchAuditLogs(limit = 100) {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch security events (admin).
 */
export async function fetchSecurityEvents(limit = 100) {
  const { data, error } = await supabase
    .from("security_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
