import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  CreditCard,
  ArrowUpRight,
  RotateCcw,
  MinusCircle,
  DollarSign,
  X,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface LatestSyncResultsProps {
  latestSyncLogId: string | null;
  isLoading?: boolean;
}

interface SyncedInvoice {
  id: string;
  invoice_number: string;
  amount: number;
  status: string;
  due_date: string;
  is_new_from_sync: boolean;
  debtor?: {
    company_name: string;
  };
}

interface SyncedTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  transaction_date: string;
  reason: string | null;
  notes: string | null;
  reference_number: string | null;
  invoice?: {
    invoice_number: string;
    debtor?: {
      company_name: string;
    };
  };
}

const getTransactionIcon = (type: string) => {
  switch (type) {
    case 'payment':
      return <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />;
    case 'credit':
      return <MinusCircle className="h-3.5 w-3.5 text-blue-600" />;
    case 'refund':
      return <RotateCcw className="h-3.5 w-3.5 text-amber-600" />;
    case 'write_off':
      return <X className="h-3.5 w-3.5 text-red-600" />;
    case 'discount':
      return <DollarSign className="h-3.5 w-3.5 text-purple-600" />;
    default:
      return <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />;
  }
};

const getTransactionBadge = (type: string) => {
  const styles: Record<string, string> = {
    payment: 'bg-green-50 text-green-700 border-green-200',
    credit: 'bg-blue-50 text-blue-700 border-blue-200',
    refund: 'bg-amber-50 text-amber-700 border-amber-200',
    write_off: 'bg-red-50 text-red-700 border-red-200',
    discount: 'bg-purple-50 text-purple-700 border-purple-200',
  };
  const label = type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  return (
    <Badge variant="outline" className={styles[type] || ''}>
      {label}
    </Badge>
  );
};

const getStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    Open: 'bg-amber-50 text-amber-700 border-amber-200',
    Paid: 'bg-green-50 text-green-700 border-green-200',
    PartiallyPaid: 'bg-blue-50 text-blue-700 border-blue-200',
    Voided: 'bg-gray-50 text-gray-500 border-gray-200',
    Canceled: 'bg-red-50 text-red-600 border-red-200',
  };
  return (
    <Badge variant="outline" className={`text-[10px] ${styles[status] || ''}`}>
      {status}
    </Badge>
  );
};

export const LatestSyncResults = ({ latestSyncLogId, isLoading }: LatestSyncResultsProps) => {
  const [showInvoices, setShowInvoices] = useState(true);
  const [showTransactions, setShowTransactions] = useState(true);

  // Fetch new invoices from this sync run
  const { data: newInvoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['sync-new-invoices', latestSyncLogId],
    queryFn: async () => {
      if (!latestSyncLogId) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, amount, status, due_date, is_new_from_sync, debtor:debtors(company_name)')
        .eq('sync_log_id', latestSyncLogId)
        .order('is_new_from_sync', { ascending: false });
      if (error) throw error;
      return (data || []) as SyncedInvoice[];
    },
    enabled: !!latestSyncLogId,
  });

  // Fetch new transactions from this sync run
  const { data: newTransactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['sync-new-transactions', latestSyncLogId],
    queryFn: async () => {
      if (!latestSyncLogId) return [];
      const { data, error } = await supabase
        .from('invoice_transactions')
        .select(`
          id, transaction_type, amount, transaction_date, reason, notes, reference_number,
          invoice:invoices(invoice_number, debtor:debtors(company_name))
        `)
        .eq('sync_log_id', latestSyncLogId)
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return (data || []) as SyncedTransaction[];
    },
    enabled: !!latestSyncLogId,
  });

  if (isLoading || invoicesLoading || transactionsLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading sync results...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!latestSyncLogId) return null;

  const newCount = newInvoices?.filter(i => i.is_new_from_sync).length || 0;
  const updatedCount = (newInvoices?.length || 0) - newCount;
  const txCount = newTransactions?.length || 0;

  if (newCount === 0 && updatedCount === 0 && txCount === 0) {
    return (
      <Card className="border-dashed bg-muted/20">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground text-center">
            No new items picked up in the latest sync run.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Latest Sync Pickup</span>
        {newCount > 0 && (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            {newCount} new invoice{newCount !== 1 ? 's' : ''}
          </Badge>
        )}
        {updatedCount > 0 && (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {updatedCount} updated
          </Badge>
        )}
        {txCount > 0 && (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            {txCount} transaction{txCount !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* New/Updated Invoices */}
      {(newInvoices?.length || 0) > 0 && (
        <div className="border rounded-lg">
          <button
            onClick={() => setShowInvoices(!showInvoices)}
            className="w-full p-3 border-b bg-muted/30 flex items-center justify-between hover:bg-muted/50 transition-colors"
          >
            <h4 className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Invoices ({newInvoices?.length})
            </h4>
            {showInvoices ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showInvoices && (
            <div className="max-h-[250px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]"></TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newInvoices?.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        {inv.is_new_from_sync ? (
                          <Badge className="bg-green-100 text-green-700 border-green-300 text-[10px] px-1.5">NEW</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1.5">UPD</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                      <TableCell className="text-sm">{inv.debtor?.company_name || 'Unknown'}</TableCell>
                      <TableCell>{getStatusBadge(inv.status)}</TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        ${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(inv.due_date), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* New Transactions */}
      {txCount > 0 && (
        <div className="border rounded-lg">
          <button
            onClick={() => setShowTransactions(!showTransactions)}
            className="w-full p-3 border-b bg-muted/30 flex items-center justify-between hover:bg-muted/50 transition-colors"
          >
            <h4 className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Transactions ({txCount})
            </h4>
            {showTransactions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showTransactions && (
            <div className="max-h-[250px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newTransactions?.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {getTransactionIcon(tx.transaction_type)}
                          {getTransactionBadge(tx.transaction_type)}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {tx.invoice?.invoice_number || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {tx.invoice?.debtor?.company_name || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        ${Math.abs(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(tx.transaction_date), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LatestSyncResults;
