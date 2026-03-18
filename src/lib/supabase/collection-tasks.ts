import { supabase } from "@/integrations/supabase/client";

export interface TaskFilters {
  debtor_id?: string;
  invoice_id?: string;
  status?: string;
  priority?: string;
  task_type?: string;
}

/**
 * Fetch collection tasks with optional filters.
 */
export async function fetchCollectionTasks(filters: TaskFilters = {}) {
  let query = supabase
    .from("collection_tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters.debtor_id) query = query.eq("debtor_id", filters.debtor_id);
  if (filters.invoice_id) query = query.eq("invoice_id", filters.invoice_id);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.task_type) query = query.eq("task_type", filters.task_type);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Update a collection task's status.
 */
export async function updateCollectionTaskStatus(
  taskId: string,
  status: string
) {
  const updates: Record<string, any> = { status };
  if (status === "done") {
    updates.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("collection_tasks")
    .update(updates)
    .eq("id", taskId);

  if (error) throw error;
}

/**
 * Update a collection task with arbitrary fields.
 */
export async function updateCollectionTask(
  taskId: string,
  updates: Record<string, any>
) {
  const { error } = await supabase
    .from("collection_tasks")
    .update(updates)
    .eq("id", taskId);

  if (error) throw error;
}

/**
 * Archive a collection task.
 */
export async function archiveCollectionTask(taskId: string) {
  const { error } = await supabase
    .from("collection_tasks")
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) throw error;
}

/**
 * Unarchive a collection task.
 */
export async function unarchiveCollectionTask(taskId: string) {
  const { error } = await supabase
    .from("collection_tasks")
    .update({
      is_archived: false,
      archived_at: null,
    })
    .eq("id", taskId);

  if (error) throw error;
}
