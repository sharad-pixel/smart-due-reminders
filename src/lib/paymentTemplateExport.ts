import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

/**
 * Export a pre-populated payment reconciliation template.
 * Rows are at line-item level (or invoice level if no line items exist).
 * Users fill in: Payment Amount, Payment Reference, Payment Date.
 */
export async function exportPaymentTemplate() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Fetch open/partially-paid invoices with debtor info
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, amount_outstanding, currency, due_date, status, reference_id, integration_source, debtors(company_name, reference_id)")
    .eq("user_id", user.id)
    .in("status", ["Open", "PartiallyPaid", "InPaymentPlan", "Disputed"])
    .order("due_date", { ascending: true });

  if (error) throw error;
  if (!invoices || invoices.length === 0) throw new Error("No open invoices to generate payment template");

  // Fetch line items for all invoices
  const invoiceIds = invoices.map(i => i.id);
  const lineItemsByInvoice = new Map<string, any[]>();

  for (let i = 0; i < invoiceIds.length; i += 100) {
    const chunk = invoiceIds.slice(i, i + 100);
    const { data: items } = await supabase
      .from("invoice_line_items")
      .select("id, invoice_id, description, quantity, unit_price, line_total, sort_order, line_type")
      .in("invoice_id", chunk)
      .order("sort_order", { ascending: true });
    for (const item of (items || [])) {
      if (!lineItemsByInvoice.has(item.invoice_id)) lineItemsByInvoice.set(item.invoice_id, []);
      lineItemsByInvoice.get(item.invoice_id)!.push(item);
    }
  }

  // Pre-populated (read-only) + user-input headers
  const headers = [
    "Account RAID",           // 0
    "Account Name",           // 1
    "SS Invoice #",           // 2
    "Recouply Invoice Ref",   // 3 (DO NOT EDIT)
    "Line #",                 // 4
    "Line Type",              // 5
    "Line Description",       // 6
    "Line Amount",            // 7
    "Invoice Total Outstanding", // 8
    "Currency",               // 9
    // --- User fills these ---
    "Payment Amount",         // 10
    "Payment Reference",      // 11
    "Payment Date",           // 12
  ];

  const rows: any[][] = [];

  for (const inv of invoices) {
    const items = lineItemsByInvoice.get(inv.id);
    const baseRow = [
      inv.debtors?.reference_id || "",
      inv.debtors?.company_name || "",
      inv.invoice_number || "",
      inv.reference_id || "",
    ];

    if (items && items.length > 0) {
      for (let idx = 0; idx < items.length; idx++) {
        const li = items[idx];
        rows.push([
          ...baseRow,
          idx + 1,
          li.line_type || "item",
          li.description || "",
          li.line_total || 0,
          inv.amount_outstanding || inv.amount || 0,
          inv.currency || "USD",
          "", "", "", // empty payment columns for user to fill
        ]);
      }
    } else {
      // No line items — single invoice-level row
      rows.push([
        ...baseRow,
        "",  // no line #
        "",  // no line type
        "",  // no description
        inv.amount_outstanding || inv.amount || 0,
        inv.amount_outstanding || inv.amount || 0,
        inv.currency || "USD",
        "", "", "",
      ]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set column widths for readability
  ws["!cols"] = [
    { wch: 14 }, { wch: 24 }, { wch: 18 }, { wch: 22 },
    { wch: 7 }, { wch: 8 }, { wch: 30 }, { wch: 14 },
    { wch: 22 }, { wch: 10 },
    { wch: 16 }, { wch: 20 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Payment Template");
  XLSX.writeFile(wb, `payment_template_${new Date().toISOString().split("T")[0]}.csv`, { bookType: "csv" });
}

/**
 * Import a filled payment template CSV and reconcile payments.
 * Only rows with a Payment Amount are processed.
 */
export async function importPaymentTemplate(file: File): Promise<{ created: number; skipped: number; errors: string[] }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  if (rawRows.length < 2) throw new Error("File is empty or has no data rows");

  const headers = rawRows[0].map((h: any) => String(h).toLowerCase().trim());
  const col = {
    accountRaid: headers.findIndex(h => h.includes("account raid")),
    ssInvoice: headers.findIndex(h => h.includes("ss invoice")),
    recouplyRef: headers.findIndex(h => h.includes("recouply invoice ref")),
    lineNum: headers.findIndex(h => h === "line #"),
    lineType: headers.findIndex(h => h === "line type"),
    paymentAmount: headers.findIndex(h => h.includes("payment amount")),
    paymentRef: headers.findIndex(h => h.includes("payment reference")),
    paymentDate: headers.findIndex(h => h.includes("payment date")),
    currency: headers.findIndex(h => h === "currency"),
  };

  if (col.paymentAmount < 0) throw new Error("Missing 'Payment Amount' column");

  const getVal = (row: any[], idx: number) => idx >= 0 && idx < row.length ? String(row[idx] || "").trim() : "";

  // Pre-load user's invoices for matching
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, reference_id, debtor_id, amount_outstanding, amount, status")
    .eq("user_id", user.id);

  const invByRef = new Map<string, any>();
  const invByNum = new Map<string, any>();
  for (const inv of (invoices || [])) {
    if (inv.reference_id) invByRef.set(inv.reference_id.toLowerCase(), inv);
    if (inv.invoice_number) invByNum.set(inv.invoice_number.toLowerCase(), inv);
  }

  // Get org ID
  const { data: orgId } = await supabase.rpc("get_user_organization_id", { p_user_id: user.id });

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Group rows by invoice to aggregate line-level payments
  const paymentsByInvoice = new Map<string, { amount: number; reference: string; date: string; currency: string; invoice: any }>();

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    const payAmtStr = getVal(row, col.paymentAmount);
    if (!payAmtStr) continue;

    const payAmt = parseFloat(payAmtStr);
    if (isNaN(payAmt) || payAmt <= 0) { skipped++; continue; }

    // Match invoice
    const recouplyRef = getVal(row, col.recouplyRef);
    const ssInvoice = getVal(row, col.ssInvoice);
    let invoice = recouplyRef ? invByRef.get(recouplyRef.toLowerCase()) : null;
    if (!invoice && ssInvoice) invoice = invByNum.get(ssInvoice.toLowerCase());

    if (!invoice) {
      errors.push(`Row ${i + 1}: Cannot match invoice (SS# "${ssInvoice}", Ref "${recouplyRef}")`);
      continue;
    }

    const key = invoice.id;
    const existing = paymentsByInvoice.get(key);
    const payRef = getVal(row, col.paymentRef);
    const payDate = getVal(row, col.paymentDate);
    const currency = getVal(row, col.currency) || "USD";

    if (existing) {
      existing.amount += payAmt;
      if (payRef && !existing.reference) existing.reference = payRef;
      if (payDate && !existing.date) existing.date = payDate;
    } else {
      paymentsByInvoice.set(key, { amount: payAmt, reference: payRef, date: payDate, currency, invoice });
    }
  }

  // Insert aggregated payments and reconcile
  for (const [, entry] of paymentsByInvoice) {
    const { amount, reference, date, currency, invoice } = entry;
    const parsedDate = parsePaymentDate(date);

    const { error: insertErr } = await supabase.from("payments").insert({
      user_id: user.id,
      organization_id: orgId,
      debtor_id: invoice.debtor_id,
      invoice_id: invoice.id,
      amount,
      currency: currency.toUpperCase(),
      payment_date: parsedDate || new Date().toISOString().split("T")[0],
      reference: reference || null,
      invoice_number_hint: invoice.invoice_number,
      reconciliation_status: "reconciled",
      notes: "[CSV Payment Import]",
      source_system: "csv_import",
    });

    if (insertErr) {
      errors.push(`Invoice ${invoice.invoice_number}: ${insertErr.message}`);
      continue;
    }

    // Reconcile invoice
    const newOutstanding = Math.max(0, (invoice.amount_outstanding || invoice.amount) - amount);
    const newStatus = newOutstanding === 0 ? "Paid" : "PartiallyPaid";
    await supabase.from("invoices").update({
      amount_outstanding: newOutstanding,
      status: newStatus,
      ...(newOutstanding === 0 ? { paid_date: parsedDate || new Date().toISOString().split("T")[0] } : {}),
    }).eq("id", invoice.id);

    created++;
  }

  return { created, skipped, errors };
}

function parsePaymentDate(val: string): string | null {
  if (!val) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return val.trim();
  const mdyMatch = val.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) return `${mdyMatch[3]}-${mdyMatch[1].padStart(2, "0")}-${mdyMatch[2].padStart(2, "0")}`;
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}
