import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { InvoiceTemplateData } from "./InvoiceTemplateBuilder";
import venmoLogo from "@/assets/venmo-logo.png";
import paypalLogo from "@/assets/paypal-logo.png";
import cashappLogo from "@/assets/cashapp-logo.png";

interface SampleInvoice {
  description: string | null;
  invoice_number: string | null;
  reference_id: string | null;
  amount: number | null;
  due_date: string | null;
  issue_date: string | null;
  notes: string | null;
}

interface InvoiceTemplatePreviewProps {
  template: InvoiceTemplateData;
  businessName: string;
  logoUrl: string | null;
  sampleInvoice?: SampleInvoice;
}

export const InvoiceTemplatePreview = ({
  template,
  businessName,
  logoUrl,
  sampleInvoice,
}: InvoiceTemplatePreviewProps) => {
  const fontFamily =
    template.font_style === "classic"
      ? "Georgia, 'Times New Roman', serif"
      : template.font_style === "minimal"
      ? "'Courier New', monospace"
      : "system-ui, -apple-system, sans-serif";

  const hc = template.header_color || "#1a56db";

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  };

  const formatCurrency = (val: number | null | undefined) => {
    if (val == null) return "$730,260.92";
    return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const desc = sampleInvoice?.description || "Annual Service Fee";
  const invNum = sampleInvoice?.invoice_number || "#INV00665";
  const amount = formatCurrency(sampleInvoice?.amount);
  const issueDate = sampleInvoice?.issue_date ? formatDate(sampleInvoice.issue_date) : "04/06/2026";
  const dueDate = sampleInvoice?.due_date ? formatDate(sampleInvoice.due_date) : "05/09/2026";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Eye className="h-4 w-4" />
          Invoice Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center">
        {/* US Letter aspect ratio container: 8.5 x 11 = 0.7727 ratio */}
        <div
          className="border rounded-lg bg-white text-black overflow-hidden shadow-sm flex flex-col"
          style={{
            fontFamily,
            fontSize: "11px",
            lineHeight: 1.5,
            width: "100%",
            maxWidth: "550px",
            aspectRatio: "8.5 / 11",
          }}
        >
          {/* Header */}
          <div className="p-5 pb-3">
            <div className="flex justify-between items-start">
              {/* Left: logo + company info */}
              <div className="space-y-1.5">
                {template.show_logo && logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-9 object-contain mb-1.5"
                    style={{ maxWidth: 140 }}
                  />
                )}
                <div className="font-semibold text-xs" style={{ color: hc }}>
                  {businessName || "Your Company"}
                </div>
                {template.company_address && (
                  <div className="text-[10px] text-gray-600 whitespace-pre-line leading-tight">
                    {template.company_address}
                  </div>
                )}
              </div>
              {/* Right: Invoice title */}
              <div className="text-right">
                <div
                  className="text-xl font-light tracking-wide"
                  style={{ color: hc }}
                >
                  Invoice
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-xs font-semibold mt-1 text-gray-800 cursor-help border-b border-dashed border-gray-300 inline-block">
                        {invNum.startsWith("#") ? invNum : `#${invNum}`}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs space-y-1 max-w-[220px]">
                      <div><span className="font-semibold">SS Invoice #:</span> {sampleInvoice?.invoice_number || "INV00665"}</div>
                      <div><span className="font-semibold">Recouply ID:</span> {sampleInvoice?.reference_id || "RCY-0000-0000"}</div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="mt-1.5 text-[10px] text-gray-600 space-y-0.5">
                  <div>
                    <span className="font-semibold" style={{ color: hc }}>
                      Invoice Date:
                    </span>{" "}
                    {issueDate}
                  </div>
                  <div>
                    <span className="font-semibold" style={{ color: hc }}>
                      Due Date:
                    </span>{" "}
                    {dueDate}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bill To / Amount Due */}
          <div className="px-5 pb-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div
                  className="text-[9px] font-bold uppercase tracking-wider mb-1"
                  style={{ color: hc }}
                >
                  Bill To
                </div>
                <div className="text-[10px] text-gray-700 leading-tight">
                  Customer Company
                  <br />
                  456 Commerce Blvd
                  <br />
                  Suite 200
                  <br />
                  Los Angeles, CA 90001
                </div>
              </div>
              <div className="flex items-start justify-end">
                <div
                  className="rounded-md p-2.5 text-center"
                  style={{ backgroundColor: `${hc}10` }}
                >
                  <div
                    className="text-[9px] font-bold uppercase tracking-wider"
                    style={{ color: hc }}
                  >
                    Amount Due
                  </div>
                  <div
                    className="text-lg font-bold mt-0.5"
                    style={{ color: hc }}
                  >
                    $730,260.92
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Terms row */}
          <div className="mx-5">
            <div
              className="grid text-[9px] font-bold uppercase tracking-wider text-white px-2.5 py-1 rounded-t"
              style={{
                backgroundColor: hc,
                gridTemplateColumns: template.show_po_number && template.show_sales_rep
                  ? "1fr 1fr 1fr 1fr"
                  : template.show_po_number || template.show_sales_rep
                  ? "1fr 1fr 1fr"
                  : "1fr 1fr",
              }}
            >
              <span>Terms</span>
              <span>Due Date</span>
              {template.show_po_number && <span>PO #</span>}
              {template.show_sales_rep && <span>Sales Rep</span>}
            </div>
            <div
              className="grid text-[10px] px-2.5 py-1.5 border-x border-b rounded-b text-gray-700"
              style={{
                gridTemplateColumns: template.show_po_number && template.show_sales_rep
                  ? "1fr 1fr 1fr 1fr"
                  : template.show_po_number || template.show_sales_rep
                  ? "1fr 1fr 1fr"
                  : "1fr 1fr",
              }}
            >
              <span>Net 30</span>
              <span>{dueDate}</span>
              {template.show_po_number && (
                <span className="text-gray-400">—</span>
              )}
              {template.show_sales_rep && (
                <span className="text-gray-400">—</span>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="mx-5 mt-2.5">
            <div
              className="grid grid-cols-4 text-[9px] font-bold uppercase tracking-wider text-white px-2.5 py-1 rounded-t"
              style={{ backgroundColor: hc }}
            >
              <span>Description</span>
              <span className="text-center">Start Date</span>
              <span className="text-center">End Date</span>
              <span className="text-right">Amount</span>
            </div>
            <div className="border-x border-b rounded-b divide-y">
              <div className="grid grid-cols-4 text-[10px] px-2.5 py-1.5 text-gray-700">
                <span>{desc}</span>
                <span className="text-center">{issueDate}</span>
                <span className="text-center">{dueDate}</span>
                <span className="text-right">{amount}</span>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="px-5 mt-2.5">
            <div className="flex justify-end">
              <div className="w-44 text-[10px] space-y-0.5">
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-600">Subtotal</span>
                  <span>{amount}</span>
                </div>
                {template.show_tax && (
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-600">Tax (%)</span>
                    <span>$0.00</span>
                  </div>
                )}
                <div
                  className="flex justify-between font-bold pt-1 border-t"
                  style={{ color: hc }}
                >
                  <span>Total</span>
                  <span>{amount}</span>
                </div>
                <div className="flex justify-between font-semibold text-gray-600">
                  <span>Amount Due</span>
                  <span>{amount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {template.show_notes && sampleInvoice?.notes && (
            <div className="px-5 mt-2.5">
              <div
                className="text-[9px] font-bold uppercase tracking-wider mb-0.5"
                style={{ color: hc }}
              >
                Notes
              </div>
              <p className="text-[10px] text-gray-600 whitespace-pre-line">
                {sampleInvoice.notes}
              </p>
            </div>
          )}

          {/* Footer note */}
          {template.footer_note && (
            <div className="px-5 mt-3">
              <p className="text-[10px] text-gray-500 italic">
                {template.footer_note}
              </p>
            </div>
          )}

          {/* Payment QR Codes */}
          {template.show_payment_qr_codes && (
            (() => {
              const LOGOS: Record<string, string> = {
                Venmo: venmoLogo,
                PayPal: paypalLogo,
                "Cash App": cashappLogo,
              };
              const qrCodes = [
                { url: template.qr_code_venmo_url, label: "Venmo" },
                { url: template.qr_code_paypal_url, label: "PayPal" },
                { url: template.qr_code_cashapp_url, label: "Cash App" },
              ].filter((q) => q.url);
              if (qrCodes.length === 0) return null;
              return (
                <div className="px-5 mt-2.5">
                  <div className="border-t pt-2.5">
                    <div
                      className="text-[9px] font-bold uppercase tracking-wider mb-1.5"
                      style={{ color: hc }}
                    >
                      Scan to Pay
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      {qrCodes.map((q) => (
                        <div key={q.label} className="text-center">
                          <img
                            src={q.url}
                            alt={`${q.label} QR Code`}
                            className="h-14 w-14 object-contain border rounded"
                          />
                          <div className="flex items-center justify-center gap-1 mt-0.5">
                            {LOGOS[q.label] && (
                              <img
                                src={LOGOS[q.label]}
                                alt=""
                                className="h-2.5 w-2.5 object-contain"
                              />
                            )}
                            <span className="text-[8px] text-gray-500">
                              {q.label}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()
          )}

          {/* Payment Instructions */}
          {template.show_payment_instructions &&
            (template.payment_instructions_wire ||
              template.payment_instructions_check) && (
              <div className="px-5 mt-2.5">
                <div className="border-t pt-2.5">
                  {template.payment_instructions_wire && (
                    <div className="mb-1.5">
                      <div
                        className="text-[9px] font-bold uppercase tracking-wider mb-0.5"
                        style={{ color: hc }}
                      >
                        Wire / ACH Payment
                      </div>
                      <div className="text-[10px] text-gray-600 whitespace-pre-line">
                        {template.payment_instructions_wire}
                      </div>
                    </div>
                  )}
                  {template.payment_instructions_check && (
                    <div>
                      <div
                        className="text-[9px] font-bold uppercase tracking-wider mb-0.5"
                        style={{ color: hc }}
                      >
                        Check Payment
                      </div>
                      <div className="text-[10px] text-gray-600 whitespace-pre-line">
                        {template.payment_instructions_check}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Spacer to push portal + footer to bottom */}
          <div className="flex-1" />

          {/* Payment Portal Link - Always shown */}
          <div className="px-5 pb-3">
            <div className="border-t pt-3">
              <div
                className="rounded-md p-3 text-center"
                style={{ backgroundColor: `${hc}08`, border: `1px solid ${hc}25` }}
              >
                <div className="text-[10px] font-semibold text-gray-700 mb-1">
                  View & Pay Your Invoice Online
                </div>
                <a
                  href="https://recouply.ai/debtor-portal"
                  className="text-[10px] font-bold underline"
                  style={{ color: hc }}
                >
                  https://recouply.ai/debtor-portal
                </a>
                <div className="text-[8px] text-gray-500 mt-1">
                  Use the email address associated with this invoice to access your payment portal.
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className="h-1.5 shrink-0"
            style={{ backgroundColor: hc }}
          />
        </div>
      </CardContent>
    </Card>
  );
};
