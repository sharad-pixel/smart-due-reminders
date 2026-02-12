import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PaymentWithLinks {
  id: string;
  amount: number;
  payment_date: string;
  currency: string | null;
  reference: string | null;
  reference_id: string | null;
  notes: string | null;
  reconciliation_status: string | null;
  invoice_number_hint: string | null;
  data_center_upload_id: string | null;
  created_at: string;
  debtor_id: string | null;
  debtors?: { id: string; name: string; company_name: string | null; reference_id: string | null } | null;
  payment_invoice_links?: {
    id: string;
    invoice_id: string;
    amount_applied: number;
    match_confidence: number | null;
    match_method: string;
    status: string | null;
    invoices?: {
      id: string;
      invoice_number: string | null;
      amount: number;
      amount_outstanding: number;
      status: string;
      reference_id: string | null;
    };
  }[];
}

export interface PaymentReconciliationFilters {
  status?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
  uploadId?: string;
}

export const usePaymentReconciliation = (
  filters: PaymentReconciliationFilters = {},
  page = 1,
  pageSize = 25
) => {
  return useQuery({
    queryKey: ["payment-reconciliation", filters, page, pageSize],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: effectiveAccountId } = await supabase.rpc("get_effective_account_id", { p_user_id: user.id });
      const accountId = effectiveAccountId || user.id;

      let query = supabase
        .from("payments")
        .select(`
          *,
          debtors ( id, name, company_name, reference_id ),
          payment_invoice_links (
            id, invoice_id, amount_applied, match_confidence, match_method, status,
            invoices ( id, invoice_number, amount, amount_outstanding, status, reference_id )
          )
        `, { count: "exact" })
        .eq("user_id", accountId)
        .order("payment_date", { ascending: false });

      if (filters.status && filters.status !== "all") {
        query = query.eq("reconciliation_status", filters.status);
      }
      if (filters.uploadId) {
        query = query.eq("data_center_upload_id", filters.uploadId);
      }
      if (filters.dateFrom) {
        query = query.gte("payment_date", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("payment_date", filters.dateTo);
      }
      if (filters.searchQuery && filters.searchQuery.trim()) {
        const q = filters.searchQuery.trim();

        // Find debtor IDs matching the search by name/company
        const { data: matchingDebtors } = await supabase
          .from("debtors")
          .select("id")
          .eq("user_id", accountId)
          .or(`name.ilike.%${q}%,company_name.ilike.%${q}%`);

        const debtorIds = (matchingDebtors || []).map(d => d.id);

        if (debtorIds.length > 0) {
          query = query.or(
            `reference.ilike.%${q}%,reference_id.ilike.%${q}%,invoice_number_hint.ilike.%${q}%,notes.ilike.%${q}%,debtor_id.in.(${debtorIds.join(",")})`
          );
        } else {
          query = query.or(
            `reference.ilike.%${q}%,reference_id.ilike.%${q}%,invoice_number_hint.ilike.%${q}%,notes.ilike.%${q}%`
          );
        }
      }

      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        payments: (data || []) as PaymentWithLinks[],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
        page,
      };
    },
  });
};

