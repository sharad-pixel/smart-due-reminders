import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, ExternalLink, Download, Receipt, ChevronDown, ChevronUp } from "lucide-react";
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
}

interface UsageMonth {
  month: string;
  included_invoices_used: number;
  overage_invoices: number;
  overage_charges_total: number;
  total_invoices_used: number;
  last_updated_at: string;
  stripe_invoices: StripeInvoice[];
}

interface BillingHistoryData {
  history: UsageMonth[];
  overage_rate: number;
  plan_type: string;
}

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

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-100 text-green-800 text-xs">Paid</Badge>;
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
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
            Monthly Usage Billing Log
          </CardTitle>
          <CardDescription>No usage billing history available yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Receipt className="h-5 w-5 text-primary" />
          Monthly Usage Billing Log
        </CardTitle>
        <CardDescription>
          Monthly breakdown of invoice usage and associated billing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-center">Included Used</TableHead>
              <TableHead className="text-center">Overages</TableHead>
              <TableHead className="text-right">Overage Charges</TableHead>
              <TableHead className="text-center">Stripe Invoice</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.history.map((month) => {
              const isExpanded = expandedMonth === month.month;
              const hasStripeInvoices = month.stripe_invoices.length > 0;

              return (
                <>
                  <TableRow
                    key={month.month}
                    className={hasStripeInvoices ? "cursor-pointer hover:bg-muted/50" : ""}
                    onClick={() => hasStripeInvoices && setExpandedMonth(isExpanded ? null : month.month)}
                  >
                    <TableCell className="font-medium">{formatMonth(month.month)}</TableCell>
                    <TableCell className="text-center">{month.included_invoices_used}</TableCell>
                    <TableCell className="text-center">
                      {month.overage_invoices > 0 ? (
                        <Badge variant="destructive" className="text-xs">
                          +{month.overage_invoices}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {month.overage_charges_total > 0 ? (
                        <span className="font-medium text-destructive">
                          ${month.overage_charges_total.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">$0.00</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {hasStripeInvoices ? (
                        <Badge variant="outline" className="text-xs gap-1">
                          <FileText className="h-3 w-3" />
                          {month.stripe_invoices.length} invoice{month.stripe_invoices.length > 1 ? "s" : ""}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {hasStripeInvoices && (
                        isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Expanded Stripe invoice details */}
                  {isExpanded && month.stripe_invoices.map((inv) => (
                    <TableRow key={inv.id} className="bg-muted/30">
                      <TableCell colSpan={2} className="pl-8 text-sm">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-mono text-xs">{inv.number || inv.id}</span>
                          {getStatusBadge(inv.status)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        ${inv.amount_paid.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        ${inv.amount_due.toFixed(2)}
                      </TableCell>
                      <TableCell colSpan={2} className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          {inv.hosted_invoice_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1"
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
                              className="h-7 text-xs gap-1"
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

        {data.overage_rate > 0 && (
          <p className="text-xs text-muted-foreground mt-4">
            Overage rate: ${data.overage_rate.toFixed(2)} per invoice beyond plan limit
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default UsageBillingLog;
