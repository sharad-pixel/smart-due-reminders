import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, CreditCard, FileX, RefreshCw, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";

interface InvoiceTransaction {
  id: string;
  invoice_id: string;
  transaction_type: string;
  amount: number;
  balance_after: number | null;
  reference_number: string | null;
  payment_method: string | null;
  reason: string | null;
  notes: string | null;
  transaction_date: string;
  created_at: string;
  metadata: any;
}

interface InvoiceTransactionLogProps {
  invoiceId: string;
  currency?: string;
  onTransactionAdded?: () => void;
}

const getTransactionIcon = (type: string) => {
  switch (type) {
    case 'payment':
      return <DollarSign className="h-4 w-4 text-green-600" />;
    case 'credit':
      return <CreditCard className="h-4 w-4 text-blue-600" />;
    case 'write_off':
      return <FileX className="h-4 w-4 text-orange-600" />;
    case 'adjustment':
      return <RefreshCw className="h-4 w-4 text-purple-600" />;
    case 'refund':
      return <ArrowDownLeft className="h-4 w-4 text-red-600" />;
    case 'reversal':
      return <ArrowUpRight className="h-4 w-4 text-gray-600" />;
    default:
      return <DollarSign className="h-4 w-4" />;
  }
};

const getTransactionBadgeColor = (type: string) => {
  switch (type) {
    case 'payment':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'credit':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'write_off':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case 'adjustment':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'refund':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'reversal':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const formatTransactionType = (type: string) => {
  return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export const InvoiceTransactionLog = ({ invoiceId, currency = 'USD', onTransactionAdded }: InvoiceTransactionLogProps) => {
  const [transactions, setTransactions] = useState<InvoiceTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();
  }, [invoiceId]);

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('invoice_transactions')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Expose refresh function
  useEffect(() => {
    if (onTransactionAdded) {
      // Re-fetch when parent signals a new transaction
      fetchTransactions();
    }
  }, [onTransactionAdded]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Transaction History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No transactions recorded yet</p>
            <p className="text-sm">Payments, credits, and write-offs will appear here</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Balance After</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(tx.transaction_date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTransactionIcon(tx.transaction_type)}
                      <Badge className={getTransactionBadgeColor(tx.transaction_type)}>
                        {formatTransactionType(tx.transaction_type)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <span className={tx.transaction_type === 'refund' || tx.transaction_type === 'reversal' ? 'text-red-600' : 'text-green-600'}>
                      {tx.transaction_type === 'refund' || tx.transaction_type === 'reversal' ? '-' : '-'}
                      {formatCurrency(Math.abs(tx.amount))}
                    </span>
                  </TableCell>
                  <TableCell>
                    {tx.balance_after !== null ? formatCurrency(tx.balance_after) : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tx.reference_number || tx.payment_method || '—'}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <div className="truncate text-sm">
                      {tx.reason && <span className="font-medium">{tx.reason}</span>}
                      {tx.reason && tx.notes && ' — '}
                      {tx.notes && <span className="text-muted-foreground">{tx.notes}</span>}
                      {!tx.reason && !tx.notes && '—'}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default InvoiceTransactionLog;
