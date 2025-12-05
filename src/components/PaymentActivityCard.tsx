import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, ArrowRight, CheckCircle2, AlertTriangle, Building2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

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
}

export function PaymentActivityCard({ debtorId, limit = 5, showHeader = true }: PaymentActivityCardProps) {
  const { data: payments, isLoading } = useQuery({
    queryKey: ["payment-activity", debtorId, limit],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

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
        .eq("user_id", user.id)
        .order("payment_date", { ascending: false })
        .limit(limit);

      if (debtorId) {
        query = query.eq("debtor_id", debtorId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Payment[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["payment-stats", debtorId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let query = supabase
        .from("payments")
        .select("reconciliation_status, amount")
        .eq("user_id", user.id);

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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payment Activity
              </CardTitle>
              <CardDescription>
                {stats?.total || 0} payments • ${(stats?.totalAmount || 0).toLocaleString()} total
              </CardDescription>
            </div>
            <Link to="/reconciliation">
              <Button variant="outline" size="sm">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
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

        {/* Recent Payments Table */}
        {payments && payments.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {!debtorId && <TableHead>Account</TableHead>}
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-sm">
                      {format(new Date(payment.payment_date), "MMM d, yyyy")}
                    </TableCell>
                    {!debtorId && (
                      <TableCell className="text-sm font-medium">
                        {payment.debtors?.company_name || payment.debtors?.name || "Unknown"}
                      </TableCell>
                    )}
                    <TableCell className="font-semibold">
                      {payment.currency} {payment.amount.toLocaleString()}
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
            <p>No payment activity yet</p>
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
