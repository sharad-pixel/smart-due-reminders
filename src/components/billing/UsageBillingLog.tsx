import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  FileText, ExternalLink, Download, Receipt,
  ChevronDown, ChevronUp, TrendingUp, AlertCircle,
  CheckCircle2, Globe
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

interface StripeInvoice {
  id: string;
  number: string | null;
  amount_due: number;
  amount_paid: number;
  status: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  period_start: string;
  period_end: string;
  created: string;
  description: string | null;
  lines_summary: string | null;
}

interface UsageMonth {
  month: string;
  period_start: string;
  period_end: string;
  // ERP consumption
  active_invoice_count: number;
  plan_limit: number | null;
  plan_type: string;
  // Billing breakdown
  included_invoices_used: number;
  overage_invoices: number;
  overage_charges_total: number;
  total_invoices_used: number;
  currency_breakdown: Record<string, number>;
  is_unlimited: boolean;
  // Legacy
  usage_record: {
    included_invoices_used: number;
    overage_invoices: number;
    last_updated_at: string;
  } | null;
  // Stripe
  stripe_invoices: StripeInvoice[];
  has_stripe_billing: boolean;
}

interface BillingHistoryData {
  history: UsageMonth[];
  overage_rate: number;
  plan_type: string;
  plan_limit: number | null;
  is_unlimited: boolean;
}

const formatMonth = (monthStr: string) => {
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
};

const formatDate = (iso: string) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const getStripeStatusBadge = (status: string) => {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-100 text-green-800 text-xs gap-1"><CheckCircle2 className="h-3 w-3" />Paid</Badge>;
    case "open":
      return <Badge variant="outline" className="text-xs">Open</Badge>;
    case "draft":
      return <Badge variant="secondary" className="text-xs">Draft</Badge>;
    case "void":
      return <Badge variant="secondary" className="text-xs text-muted-foreground">Void</Badge>;
    case "uncollectible":
      return <Badge variant="destructive" className="text-xs">Uncollectible</Badge>;
    default:
      return <Badge variant="outline" className="text-xs capitalize">{status}</Badge>;
  }
};

const UsageBar = ({ used, limit, isUnlimited }: { used: number; limit: number | null; isUnlimited: boolean }) => {
  if (isUnlimited || !limit) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-primary/20">
          <div className="h-full rounded-full bg-primary w-full" />
        </div>
        <span className="text-xs text-muted-foreground">∞</span>
      </div>
    );
  }

  const pct = Math.min(100, (used / limit) * 100);
  const color = pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{used}/{limit}</span>
    </div>
  );
};

