import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];

export interface InvoiceWithDebtor extends InvoiceRow {
  debtors?: { company_name: string } | null;
  ai_workflows?: Array<{ id: string; is_active: boolean }>;
}

export interface InvoiceListItem {
  id: string;
  reference_id: string;
  invoice_number: string;
  amount: number;
  issue_date: string;
  due_date: string;
  payment_terms: string | null;
  status: string;
  last_contact_date: string | null;
  debtor_id: string;
  integration_source: string | null;
  has_local_overrides: boolean | null;
  currency: string | null;
  is_on_payment_plan: boolean | null;
  is_overage: boolean | null;
  debtors?: { company_name: string } | null;
  ai_workflows?: Array<{ id: string; is_active: boolean }>;
}

const PAGE_SIZE = 1000;

/**
 * Fetch all invoices with pagination to handle > 1000 rows.
 * Optionally includes related debtor, workflow, and extra fields.
 */
export async function fetchAllInvoicesPaginated(options?: {
  select?: string;
  includeArchived?: boolean;
  orderBy?: { column: string; ascending: boolean };
}): Promise<InvoiceListItem[]> {
  const select =
    options?.select ??
    "*, debtors(company_name), ai_workflows(id, is_active), integration_source, has_local_overrides, currency";
  const orderColumn = options?.orderBy?.column ?? "due_date";
  const ascending = options?.orderBy?.ascending ?? false;

  const allData: InvoiceListItem[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("invoices")
      .select(select)
      .order(orderColumn, { ascending })
      .range(from, from + PAGE_SIZE - 1);

    if (!options?.includeArchived) {
      query = query.eq("is_archived", false);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    allData.push(...(data as unknown as InvoiceListItem[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allData;
}

/**
 * Fetch a single invoice by ID with full related data.
 */
export async function fetchInvoiceById(invoiceId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, debtors(company_name, name, email)")
    .eq("id", invoiceId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a new invoice.
 */
export async function createInvoice(
  invoiceData: Database["public"]["Tables"]["invoices"]["Insert"]
) {
  const { data, error } = await supabase
    .from("invoices")
    .insert(invoiceData as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete an invoice by ID.
 */
export async function deleteInvoice(invoiceId: string) {
  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", invoiceId);

  if (error) throw error;
}

/**
 * Update an invoice.
 */
export async function updateInvoice(
  invoiceId: string,
  updates: Database["public"]["Tables"]["invoices"]["Update"]
) {
  const { data, error } = await supabase
    .from("invoices")
    .update(updates as any)
    .eq("id", invoiceId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Track invoice usage after creation.
 */
export async function trackInvoiceUsage(invoiceId: string) {
  try {
    await supabase.functions.invoke("track-invoice-usage", {
      body: { invoice_id: invoiceId },
    });
  } catch (error) {
    console.error("Failed to track invoice usage:", error);
    // Non-blocking
  }
}
