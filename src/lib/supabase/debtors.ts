import { supabase } from "@/integrations/supabase/client";

export interface DebtorListItem {
  id: string;
  company_name: string;
}

/**
 * Fetch all debtors as a compact list (id + company_name).
 */
export async function fetchDebtorsList(): Promise<DebtorListItem[]> {
  const { data, error } = await supabase
    .from("debtors")
    .select("id, company_name")
    .order("company_name");

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch a single debtor by ID with full details.
 */
export async function fetchDebtorById(debtorId: string) {
  const { data, error } = await supabase
    .from("debtors")
    .select("*")
    .eq("id", debtorId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a debtor record.
 */
export async function updateDebtor(
  debtorId: string,
  updates: Record<string, any>
) {
  const { data, error } = await supabase
    .from("debtors")
    .update(updates)
    .eq("id", debtorId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch debtor intelligence report (cached from debtors table).
 */
export async function fetchDebtorIntelligenceReport(debtorId: string) {
  const { data, error } = await supabase
    .from("debtors")
    .select("intelligence_report, intelligence_report_generated_at")
    .eq("id", debtorId)
    .single();

  if (error) throw error;
  return data;
}