const UsageBillingLog = () => {
  const [data, setData] = useState<BillingHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data: result, error } = await supabase.functions.invoke("get-usage-billing-history");
        if (error) throw error;
        setData(result);
      } catch (err) {
        console.error("Error fetching usage billing history:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-80 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5 text-primary" />
            Monthly Consumption & Billing History
          </CardTitle>
          <CardDescription>No billing history available yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Summary stats
  const totalOverageCharges = data.history.reduce((s, m) => s + (m.overage_charges_total || 0), 0);
  const totalStripeInvoices = data.history.reduce((s, m) => s + m.stripe_invoices.length, 0);
  const monthsWithOverage = data.history.filter(m => m.overage_invoices > 0).length;

  // Detect multi-currency usage
  const allCurrencies = new Set<string>();
  for (const row of data.history) {
    for (const cur of Object.keys(row.currency_breakdown || {})) {
      allCurrencies.add(cur);
    }
  }
  const isMultiCurrency = allCurrencies.size > 1;

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5 text-primary" />
            Monthly Consumption & Billing History
          </CardTitle>
          <CardDescription>
            ERP-based active invoice consumption tracked per billing term against plan commitment.
            {isMultiCurrency && (
              <span className="inline-flex items-center gap-1 ml-2 text-primary font-medium">
                <Globe className="h-3.5 w-3.5" />
                Multi-currency account
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Summary chips */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-muted">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{data.history.length} billing periods</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-muted">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{totalStripeInvoices} Stripe invoice{totalStripeInvoices !== 1 ? "s" : ""}</span>
            </div>
            {totalOverageCharges > 0 && (
              <div className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>${totalOverageCharges.toFixed(2)} total overages across {monthsWithOverage} month{monthsWithOverage !== 1 ? "s" : ""}</span>
              </div>
            )}
            {isMultiCurrency && (
              <div className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-primary/10 text-primary">
                <Globe className="h-4 w-4" />
                <span>{Array.from(allCurrencies).join(", ")}</span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[130px]">Billing Period</TableHead>
                  <TableHead className="min-w-[180px]">
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 cursor-help underline decoration-dotted">
                        Consumption vs Limit
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        Active invoice count (Open + InPaymentPlan + PartiallyPaid) measured at the end of each billing period vs your plan commitment.
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="text-center min-w-[90px]">Overage</TableHead>
                  <TableHead className="text-right min-w-[110px]">Overage Charges</TableHead>
                  {isMultiCurrency && (
                    <TableHead className="text-center min-w-[80px]">Currencies</TableHead>
                  )}
                  <TableHead className="text-center min-w-[100px]">Stripe Billing</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.history.map((month) => {
                  const isExpanded = expandedMonth === month.month;
                  const hasStripeInvoices = month.stripe_invoices.length > 0;
                  const isOverage = month.overage_invoices > 0;
                  const isCurrentMonth = month.month === new Date().toISOString().slice(0, 7);

                  return (
                    <>
                      <TableRow
                        key={month.month}
                        className={[
                          hasStripeInvoices ? "cursor-pointer hover:bg-muted/50" : "",
                          isOverage ? "border-l-2 border-l-destructive/40" : "",
                        ].join(" ")}
                        onClick={() => hasStripeInvoices && setExpandedMonth(isExpanded ? null : month.month)}
                      >
                        {/* Period */}
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span className="font-semibold">{formatMonth(month.month)}</span>
                            {isCurrentMonth && (
                              <Badge variant="outline" className="text-xs w-fit mt-0.5 text-primary border-primary/40">
                                Current
                              </Badge>
                            )}
                            {!isCurrentMonth && (
                              <span className="text-xs text-muted-foreground">
                                {formatDate(month.period_start)} – {formatDate(month.period_end)}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Consumption bar */}
                        <TableCell>
                          <div className="space-y-1">
                            <UsageBar
                              used={month.active_invoice_count}
                              limit={month.plan_limit}
                              isUnlimited={month.is_unlimited}
                            />
                            <div className="text-xs text-muted-foreground">
                              {month.is_unlimited
                                ? `${month.active_invoice_count} active (unlimited)`
                                : `${month.active_invoice_count} active · ${month.plan_limit} limit`
                              }
                            </div>
                          </div>
                        </TableCell>

                        {/* Overage count */}
                        <TableCell className="text-center">
                          {isOverage ? (
                            <Badge variant="destructive" className="text-xs font-mono">
                              +{month.overage_invoices}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>

                        {/* Overage charges */}
                        <TableCell className="text-right">
                          {isOverage ? (
                            <span className="font-semibold text-destructive">
                              ${month.overage_charges_total.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">$0.00</span>
                          )}
                        </TableCell>

                        {/* Currency breakdown (multi-currency) */}
                        {isMultiCurrency && (
                          <TableCell className="text-center">
                            {Object.keys(month.currency_breakdown || {}).length > 0 ? (
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="flex flex-wrap justify-center gap-0.5">
                                    {Object.keys(month.currency_breakdown).map(cur => (
                                      <Badge key={cur} variant="outline" className="text-xs px-1.5 py-0">
                                        {cur}
                                      </Badge>
                                    ))}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {Object.entries(month.currency_breakdown).map(([cur, cnt]) => (
                                    <div key={cur}>{cur}: {cnt} invoice{cnt !== 1 ? "s" : ""}</div>
                                  ))}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}

                        {/* Stripe billing */}
                        <TableCell className="text-center">
                          {hasStripeInvoices ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <Badge variant="outline" className="text-xs gap-1">
                                <FileText className="h-3 w-3" />
                                {month.stripe_invoices.length}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                ${month.stripe_invoices.reduce((s, i) => s + i.amount_paid, 0).toFixed(2)} paid
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Expand toggle */}
                        <TableCell>
                          {hasStripeInvoices && (
                            isExpanded
                              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Expanded: Stripe invoice details */}
                      {isExpanded && month.stripe_invoices.map((inv) => (
                        <TableRow key={inv.id} className="bg-muted/20">
                          <TableCell colSpan={isMultiCurrency ? 3 : 2} className="pl-8 py-2">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="font-mono text-xs text-muted-foreground">
                                  {inv.number || inv.id}
                                </span>
                                {getStripeStatusBadge(inv.status)}
                              </div>
                              {inv.lines_summary && (
                                <span className="text-xs text-muted-foreground pl-5 truncate max-w-xs">
                                  {inv.lines_summary}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground pl-5">
                                {formatDate(inv.period_start)} – {formatDate(inv.period_end)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <div className="flex flex-col items-center text-xs">
                              <span className="text-foreground font-medium">${inv.amount_paid.toFixed(2)}</span>
                              <span className="text-muted-foreground">paid</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <div className="flex flex-col items-end text-xs">
                              <span className="text-foreground font-medium">${inv.amount_due.toFixed(2)}</span>
                              <span className="text-muted-foreground">due</span>
                            </div>
                          </TableCell>
                          <TableCell colSpan={isMultiCurrency ? 3 : 2} className="text-center py-2">
                            <div className="flex items-center justify-center gap-1.5">
                              {inv.hosted_invoice_url && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1 px-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(inv.hosted_invoice_url!, "_blank");
                                  }}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  View
                                </Button>
                              )}
                              {inv.invoice_pdf && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1 px-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(inv.invoice_pdf!, "_blank");
                                  }}
                                >
                                  <Download className="h-3 w-3" />
                                  PDF
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1.5 rounded-full bg-primary" />
              Within plan limit
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1.5 rounded-full bg-amber-500" />
              80–99% of limit
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1.5 rounded-full bg-destructive" />
              Over limit (${data.overage_rate.toFixed(2)}/invoice)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="italic">Consumption = active invoices (Open, InPaymentPlan, PartiallyPaid) at term end</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default UsageBillingLog;
