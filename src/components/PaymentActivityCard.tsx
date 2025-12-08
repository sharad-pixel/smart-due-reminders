import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, ArrowRight, CheckCircle2, AlertTriangle, Building2, Loader2, Calendar } from "lucide-react";
import { format, subDays, subHours, startOfDay, endOfDay } from "date-fns";
import { Link } from "react-router-dom";
import { SortableTableHead, useSorting } from "@/components/ui/sortable-table-head";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  payment_date: string;
  reference: string | null;
  reconciliation_status: string;
  debtors?: {
    company_name: string;
    name: string;
  };
}

interface PaymentActivityCardProps {
  debtorId?: string;
  limit?: number;
  showHeader?: boolean;
  showDateFilter?: boolean;
}

type DateFilterOption = "48h" | "7d" | "30d" | "90d" | "all";

export function PaymentActivityCard({ 
  debtorId, 
  limit = 50, 
  showHeader = true,
  showDateFilter = true 
}: PaymentActivityCardProps) {
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("48h");

  const getDateRange = (filter: DateFilterOption) => {
    const now = new Date();
    switch (filter) {
      case "48h":
        return { start: subHours(now, 48), end: now };
      case "7d":
        return { start: startOfDay(subDays(now, 7)), end: now };
      case "30d":
        return { start: startOfDay(subDays(now, 30)), end: now };
      case "90d":
        return { start: startOfDay(subDays(now, 90)), end: now };
      case "all":
        return { start: null, end: now };
      default:
        return { start: subHours(now, 48), end: now };
    }
  };

  const { data: payments, isLoading } = useQuery({
    queryKey: ["payment-activity", debtorId, limit, dateFilter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: effectiveAccountId } = await supabase
        .rpc('get_effective_account_id', { p_user_id: user.id });
      
      const accountId = effectiveAccountId || user.id;
      const { start } = getDateRange(dateFilter);

      let query = supabase
        .from("payments")
        .select(`
          id,
          amount,
          currency,
          payment_date,
          reference,
          reconciliation_status,
          debtors (company_name, name)
        `)
        .eq("user_id", accountId)
        .order("payment_date", { ascending: false })
        .limit(limit);

      if (start) {
        query = query.gte("payment_date", start.toISOString());
      }

      if (debtorId) {
        query = query.eq("debtor_id", debtorId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Payment[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["payment-stats", debtorId, dateFilter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: effectiveAccountId } = await supabase
        .rpc('get_effective_account_id', { p_user_id: user.id });
      
      const accountId = effectiveAccountId || user.id;
      const { start } = getDateRange(dateFilter);

      let query = supabase
        .from("payments")
        .select("reconciliation_status, amount")
        .eq("user_id", accountId);

      if (start) {
        query = query.gte("payment_date", start.toISOString());
      }

      if (debtorId) {
        query = query.eq("debtor_id", debtorId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const total = data?.length || 0;
      const matched = data?.filter(p => ["auto_matched", "manually_matched"].includes(p.reconciliation_status)).length || 0;
      const accountMatched = data?.filter(p => ["pending", "unapplied", "ai_suggested", "needs_review"].includes(p.reconciliation_status)).length || 0;
      const totalAmount = data?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      return { total, matched, accountMatched, totalAmount };
    },
  });

  // Prepare data for sorting
  const paymentsWithComputedFields = useMemo(() => {
    return (payments || []).map(p => ({
      ...p,
      account_name: p.debtors?.company_name || p.debtors?.name || 'Unknown',
    }));
  }, [payments]);

  const { sortedData: sortedPayments, sortKey, sortDirection, handleSort } = useSorting(paymentsWithComputedFields);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "auto_matched":
      case "manually_matched":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Matched</Badge>;
      case "ai_suggested":
      case "needs_review":
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertTriangle className="h-3 w-3 mr-1" />Review</Badge>;
      case "pending":
      case "unapplied":
        return <Badge className="bg-blue-100 text-blue-800"><Building2 className="h-3 w-3 mr-1" />Account Only</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDateFilterLabel = (filter: DateFilterOption) => {
    switch (filter) {
      case "48h": return "Last 48 Hours";
      case "7d": return "Last 7 Days";
      case "30d": return "Last 30 Days";
      case "90d": return "Last 90 Days";
      case "all": return "All Time";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payment Activity
              </CardTitle>
              <CardDescription>
                {stats?.total || 0} payments • ${(stats?.totalAmount || 0).toLocaleString()} total
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {showDateFilter && (
                <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilterOption)}>
                  <SelectTrigger className="w-[150px]">
                    <Calendar className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="48h">Last 48 Hours</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="90d">Last 90 Days</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Link to="/reconciliation">
                <Button variant="outline" size="sm">
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent className={showHeader ? "pt-0" : ""}>
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{stats?.matched || 0}</p>
            <p className="text-xs text-muted-foreground">Fully Matched</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{stats?.accountMatched || 0}</p>
            <p className="text-xs text-muted-foreground">Pending Match</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{stats?.total || 0}</p>
            <p className="text-xs text-muted-foreground">Total Payments</p>
          </div>
        </div>

        {/* Payments Table */}
        {sortedPayments && sortedPayments.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    sortKey="payment_date"
                    currentSortKey={sortKey}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                  >
                    Date
                  </SortableTableHead>
                  {!debtorId && (
                    <SortableTableHead
                      sortKey="account_name"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                    >
                      Account
                    </SortableTableHead>
                  )}
                  <SortableTableHead
                    sortKey="amount"
                    currentSortKey={sortKey}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                    className="text-right"
                  >
                    Amount
                  </SortableTableHead>
                  <TableHead>Reference</TableHead>
                  <SortableTableHead
                    sortKey="reconciliation_status"
                    currentSortKey={sortKey}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                  >
                    Status
                  </SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-sm tabular-nums">
                      {format(new Date(payment.payment_date), "MMM d, yyyy")}
                    </TableCell>
                    {!debtorId && (
                      <TableCell className="text-sm font-medium max-w-[200px] truncate">
                        {payment.account_name}
                      </TableCell>
                    )}
                    <TableCell className="font-semibold text-right tabular-nums">
                      {payment.currency} {payment.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">
                      {payment.reference || "—"}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.reconciliation_status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No payment activity in {getDateFilterLabel(dateFilter).toLowerCase()}</p>
          </div>
        )}

        {/* Link to Reconciliation */}
        <div className="mt-4 flex justify-center">
          <Link to="/reconciliation">
            <Button variant="link" size="sm">
              Go to Payment Reconciliation
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
