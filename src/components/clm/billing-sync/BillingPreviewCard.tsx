import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { useMemo } from "react";

interface Props {
  fields: any;
  revenueItems: any[];
  schedules: any[];
  currency?: string;
}

export function BillingPreviewCard({ fields, revenueItems, schedules, currency }: Props) {
  const metrics = useMemo(() => {
    const recurring = revenueItems.filter((r: any) => (r.category || r.type || "").toLowerCase().includes("recurring") || (r.frequency || "").toLowerCase() !== "one-time");
    const oneTime = revenueItems.filter((r: any) => (r.category || "").toLowerCase().includes("one") || (r.frequency || "").toLowerCase() === "one-time");
    const services = revenueItems.filter((r: any) => /service|implementation|prof/i.test(r.category || r.description || ""));
    const usage = revenueItems.filter((r: any) => /usage|meter/i.test(r.category || r.description || ""));

    const sum = (arr: any[]) => arr.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const recurringTotal = sum(recurring);
    const oneTimeTotal = sum(oneTime);
    const totalContract = sum(revenueItems);

    const term = Number(fields?.term_months) || 12;
    const arr = recurringTotal * (12 / Math.max(term, 1)) || recurringTotal;
    const mrr = arr / 12;
    const acv = totalContract / Math.max(term / 12, 1);
    const tcv = totalContract;

    return {
      recurringTotal,
      oneTimeTotal,
      servicesTotal: sum(services),
      usageTotal: sum(usage),
      arr,
      mrr,
      acv,
      tcv,
      billingFrequency: fields?.billing_frequency || "—",
      invoiceScheduleCount: schedules.length,
      term,
    };
  }, [fields, revenueItems, schedules]);

  const stats: Array<[string, string]> = [
    ["Estimated MRR", formatCurrency(metrics.mrr, currency)],
    ["Estimated ARR", formatCurrency(metrics.arr, currency)],
    ["Estimated ACV", formatCurrency(metrics.acv, currency)],
    ["Estimated TCV", formatCurrency(metrics.tcv, currency)],
    ["Recurring", formatCurrency(metrics.recurringTotal, currency)],
    ["One-time", formatCurrency(metrics.oneTimeTotal, currency)],
    ["Professional Services", formatCurrency(metrics.servicesTotal, currency)],
    ["Usage Charges", formatCurrency(metrics.usageTotal, currency)],
    ["Billing Frequency", String(metrics.billingFrequency)],
    ["Invoice Schedule Rows", String(metrics.invoiceScheduleCount)],
    ["Contract Term (months)", String(metrics.term)],
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Billing Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-md border p-2">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{k}</div>
              <div className="text-sm font-semibold truncate">{v}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
