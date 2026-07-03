import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";

const CHECK_ITEMS = [
  { key: "customer", label: "Customer" },
  { key: "stripe_customer_link", label: "Stripe Customer Link" },
  { key: "products", label: "Products" },
  { key: "pricing", label: "Pricing" },
  { key: "billing_frequency", label: "Billing Frequency" },
  { key: "subscription_term", label: "Subscription Term" },
  { key: "contract_start", label: "Contract Start" },
  { key: "contract_end", label: "Contract End" },
  { key: "currency", label: "Currency" },
  { key: "payment_terms", label: "Payment Terms" },
  { key: "invoice_schedule", label: "Invoice Schedule" },
  { key: "professional_services", label: "Professional Services" },
  { key: "usage_charges", label: "Usage Charges" },
  { key: "discounts", label: "Discounts" },
  { key: "taxes", label: "Taxes" },
  { key: "purchase_order", label: "Purchase Order" },
];

interface Props {
  fields: any;
  totals: any;
  blockingIssues?: Array<{ field: string; message: string }>;
  customerLinked?: boolean;
}

function evaluate(key: string, fields: any, totals: any): { ok: boolean; note?: string } {
  const f = fields ?? {};
  switch (key) {
    case "customer":
      return { ok: !!(f.customer_name || f.debtor_name) };
    case "products":
      return { ok: !!(totals?.revenueItemsCount > 0) };
    case "pricing":
      return { ok: !!(totals?.totalContractValue > 0) };
    case "billing_frequency":
      return { ok: !!f.billing_frequency };
    case "subscription_term":
      return { ok: !!(f.term_months || f.subscription_term) };
    case "contract_start":
      return { ok: !!(f.start_date || f.contract_start_date) };
    case "contract_end":
      return { ok: !!(f.end_date || f.contract_end_date) };
    case "currency":
      return { ok: !!f.currency };
    case "payment_terms":
      return { ok: !!f.payment_terms };
    case "invoice_schedule":
      return { ok: !!(totals?.scheduleCount > 0) };
    case "professional_services":
      return { ok: true, note: f.professional_services ? "Detected" : "None" };
    case "usage_charges":
      return { ok: true, note: f.usage_charges ? "Detected" : "None" };
    case "discounts":
      return { ok: true, note: f.discount_amount ? "Detected" : "None" };
    case "taxes":
      return { ok: true, note: f.tax_rate ? "Detected" : "None" };
    case "purchase_order":
      return { ok: true, note: f.po_number ? f.po_number : "Not required" };
    default:
      return { ok: false };
  }
}

export function BillingReadinessCard({ fields, totals }: Props) {
  const results = CHECK_ITEMS.map((it) => ({ ...it, ...evaluate(it.key, fields, totals) }));
  const required = results.filter((r) => !["professional_services", "usage_charges", "discounts", "taxes", "purchase_order"].includes(r.key));
  const passed = required.filter((r) => r.ok).length;
  const score = Math.round((passed / required.length) * 100);
  const needsReview = required.filter((r) => !r.ok);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>AI Billing Readiness</span>
          <span className="text-lg font-semibold">{score}%</span>
        </CardTitle>
        {needsReview.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {needsReview.length} item{needsReview.length === 1 ? "" : "s"} require review before Stripe synchronization.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {results.map((r) => (
            <div key={r.key} className="flex items-center gap-2 text-xs rounded-md border p-2">
              {r.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-medium truncate">{r.label}</div>
                {r.note && <div className="text-[10px] text-muted-foreground truncate">{r.note}</div>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