export const useUnmatchPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ linkId, paymentId, invoiceId, amountApplied }: {
      linkId: string;
      paymentId: string;
      invoiceId: string;
      amountApplied: number;
    }) => {
      // Delete the link
      const { error: linkError } = await supabase
        .from("payment_invoice_links")
        .delete()
        .eq("id", linkId);
      if (linkError) throw linkError;

      // Restore invoice outstanding amount
      const { data: invoice } = await supabase
        .from("invoices")
        .select("amount_outstanding, status")
        .eq("id", invoiceId)
        .single();

      if (invoice) {
        const newOutstanding = (invoice.amount_outstanding || 0) + amountApplied;
        await supabase
          .from("invoices")
          .update({
            amount_outstanding: newOutstanding,
            status: "Open",
            payment_date: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoiceId);
      }

      // Update payment reconciliation status
      await supabase
        .from("payments")
        .update({ reconciliation_status: "unmatched" })
        .eq("id", paymentId);

      // Remove the corresponding invoice_transaction
      await supabase
        .from("invoice_transactions")
        .delete()
        .eq("invoice_id", invoiceId)
        .eq("source_system", "manual")
        .eq("payment_method", "data_center_upload")
        .contains("metadata", { payment_id: paymentId });
    },
    onSuccess: () => {
      toast.success("Payment unmatched successfully");
      queryClient.invalidateQueries({ queryKey: ["payment-reconciliation"] });
      queryClient.invalidateQueries({ queryKey: ["payments-activity"] });
      queryClient.invalidateQueries({ queryKey: ["payments-summary"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to unmatch: ${error.message}`);
    },
  });
};

export const useRematchPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ paymentId, oldLinkId, oldInvoiceId, oldAmountApplied, newInvoiceId, amount }: {
      paymentId: string;
      oldLinkId: string;
      oldInvoiceId: string;
      oldAmountApplied: number;
      newInvoiceId: string;
      amount: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Delete old link
      await supabase.from("payment_invoice_links").delete().eq("id", oldLinkId);

      // Restore old invoice
      const { data: oldInvoice } = await supabase
        .from("invoices")
        .select("amount_outstanding")
        .eq("id", oldInvoiceId)
        .single();
      if (oldInvoice) {
        await supabase.from("invoices").update({
          amount_outstanding: (oldInvoice.amount_outstanding || 0) + oldAmountApplied,
          status: "Open",
          payment_date: null,
        }).eq("id", oldInvoiceId);
      }

      // Remove old transaction
      await supabase
        .from("invoice_transactions")
        .delete()
        .eq("invoice_id", oldInvoiceId)
        .eq("source_system", "manual")
        .contains("metadata", { payment_id: paymentId });

      // Create new link
      await supabase.from("payment_invoice_links").insert({
        payment_id: paymentId,
        invoice_id: newInvoiceId,
        amount_applied: amount,
        match_confidence: 1.0,
        match_method: "manual_rematch",
        status: "confirmed",
      });

      // Update new invoice
      const { data: newInvoice } = await supabase
        .from("invoices")
        .select("amount_outstanding, status")
        .eq("id", newInvoiceId)
        .single();
      if (newInvoice) {
        const newOutstanding = Math.max(0, (newInvoice.amount_outstanding || 0) - amount);
        await supabase.from("invoices").update({
          amount_outstanding: newOutstanding,
          status: newOutstanding <= 0 ? "Paid" : "PartiallyPaid",
          payment_date: newOutstanding <= 0 ? new Date().toISOString().split("T")[0] : null,
        }).eq("id", newInvoiceId);
      }

      // Get payment date for transaction
      const { data: payment } = await supabase
        .from("payments")
        .select("payment_date")
        .eq("id", paymentId)
        .single();

      // Create new transaction
      await supabase.from("invoice_transactions").insert({
        user_id: user.id,
        invoice_id: newInvoiceId,
        transaction_type: "payment",
        amount,
        balance_after: newInvoice ? Math.max(0, (newInvoice.amount_outstanding || 0) - amount) : 0,
        transaction_date: payment?.payment_date || new Date().toISOString().split("T")[0],
        source_system: "manual",
        payment_method: "data_center_upload",
        notes: "Rematched via Payments page",
        metadata: { payment_id: paymentId },
      });

      // Update payment status
      await supabase.from("payments").update({ reconciliation_status: "manually_matched" }).eq("id", paymentId);
    },
    onSuccess: () => {
      toast.success("Payment rematched successfully");
      queryClient.invalidateQueries({ queryKey: ["payment-reconciliation"] });
      queryClient.invalidateQueries({ queryKey: ["payments-activity"] });
      queryClient.invalidateQueries({ queryKey: ["payments-summary"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to rematch: ${error.message}`);
    },
  });
};

export const useUpdatePayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ paymentId, amount, paymentDate, reference, notes }: {
      paymentId: string;
      amount?: number;
      paymentDate?: string;
      reference?: string;
      notes?: string;
    }) => {
      const updateData: Record<string, any> = {};
      if (amount !== undefined) updateData.amount = amount;
      if (paymentDate) updateData.payment_date = paymentDate;
      if (reference !== undefined) updateData.reference = reference;
      if (notes !== undefined) updateData.notes = notes;

      const { error } = await supabase.from("payments").update(updateData).eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment updated");
      queryClient.invalidateQueries({ queryKey: ["payment-reconciliation"] });
      queryClient.invalidateQueries({ queryKey: ["payments-activity"] });
      queryClient.invalidateQueries({ queryKey: ["payments-summary"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });
};
