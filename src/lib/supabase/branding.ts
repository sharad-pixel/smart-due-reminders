import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type BrandingRow = Database["public"]["Tables"]["branding_settings"]["Row"];

/**
 * Fetch branding settings for a user.
 */
export async function fetchBrandingByUserId(
  userId: string
): Promise<BrandingRow | null> {
  const { data, error } = await supabase
    .from("branding_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
  return data;
}

/**
 * Update branding settings.
 */
export async function updateBranding(
  brandingId: string,
  updates: Database["public"]["Tables"]["branding_settings"]["Update"]
) {
  const { data, error } = await supabase
    .from("branding_settings")
    .update(updates as any)
    .eq("id", brandingId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
