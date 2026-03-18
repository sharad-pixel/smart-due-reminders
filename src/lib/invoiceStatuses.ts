/**
 * Shared invoice status colors and labels.
 * Consolidates duplicate getStatusColor functions from InvoiceDetail, Invoices, DebtorDetail, InvoicesList.
 */

/** Invoice status → badge CSS classes (light background style) */
export const INVOICE_STATUS_COLORS: Record<string, string> = {
  Open: 'bg-yellow-100 text-yellow-800',
  Paid: 'bg-green-100 text-green-800',
  Disputed: 'bg-red-100 text-red-800',
  Settled: 'bg-blue-100 text-blue-800',
  InPaymentPlan: 'bg-purple-100 text-purple-800',
  Canceled: 'bg-gray-100 text-gray-800',
  Voided: 'bg-slate-100 text-slate-600',
  PartiallyPaid: 'bg-amber-100 text-amber-800',
  Credited: 'bg-cyan-100 text-cyan-800',
  WrittenOff: 'bg-orange-100 text-orange-800',
  FinalInternalCollections: 'bg-red-100 text-red-800',
};

/** Get the CSS class for a given invoice status string */
export function getInvoiceStatusColor(status: string): string {
  return INVOICE_STATUS_COLORS[status] || 'bg-gray-100 text-gray-800';
}

/** Human-readable labels for invoice statuses */
export const INVOICE_STATUS_LABELS: Record<string, string> = {
  Open: 'Open',
  Paid: 'Paid',
  Disputed: 'Disputed',
  Settled: 'Settled',
  InPaymentPlan: 'In Payment Plan',
  Canceled: 'Canceled',
  Voided: 'Voided',
  PartiallyPaid: 'Partially Paid',
  Credited: 'Credited',
  WrittenOff: 'Written Off',
  FinalInternalCollections: 'Final Collections',
};

/** Get human-readable label for an invoice status */
export function getInvoiceStatusLabel(status: string): string {
  return INVOICE_STATUS_LABELS[status] || status;
}

/** Statuses considered "open" / active */
export const OPEN_INVOICE_STATUSES = ['Open', 'InPaymentPlan', 'PartiallyPaid'];

/** Statuses considered terminal / settled */
export const TERMINAL_INVOICE_STATUSES = ['Paid', 'Canceled', 'Voided', 'WrittenOff', 'Credited', 'Settled'];
