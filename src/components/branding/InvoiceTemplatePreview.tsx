import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye } from "lucide-react";
import type { InvoiceTemplateData } from "./InvoiceTemplateBuilder";

interface InvoiceTemplatePreviewProps {
  template: InvoiceTemplateData;
  businessName: string;
  logoUrl: string | null;
}

export const InvoiceTemplatePreview = ({
  template,
  businessName,
  logoUrl,
}: InvoiceTemplatePreviewProps) => {
  const fontFamily =
    template.font_style === "classic"
      ? "Georgia, 'Times New Roman', serif"
      : template.font_style === "minimal"
      ? "'Courier New', monospace"
      : "system-ui, -apple-system, sans-serif";

  const hc = template.header_color || "#1a56db";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Eye className="h-4 w-4" />
          Invoice Preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="border rounded-lg bg-white text-black overflow-hidden shadow-sm"
          style={{ fontFamily, fontSize: "12px", lineHeight: 1.5 }}
        >
          {/* Header */}
          <div className="p-6 pb-4">
            <div className="flex justify-between items-start">
              {/* Left: logo + company info */}
              <div className="space-y-2">
                {template.show_logo && logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-10 object-contain mb-2"
                    style={{ maxWidth: 160 }}
                  />
                )}
                <div className="font-semibold text-sm" style={{ color: hc }}>
                  {businessName || "Your Company"}
                </div>
                {template.company_address && (
                  <div className="text-[11px] text-gray-600 whitespace-pre-line">
                    {template.company_address}
                  </div>
                )}
              </div>
              {/* Right: Invoice title */}
              <div className="text-right">
                <div
                  className="text-2xl font-light tracking-wide"
                  style={{ color: hc }}
                >
                  Invoice
                </div>
                <div className="text-sm font-semibold mt-1 text-gray-800">
                  #INV-00001
                </div>
                <div className="mt-2 text-[11px] text-gray-600 space-y-0.5">
                  <div>
                    <span className="font-semibold" style={{ color: hc }}>
                      Invoice Date:
                    </span>{" "}
                    04/09/2026
                  </div>
                  <div>
                    <span className="font-semibold" style={{ color: hc }}>
                      Due Date:
                    </span>{" "}
                    05/09/2026
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bill To / Ship To / Amount Due */}
          <div className="px-6 pb-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div
                  className="text-[10px] font-bold uppercase tracking-wider mb-1"
                  style={{ color: hc }}
                >
                  Bill To
                </div>
                <div className="text-[11px] text-gray-700">
                  Customer Company
                  <br />
                  456 Commerce Blvd
                  <br />
                  Suite 200
                  <br />
                  Los Angeles, CA 90001
                </div>
              </div>
              {template.show_ship_to && (
                <div>
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider mb-1"
                    style={{ color: hc }}
                  >
                    Ship To
                  </div>
                  <div className="text-[11px] text-gray-700">
                    Acme Corporation
                    <br />
                    123 Main Street
                    <br />
                    New York, NY 10001
                  </div>
                </div>
              )}
              <div
                className={
                  template.show_ship_to ? "" : "col-start-3"
                }
              >
                <div
                  className="rounded-md p-3 text-center"
                  style={{ backgroundColor: `${hc}10` }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: hc }}
                  >
                    Amount Due
                  </div>
                  <div
                    className="text-xl font-bold mt-1"
                    style={{ color: hc }}
                  >
                    $12,500.00
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Terms row */}
          <div className="mx-6">
            <div
              className="grid text-[10px] font-bold uppercase tracking-wider text-white px-3 py-1.5 rounded-t"
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
              className="grid text-[11px] px-3 py-2 border-x border-b rounded-b text-gray-700"
              style={{
                gridTemplateColumns: template.show_po_number && template.show_sales_rep
                  ? "1fr 1fr 1fr 1fr"
                  : template.show_po_number || template.show_sales_rep
                  ? "1fr 1fr 1fr"
                  : "1fr 1fr",
              }}
            >
              <span>Net 30</span>
              <span>05/09/2026</span>
              {template.show_po_number && (
                <span className="text-gray-400">PO-2024-001</span>
              )}
              {template.show_sales_rep && (
                <span className="text-gray-400">—</span>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="mx-6 mt-3">
            <div
              className="grid grid-cols-4 text-[10px] font-bold uppercase tracking-wider text-white px-3 py-1.5 rounded-t"
              style={{ backgroundColor: hc }}
            >
              <span className="col-span-2">Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Amount</span>
            </div>
            <div className="border-x border-b rounded-b divide-y">
              <div className="grid grid-cols-4 text-[11px] px-3 py-2 text-gray-700">
                <span className="col-span-2">Annual Service Fee</span>
                <span className="text-right">1</span>
                <span className="text-right">$12,500.00</span>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="px-6 mt-3">
            <div className="flex justify-end">
              <div className="w-48 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-600">Subtotal</span>
                  <span>$12,500.00</span>
                </div>
                {template.show_tax && (
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-600">Tax</span>
                    <span>$0.00</span>
                  </div>
                )}
                <div
                  className="flex justify-between font-bold pt-1 border-t"
                  style={{ color: hc }}
                >
                  <span>Total</span>
                  <span>$12,500.00</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer note */}
          {template.footer_note && (
            <div className="px-6 mt-4">
              <p className="text-[11px] text-gray-500 italic">
                {template.footer_note}
              </p>
            </div>
          )}

          {/* Payment Instructions */}
          {template.show_payment_instructions &&
            (template.payment_instructions_wire ||
              template.payment_instructions_check) && (
              <div className="px-6 mt-3 pb-6">
                <div className="border-t pt-3">
                  {template.payment_instructions_wire && (
                    <div className="mb-2">
                      <div
                        className="text-[10px] font-bold uppercase tracking-wider mb-1"
                        style={{ color: hc }}
                      >
                        Wire / ACH Payment
                      </div>
                      <div className="text-[11px] text-gray-600 whitespace-pre-line">
                        {template.payment_instructions_wire}
                      </div>
                    </div>
                  )}
                  {template.payment_instructions_check && (
                    <div>
                      <div
                        className="text-[10px] font-bold uppercase tracking-wider mb-1"
                        style={{ color: hc }}
                      >
                        Check Payment
                      </div>
                      <div className="text-[11px] text-gray-600 whitespace-pre-line">
                        {template.payment_instructions_check}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Bottom bar */}
          <div
            className="h-1.5"
            style={{ backgroundColor: hc }}
          />
        </div>
      </CardContent>
    </Card>
  );
};
