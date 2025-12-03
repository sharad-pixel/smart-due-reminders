import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Search, DollarSign, TrendingUp, Users, Loader2 } from "lucide-react";

interface AgingData {
  debtor_id: string;
  debtor_name: string;
  current: number;
  dpd_1_30: number;
  dpd_31_60: number;
  dpd_61_90: number;
  dpd_91_120: number;
  dpd_121_plus: number;
  total: number;
}

const ARAging = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: agingData, isLoading } = useQuery({
    queryKey: ["ar-aging-dashboard"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch all open/partial invoices with debtor info
      const { data: invoices, error } = await supabase
        .from("invoices")
        .select(`
          id,
          debtor_id,
          amount_outstanding,
          aging_bucket,
          debtors (
            company_name,
            name
          )
        `)
        .eq("user_id", user.id)
        .in("status", ["Open", "InPaymentPlan"])
        .gt("amount_outstanding", 0);

      if (error) throw error;

      // Aggregate by debtor
      const debtorMap = new Map<string, AgingData>();

      invoices?.forEach((inv: any) => {
        const debtorId = inv.debtor_id;
        const debtorName = inv.debtors?.company_name || inv.debtors?.name || "Unknown";
        const amount = parseFloat(inv.amount_outstanding) || 0;
        const bucket = inv.aging_bucket || "current";

        if (!debtorMap.has(debtorId)) {
          debtorMap.set(debtorId, {
            debtor_id: debtorId,
            debtor_name: debtorName,
            current: 0,
            dpd_1_30: 0,
            dpd_31_60: 0,
            dpd_61_90: 0,
            dpd_91_120: 0,
            dpd_121_plus: 0,
            total: 0,
          });
        }

        const data = debtorMap.get(debtorId)!;
        data.total += amount;

        switch (bucket) {
          case "current":
            data.current += amount;
            break;
          case "dpd_1_30":
            data.dpd_1_30 += amount;
            break;
          case "dpd_31_60":
            data.dpd_31_60 += amount;
            break;
          case "dpd_61_90":
            data.dpd_61_90 += amount;
            break;
          case "dpd_91_120":
            data.dpd_91_120 += amount;
            break;
          case "dpd_121_150":
          case "dpd_150_plus":
          case "dpd_121_plus":
            data.dpd_121_plus += amount;
            break;
        }
      });

      return Array.from(debtorMap.values()).sort((a, b) => b.total - a.total);
    },
  });

  const totals = agingData?.reduce(
    (acc, row) => ({
      current: acc.current + row.current,
      dpd_1_30: acc.dpd_1_30 + row.dpd_1_30,
      dpd_31_60: acc.dpd_31_60 + row.dpd_31_60,
      dpd_61_90: acc.dpd_61_90 + row.dpd_61_90,
      dpd_91_120: acc.dpd_91_120 + row.dpd_91_120,
      dpd_121_plus: acc.dpd_121_plus + row.dpd_121_plus,
      total: acc.total + row.total,
    }),
    {
      current: 0,
      dpd_1_30: 0,
      dpd_31_60: 0,
      dpd_61_90: 0,
      dpd_91_120: 0,
      dpd_121_plus: 0,
      total: 0,
    }
  ) || { current: 0, dpd_1_30: 0, dpd_31_60: 0, dpd_61_90: 0, dpd_91_120: 0, dpd_121_plus: 0, total: 0 };

  const filteredData = agingData?.filter((row) => {
    if (!searchQuery) return true;
    return row.debtor_name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AR Aging Dashboard</h1>
          <p className="text-muted-foreground">
            View accounts receivable aging by customer
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total AR
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(totals.total)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Current
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.current)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Customers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{agingData?.length || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Past Due
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(totals.total - totals.current)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Aging bucket summary */}
        <div className="grid gap-4 md:grid-cols-6">
          {[
            { label: "Current", value: totals.current, color: "bg-green-500" },
            { label: "1-30", value: totals.dpd_1_30, color: "bg-yellow-500" },
            { label: "31-60", value: totals.dpd_31_60, color: "bg-orange-500" },
            { label: "61-90", value: totals.dpd_61_90, color: "bg-red-400" },
            { label: "91-120", value: totals.dpd_91_120, color: "bg-red-500" },
            { label: "120+", value: totals.dpd_121_plus, color: "bg-red-700" },
          ].map((bucket) => (
            <Card key={bucket.label}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{bucket.label} Days</span>
                  <div className={`w-2 h-2 rounded-full ${bucket.color}`} />
                </div>
                <p className="text-lg font-semibold">{formatCurrency(bucket.value)}</p>
                <p className="text-xs text-muted-foreground">
                  {totals.total > 0 ? ((bucket.value / totals.total) * 100).toFixed(1) : 0}%
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Aging table */}
        <Card>
          <CardHeader>
            <CardTitle>AR Aging by Customer</CardTitle>
            <CardDescription>
              Outstanding balances by aging bucket
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredData?.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">No outstanding receivables</p>
                <p className="text-sm text-muted-foreground">
                  Import invoices to see your AR aging
                </p>
              </div>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Current</TableHead>
                      <TableHead className="text-right">1-30</TableHead>
                      <TableHead className="text-right">31-60</TableHead>
                      <TableHead className="text-right">61-90</TableHead>
                      <TableHead className="text-right">91-120</TableHead>
                      <TableHead className="text-right">120+</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData?.map((row) => (
                      <TableRow key={row.debtor_id}>
                        <TableCell className="font-medium">{row.debtor_name}</TableCell>
                        <TableCell className="text-right">
                          {row.current > 0 ? formatCurrency(row.current) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.dpd_1_30 > 0 ? formatCurrency(row.dpd_1_30) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.dpd_31_60 > 0 ? formatCurrency(row.dpd_31_60) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.dpd_61_90 > 0 ? formatCurrency(row.dpd_61_90) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.dpd_91_120 > 0 ? formatCurrency(row.dpd_91_120) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.dpd_121_plus > 0 ? (
                            <span className="text-red-600 font-medium">
                              {formatCurrency(row.dpd_121_plus)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(row.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals row */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.current)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.dpd_1_30)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.dpd_31_60)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.dpd_61_90)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.dpd_91_120)}</TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(totals.dpd_121_plus)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ARAging;
