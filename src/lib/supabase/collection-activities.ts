import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ActivityRow = Database["public"]["Tables"]["collection_activities"]["Row"];

export interface ActivityFilters {
  debtor_id?: string;
  invoice_id?: string;
  direction?: string;
  limit?: number;
}

/**
 * Fetch collection activities with optional filters.
 */
export async function fetchCollectionActivities(
  filters: ActivityFilters = {}
): Promise<ActivityRow[]> {
  let query = supabase
    .from("collection_activities")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters.debtor_id) {
    query = query.eq("debtor_id", filters.debtor_id);
  }
  if (filters.invoice_id) {
    query = query.eq("invoice_id", filters.invoice_id);
  }
  if (filters.direction) {
    query = query.eq("direction", filters.direction);
  }
  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Insert a collection activity record.
 */
export async function insertCollectionActivity(
  activity: Database["public"]["Tables"]["collection_activities"]["Insert"]
) {
  const { data, error } = await supabase
    .from("collection_activities")
    .insert(activity as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}
