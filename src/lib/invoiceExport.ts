import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

export async function exportInvoicesAsCSV() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: _eff } = user
    ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
    : { data: null };
  const accountId = (_eff as string | null) || user?.id;
  if (!user) throw new Error("Not authenticated");

  // Fetch invoices with debtor info
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, amount_original, amount_outstanding, currency, issue_date, due_date, status, po_number, product_description, payment_terms, notes, reference_id, debtors(company_name, reference_id)")
    .eq("user_id", accountId)
    .order("due_date", { ascending: false });

  if (error) throw error;

  // Fetch line items for all invoices
  const invoiceIds = (invoices || []).map(i => i.id);
  let allLineItems: any[] = [];
  
  if (invoiceIds.length > 0) {
    // Fetch in chunks to avoid query limits
    for (let i = 0; i < invoiceIds.length; i += 100) {
      const chunk = invoiceIds.slice(i, i + 100);
      const { data: items } = await supabase
        .from("invoice_line_items")
        .select("invoice_id, description, quantity, unit_price, line_total, sort_order, line_type")
        .in("invoice_id", chunk)
        .order("sort_order", { ascending: true });
      if (items) allLineItems.push(...items);
    }
  }

  // Group line items by invoice_id
  const lineItemsByInvoice = new Map<string, any[]>();
  for (const item of allLineItems) {
    if (!lineItemsByInvoice.has(item.invoice_id)) {
      lineItemsByInvoice.set(item.invoice_id, []);
    }
    lineItemsByInvoice.get(item.invoice_id)!.push(item);
  }

  // Build flattened rows
  const headers = [
    "Account RAID", "Account Name", "SS Invoice #", "Original Amount", "Amount Outstanding",
    "Currency", "Issue Date", "Due Date", "Status", "PO Number", "Product/Description",
    "Payment Terms", "Notes", "Recouply Invoice Ref",
    "Line #", "Line Type", "Line Description", "Line Qty", "Line Unit Price", "Line Total"
  ];

  const rows: any[][] = [];

  for (const inv of (invoices || [])) {
    const baseRow = [
      inv.debtors?.reference_id || "",
      inv.debtors?.company_name || "",
      inv.invoice_number || "",
      inv.amount_original || inv.amount || 0,
      inv.amount_outstanding || inv.amount || 0,
      inv.currency || "USD",
      inv.issue_date || "",
      inv.due_date || "",
      inv.status || "",
      inv.po_number || "",
      inv.product_description || "",
      inv.payment_terms || "",
      inv.notes || "",
      inv.reference_id || "",
    ];

    const items = lineItemsByInvoice.get(inv.id);
    if (items && items.length > 0) {
      for (let idx = 0; idx < items.length; idx++) {
        const li = items[idx];
        rows.push([
          ...baseRow,
          idx + 1,
          li.line_type || "item",
          li.description || "",
          li.quantity || 0,
          li.unit_price || 0,
          li.line_total || 0,
        ]);
      }
    } else {
      // No line items - single row with empty line item columns
      rows.push([...baseRow, "", "", "", "", "", ""]);
    }
  }

  // Create workbook and download
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Invoices");
  XLSX.writeFile(wb, `invoices_export_${new Date().toISOString().split("T")[0]}.csv`, { bookType: "csv" });
}
