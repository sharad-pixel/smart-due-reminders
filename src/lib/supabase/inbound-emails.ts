import { supabase } from "@/integrations/supabase/client";

export interface InboundEmailFilters {
  status?: string;
  action_type?: string;
  debtor_name?: string;
  debtor_status?: "all" | "active" | "archived";
  search?: string;
  start_date?: string;
  end_date?: string;
  hide_processed?: boolean;
  hide_closed?: boolean;
  action_status?: string;
  ai_category?: string;
  ai_priority?: string;
  is_archived?: boolean;
}

/**
 * Fetch inbound emails with filters applied at the DB level where possible.
 */
export async function fetchInboundEmails(filters: InboundEmailFilters = {}) {
  let query = supabase
    .from("inbound_emails")
    .select(`
      *,
      debtors (name, company_name, email, is_active, is_archived),
      invoices (invoice_number, amount, due_date, status)
    `)
    .order("created_at", { ascending: false });

  if (filters.is_archived !== undefined) {
    query = query.eq("is_archived", filters.is_archived);
  }
  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.hide_processed) {
    query = query.neq("status", "processed");
  }
  if (filters.hide_closed) {
    query = query.neq("action_status", "closed");
  }
  if (filters.action_status && filters.action_status !== "all") {
    query = query.eq("action_status", filters.action_status);
  }
  if (filters.ai_category && filters.ai_category !== "all") {
    query = query.eq("ai_category", filters.ai_category);
  }
  if (filters.ai_priority && filters.ai_priority !== "all") {
    query = query.eq("ai_priority", filters.ai_priority);
  }
  if (filters.search) {
    query = query.or(
      `subject.ilike.%${filters.search}%,from_email.ilike.%${filters.search}%,text_body.ilike.%${filters.search}%`
    );
  }
  if (filters.start_date) {
    query = query.gte("created_at", filters.start_date);
  }
  if (filters.end_date) {
    query = query.lte("created_at", filters.end_date);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Update an inbound email's status.
 */
export async function updateInboundEmailStatus(
  emailId: string,
  status: string
) {
  const { error } = await supabase
    .from("inbound_emails")
    .update({ status })
    .eq("id", emailId);

  if (error) throw error;
}

/**
 * Update action status on an inbound email.
 */
export async function updateInboundEmailActionStatus(
  emailId: string,
  actionStatus: string,
  notes?: string
) {
  const updates: Record<string, any> = { action_status: actionStatus };
  if (actionStatus === "closed") {
    updates.action_closed_at = new Date().toISOString();
  }
  if (notes) {
    updates.action_notes = notes;
  }

  const { error } = await supabase
    .from("inbound_emails")
    .update(updates)
    .eq("id", emailId);

  if (error) throw error;
}

/**
 * Archive an inbound email.
 */
export async function archiveInboundEmail(emailId: string, reason?: string) {
  const { error } = await supabase
    .from("inbound_emails")
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      archived_reason: reason || "Manual archive",
    })
    .eq("id", emailId);

  if (error) throw error;
}

/**
 * Unarchive an inbound email.
 */
export async function unarchiveInboundEmail(emailId: string) {
  const { error } = await supabase
    .from("inbound_emails")
    .update({
      is_archived: false,
      archived_at: null,
      archived_reason: null,
    })
    .eq("id", emailId);

  if (error) throw error;
}
