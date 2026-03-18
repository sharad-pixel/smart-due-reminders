import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch outreach logs for a specific debtor.
 */
export async function fetchOutreachLogsByDebtor(debtorId: string) {
  const { data, error } = await supabase
    .from("outreach_logs")
    .select("*")
    .eq("debtor_id", debtorId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch outreach logs for a specific invoice.
 */
export async function fetchOutreachLogsByInvoice(invoiceId: string) {
  const { data, error } = await supabase
    .from("outreach_logs")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
