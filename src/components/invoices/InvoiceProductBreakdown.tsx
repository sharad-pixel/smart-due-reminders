import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Calendar, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface LineItemRow {
  id: string;
  description: string;
  product_description: string | null;
  quantity: number;
  unit_price: number;
  unit_type: string | null;
  line_total: number;
  line_type: string;
  billing_period: string | null;
  pricing_model: string | null;
  sort_order: number;
}

interface Props {
  invoiceId: string;
  currency?: string;
  invoicePeriodStart?: string | null;
  invoicePeriodEnd?: string | null;
  billingFrequency?: string | null;
}

export function InvoiceProductBreakdown({
  invoiceId,
  currency = "USD",
  invoicePeriodStart,
  invoicePeriodEnd,
  billingFrequency,
}: Props) {
  const [items, setItems] = useState<LineItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("invoice_line_items")
        .select(
          "id, description, product_description, quantity, unit_price, unit_type, line_total, line_type, billing_period, pricing_model, sort_order"
        )
        .eq("invoice_id", invoiceId)
        .order("sort_order", { ascending: true });
      if (!cancelled) {
        setItems((data as LineItemRow[]) || []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  const products = items.filter((i) => i.line_type !== "tax");
  const taxes = items.filter((i) => i.line_type === "tax");
  const subtotal = products.reduce((s, i) => s + Number(i.line_total || 0), 0);
  const taxTotal = taxes.reduce((s, i) => s + Number(i.line_total || 0), 0);

  const termLabel = (() => {
    if (invoicePeriodStart && invoicePeriodEnd) {
      return `${new Date(invoicePeriodStart).toLocaleDateString()} – ${new Date(invoicePeriodEnd).toLocaleDateString()}`;
    }
    return null;
  })();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Product Breakdown
            </CardTitle>
            <CardDescription>
              Products and services included on this invoice
            </CardDescription>
          </div>
          {(termLabel || billingFrequency) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {termLabel ? `Term: ${termLabel}` : ""}
                {termLabel && billingFrequency ? " · " : ""}
                {billingFrequency ? (
                  <span className="capitalize">{billingFrequency.replace(/_/g, " ")}</span>
                ) : null}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading line items…
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No product line items recorded for this invoice.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Product / Description</th>
                  <th className="py-2 px-3 font-medium">Period</th>
                  <th className="py-2 px-3 font-medium text-right">Qty</th>
                  <th className="py-2 px-3 font-medium text-right">Unit Price</th>
                  <th className="py-2 pl-3 font-medium text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {products.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 align-top">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-foreground">{item.description}</div>
                      {item.product_description && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {item.product_description}
                        </div>
                      )}
                      {item.pricing_model && (
                        <Badge variant="outline" className="mt-1 text-[10px] capitalize">
                          {item.pricing_model.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                      {item.billing_period || termLabel || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {item.quantity}
                      {item.unit_type && (
                        <span className="text-xs text-muted-foreground ml-1">{item.unit_type}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {formatCurrency(Number(item.unit_price || 0), currency)}
                    </td>
                    <td className="py-2.5 pl-3 text-right tabular-nums font-medium">
                      {formatCurrency(Number(item.line_total || 0), currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-sm">
                  <td colSpan={4} className="py-2 pr-3 text-right text-muted-foreground">
                    Subtotal
                  </td>
                  <td className="py-2 pl-3 text-right tabular-nums font-medium">
                    {formatCurrency(subtotal, currency)}
                  </td>
                </tr>
                {taxes.map((tax) => (
                  <tr key={tax.id} className="text-sm">
                    <td colSpan={4} className="py-1 pr-3 text-right text-muted-foreground">
                      {tax.description || "Tax"}
                    </td>
                    <td className="py-1 pl-3 text-right tabular-nums">
                      {formatCurrency(Number(tax.line_total || 0), currency)}
                    </td>
                  </tr>
                ))}
                {taxes.length > 0 && (
                  <tr className="text-sm border-t">
                    <td colSpan={4} className="py-2 pr-3 text-right font-semibold">
                      Total
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums font-semibold">
                      {formatCurrency(subtotal + taxTotal, currency)}
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
