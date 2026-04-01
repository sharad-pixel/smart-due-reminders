import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type _DraftRow = Database["public"]["Tables"]["ai_drafts"]["Row"];

export type DraftStatus = Database["public"]["Enums"]["draft_status"];

/**
 * Bulk approve drafts by ID.
 */
export async function bulkApproveDrafts(draftIds: string[]) {
  const { error } = await supabase
    .from("ai_drafts")
    .update({ status: "approved" as DraftStatus })
    .in("id", draftIds);

  if (error) throw error;
}

/**
 * Bulk delete drafts by ID.
 */
export async function bulkDeleteDrafts(draftIds: string[]) {
  const { error } = await supabase
    .from("ai_drafts")
    .delete()
    .in("id", draftIds);

  if (error) throw error;
}

/**
 * Create a new AI draft.
 */
export async function createDraft(
  draftData: Database["public"]["Tables"]["ai_drafts"]["Insert"]
) {
  const { data, error } = await supabase
    .from("ai_drafts")
    .insert(draftData as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a draft's status.
 */
export async function updateDraftStatus(draftId: string, status: string) {
  const { error } = await supabase
    .from("ai_drafts")
    .update({ status: status as DraftStatus })
    .eq("id", draftId);

  if (error) throw error;
}
