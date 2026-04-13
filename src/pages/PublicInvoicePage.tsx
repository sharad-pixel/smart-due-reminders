import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download } from "lucide-react";
import SEOHead from "@/components/seo/SEOHead";
import venmoLogo from "@/assets/venmo-logo.png";
import paypalLogo from "@/assets/paypal-logo.png";
import cashappLogo from "@/assets/cashapp-logo.png";
import stripeLogo from "@/assets/stripe-logo.png";

const QR_LOGOS: Record<string, string> = {
  Venmo: venmoLogo,
  PayPal: paypalLogo,
  "Cash App": cashappLogo,
  Stripe: stripeLogo,
};

interface PaymentRecord {
  amount: number;
  payment_date: string;
  reference: string | null;
}

interface TransactionRecord {
  transaction_type: string;
  amount: number;
  transaction_date: string;
  reason: string | null;
  reference_number: string | null;
}

interface PublicInvoiceData {
  invoice: {
    id: string;
    invoice_number: string;
    reference_id: string;
    amount: number;
    amount_outstanding: number | null;
    subtotal: number | null;
    tax_amount: number | null;
    total_amount: number | null;
    due_date: string;
    issue_date: string;
    status: string;
    payment_terms: string | null;
    currency: string | null;
    product_description: string | null;
    po_number: string | null;
    paid_date: string | null;
  };
  debtor: {
    company_name: string | null;
    name: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
  branding: {
    business_name: string;
    logo_url: string | null;
    primary_color: string | null;
    accent_color: string | null;
    stripe_payment_link: string | null;
    footer_disclaimer: string | null;
  };
  template: {
    company_address: string | null;
    company_phone: string | null;
    company_website: string | null;
    show_logo: boolean;
    show_po_number: boolean;
    show_sales_rep: boolean;
    show_tax: boolean;
    show_payment_instructions: boolean;
    show_payment_qr_codes: boolean;
    header_color: string | null;
    payment_instructions_wire: string | null;
    payment_instructions_check: string | null;
    footer_note: string | null;
    font_style: string | null;
    qr_code_venmo_url: string | null;
    qr_code_stripe_url: string | null;
    qr_code_paypal_url: string | null;
    qr_code_cashapp_url: string | null;
  } | null;
  payments?: PaymentRecord[];
  transactions?: TransactionRecord[];
}

const PublicInvoicePage = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicInvoiceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "get_public_invoice",
          { p_token: token }
        );
        if (rpcError) throw rpcError;
        const parsed = rpcData as unknown as Record<string, unknown>;
        if (parsed?.error) {
          setError(parsed.error as string);
        } else {
          setData(parsed as unknown as PublicInvoiceData);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load invoice");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Invoice Not Available</h1>
          <p className="text-gray-500">{error || "This invoice could not be found."}</p>
        </div>
      </div>
    );
  }

  const { invoice, debtor, branding, template, payments = [], transactions = [] } = data;
  const hc = template?.header_color || branding.primary_color || "#1a56db";
  const fontFamily =
    template?.font_style === "classic"
      ? "Georgia, 'Times New Roman', serif"
      : template?.font_style === "minimal"
      ? "'Courier New', monospace"
      : "system-ui, -apple-system, sans-serif";

  const formatCurrency = (val: number | null | undefined) => {
    if (val == null) return "$0.00";
    return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });

  const totalPayments = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const credits = transactions.filter(t => t.transaction_type === 'credit');
  const writeOffs = transactions.filter(t => t.transaction_type === 'write_off');
  const totalCredits = credits.reduce((s, t) => s + (t.amount || 0), 0);
  const totalWriteOffs = writeOffs.reduce((s, t) => s + (t.amount || 0), 0);
  const hasAdjustments = totalPayments > 0 || totalCredits > 0 || totalWriteOffs > 0;

  const debtorAddress = [
    debtor?.address_line1,
    debtor?.address_line2,
    [debtor?.city, debtor?.state, debtor?.zip].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join("\n");

  const total = invoice.total_amount ?? invoice.amount;
  const outstanding = invoice.amount_outstanding ?? total;
  const subtotal = invoice.subtotal ?? total;
  const tax = invoice.tax_amount ?? 0;
  const isPaid = invoice.status?.toLowerCase() === "paid";

  const qrCodes = template?.show_payment_qr_codes
    ? [
        { url: template.qr_code_venmo_url, label: "Venmo" },
        { url: template.qr_code_paypal_url, label: "PayPal" },
        { url: template.qr_code_cashapp_url, label: "Cash App" },
        { url: template.qr_code_stripe_url, label: "Stripe" },
      ].filter((q) => q.url)
    : [];

  const handleDownloadPDF = () => {
    window.print();
  };

  return (
    <>
      <SEOHead
        title={`Invoice ${invoice.invoice_number} | ${branding.business_name}`}
        description={`Invoice ${invoice.invoice_number} from ${branding.business_name}`}
      />
      {/* Print-specific styles */}
      <style>{`
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-invoice { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; }
          .print-container { padding: 0 !important; min-height: auto !important; background: white !important; }
        }
      `}</style>
      <div className="min-h-screen bg-gray-100 py-8 px-4 print-container">
        <div className="max-w-3xl mx-auto">
          {/* Download PDF button */}
          <div className="flex justify-end mb-4 no-print">
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-medium text-sm transition-opacity hover:opacity-90 shadow-md"
              style={{ backgroundColor: hc }}
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>
          {isPaid && (
            <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 mb-4 text-center font-medium">
              ✓ This invoice has been paid
            </div>
          )}

          {/* Invoice card */}
          <div
            className="bg-white rounded-lg shadow-lg overflow-hidden print-invoice"
            style={{ fontFamily, fontSize: "14px", lineHeight: 1.6 }}
          >
            {/* Header */}
            <div className="p-8 pb-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  {template?.show_logo && branding.logo_url && (
                    <img
                      src={branding.logo_url}
                      alt="Logo"
                      className="h-14 object-contain mb-3"
                      style={{ maxWidth: 200 }}
                    />
                  )}
                  <div className="font-semibold text-lg" style={{ color: hc }}>
                    {branding.business_name}
                  </div>
                  {template?.company_address && (
                    <div className="text-sm text-gray-600 whitespace-pre-line">
                      {template.company_address}
                    </div>
                  )}
                  {template?.company_phone && (
                    <div className="text-sm text-gray-600">{template.company_phone}</div>
                  )}
                  {template?.company_website && (
                    <div className="text-sm text-gray-600">{template.company_website}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-3xl font-light tracking-wide" style={{ color: hc }}>
                    Invoice
                  </div>
                  <div className="text-base font-semibold mt-1 text-gray-800">
                    #{invoice.invoice_number}
                  </div>
                  <div className="mt-3 text-sm text-gray-600 space-y-0.5">
                    <div>
                      <span className="font-semibold" style={{ color: hc }}>Invoice Date:</span>{" "}
                      {formatDate(invoice.issue_date)}
                    </div>
                    <div>
                      <span className="font-semibold" style={{ color: hc }}>Due Date:</span>{" "}
                      {formatDate(invoice.due_date)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bill To / Amount Due */}
            <div className="px-8 pb-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: hc }}>
                    Bill To
                  </div>
                  <div className="text-sm text-gray-700 whitespace-pre-line">
                    {debtor?.company_name || debtor?.name || "Customer"}
                    {debtorAddress && `\n${debtorAddress}`}
                  </div>
                </div>
                <div className="flex items-start justify-end">
                  <div className="rounded-md p-4 text-center" style={{ backgroundColor: `${hc}10` }}>
                    <div className="text-xs font-bold uppercase tracking-wider" style={{ color: hc }}>
                      {isPaid ? "Amount Paid" : "Amount Due"}
                    </div>
                    <div className="text-2xl font-bold mt-1" style={{ color: hc }}>
                      {formatCurrency(isPaid ? total : outstanding)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms row */}
            <div className="mx-8">
              <div
                className="grid text-xs font-bold uppercase tracking-wider text-white px-4 py-2 rounded-t"
                style={{
                  backgroundColor: hc,
                  gridTemplateColumns: template?.show_po_number ? "1fr 1fr 1fr" : "1fr 1fr",
                }}
              >
                <span>Terms</span>
                <span>Due Date</span>
                {template?.show_po_number && <span>PO #</span>}
              </div>
              <div
                className="grid text-sm px-4 py-2 border-x border-b rounded-b text-gray-700"
                style={{
                  gridTemplateColumns: template?.show_po_number ? "1fr 1fr 1fr" : "1fr 1fr",
                }}
              >
                <span>{invoice.payment_terms || "Net 30"}</span>
                <span>{formatDate(invoice.due_date)}</span>
                {template?.show_po_number && (
                  <span className="text-gray-400">{invoice.po_number || "—"}</span>
                )}
              </div>
            </div>

            {/* Line Items */}
            <div className="mx-8 mt-4">
              <div
                className="grid grid-cols-3 text-xs font-bold uppercase tracking-wider text-white px-4 py-2 rounded-t"
                style={{ backgroundColor: hc }}
              >
                <span>Description</span>
                <span className="text-center">Date</span>
                <span className="text-right">Amount</span>
              </div>
              <div className="border-x border-b rounded-b divide-y">
                <div className="grid grid-cols-3 text-sm px-4 py-3 text-gray-700">
                  <span>{invoice.product_description || `Invoice ${invoice.invoice_number}`}</span>
                  <span className="text-center">{formatDate(invoice.issue_date)}</span>
                  <span className="text-right">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Totals */}
            <div className="px-8 mt-4">
              <div className="flex justify-end">
                <div className="w-56 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-600">Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {template?.show_tax && (
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-600">Tax</span>
                      <span>{formatCurrency(tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-1 border-t" style={{ color: hc }}>
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                  {!isPaid && outstanding !== total && (
                    <div className="flex justify-between font-semibold text-gray-600">
                      <span>Amount Due</span>
                      <span>{formatCurrency(outstanding)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pay Now button */}
            {!isPaid && branding.stripe_payment_link && (
              <div className="px-8 mt-6 text-center no-print">
                <a
                  href={branding.stripe_payment_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-8 py-3 rounded-lg text-white font-semibold text-base transition-opacity hover:opacity-90"
                  style={{ backgroundColor: hc }}
                >
                  Pay Now
                </a>
              </div>
            )}

            {/* Footer note */}
            {template?.footer_note && (
              <div className="px-8 mt-6">
                <p className="text-sm text-gray-500 italic">{template.footer_note}</p>
              </div>
            )}

            {/* QR Codes */}
            {qrCodes.length > 0 && !isPaid && (
              <div className="px-8 mt-4">
                <div className="border-t pt-4">
                  <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: hc }}>
                    Scan to Pay
                  </div>
                  <div className="flex gap-6 flex-wrap">
                    {qrCodes.map((q) => (
                      <div key={q.label} className="text-center">
                        <img
                          src={q.url!}
                          alt={`${q.label} QR Code`}
                          className="h-20 w-20 object-contain border rounded"
                        />
                        <div className="flex items-center justify-center gap-1 mt-1">
                          {QR_LOGOS[q.label] && (
                            <img src={QR_LOGOS[q.label]} alt="" className="h-4 w-4 object-cover rounded-sm" />
                          )}
                          <span className="text-xs text-gray-500">{q.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Payment Instructions */}
            {template?.show_payment_instructions &&
              (template.payment_instructions_wire || template.payment_instructions_check) && (
                <div className="px-8 mt-4 pb-8">
                  <div className="border-t pt-4">
                    {template.payment_instructions_wire && (
                      <div className="mb-3">
                        <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: hc }}>
                          Wire / ACH Payment
                        </div>
                        <div className="text-sm text-gray-600 whitespace-pre-line">
                          {template.payment_instructions_wire}
                        </div>
                      </div>
                    )}
                    {template.payment_instructions_check && (
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: hc }}>
                          Check Payment
                        </div>
                        <div className="text-sm text-gray-600 whitespace-pre-line">
                          {template.payment_instructions_check}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            {/* Disclaimer */}
            {branding.footer_disclaimer && (
              <div className="px-8 pb-6">
                <p className="text-xs text-gray-400">{branding.footer_disclaimer}</p>
              </div>
            )}

            {/* Bottom bar */}
            <div className="h-2" style={{ backgroundColor: hc }} />
          </div>

          {/* Powered by */}
          <div className="text-center mt-4 text-xs text-gray-400 no-print">
            Powered by Recouply.ai
          </div>
        </div>
      </div>
    </>
  );
};

export default PublicInvoicePage;
