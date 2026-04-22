import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DollarSign, CreditCard, FileX, RefreshCw, ArrowDownLeft, ArrowUpRight, Copy, Check, ChevronDown, ChevronRight, History } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

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

interface AuditEntry {
  id: string;
  action_type: string;
  created_at: string;
  old_values: any;
  new_values: any;
  metadata: any;
  user_id: string;
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

const formatAuditAction = (action: string) =>
  action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export const InvoiceTransactionLog = ({ invoiceId, currency = 'USD', onTransactionAdded }: InvoiceTransactionLogProps) => {
  const [transactions, setTransactions] = useState<InvoiceTransaction[]>([]);
  const [auditByTx, setAuditByTx] = useState<Record<string, AuditEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      const txs = data || [];
      setTransactions(txs);

      // Fetch related audit log entries (best-effort; ignore errors)
      const txIds = txs.map(t => t.id);
      if (txIds.length > 0) {
        const { data: auditData } = await supabase
          .from('audit_logs')
          .select('id, action_type, created_at, old_values, new_values, metadata, user_id, resource_id, resource_type')
          .in('resource_id', txIds)
          .order('created_at', { ascending: true });

        const grouped: Record<string, AuditEntry[]> = {};
        (auditData || []).forEach((entry: any) => {
          const key = entry.resource_id as string;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(entry);
        });
        setAuditByTx(grouped);
      } else {
        setAuditByTx({});
      }
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

  const buildAuditTrailText = (tx: InvoiceTransaction): string => {
    const lines: string[] = [];
    lines.push(`Transaction Audit Trail`);
    lines.push(`========================`);
    lines.push(`Transaction ID: ${tx.id}`);
    lines.push(`Invoice ID: ${tx.invoice_id}`);
    lines.push(`Type: ${formatTransactionType(tx.transaction_type)}`);
    lines.push(`Amount: ${formatCurrency(Math.abs(tx.amount))}`);
    if (tx.balance_after !== null) {
      lines.push(`Balance After: ${formatCurrency(tx.balance_after)}`);
    }
    lines.push(`Transaction Date: ${format(new Date(tx.transaction_date), 'yyyy-MM-dd')}`);
    lines.push(`Recorded At: ${format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm:ss')}`);
    if (tx.reference_number) lines.push(`Reference Number: ${tx.reference_number}`);
    if (tx.payment_method) lines.push(`Payment Method: ${tx.payment_method}`);
    if (tx.reason) lines.push(`Reason: ${tx.reason}`);
    if (tx.notes) lines.push(`Notes: ${tx.notes}`);
    if (tx.metadata && Object.keys(tx.metadata).length > 0) {
      lines.push(`Metadata: ${JSON.stringify(tx.metadata, null, 2)}`);
    }

    const auditEntries = auditByTx[tx.id] || [];
    if (auditEntries.length > 0) {
      lines.push(``);
      lines.push(`Audit Events (${auditEntries.length})`);
      lines.push(`------------------------`);
      auditEntries.forEach((entry, idx) => {
        lines.push(
          `${idx + 1}. [${format(new Date(entry.created_at), 'yyyy-MM-dd HH:mm:ss')}] ${formatAuditAction(entry.action_type)} by user ${entry.user_id}`
        );
        if (entry.old_values) lines.push(`   Old: ${JSON.stringify(entry.old_values)}`);
        if (entry.new_values) lines.push(`   New: ${JSON.stringify(entry.new_values)}`);
        if (entry.metadata && Object.keys(entry.metadata).length > 0) {
          lines.push(`   Metadata: ${JSON.stringify(entry.metadata)}`);
        }
      });
    } else {
      lines.push(``);
      lines.push(`Audit Events: none recorded`);
    }

    return lines.join('\n');
  };

  const handleCopyAuditTrail = async (tx: InvoiceTransaction) => {
    try {
      const text = buildAuditTrailText(tx);
      await navigator.clipboard.writeText(text);
      setCopiedId(tx.id);
      toast.success('Audit trail copied to clipboard');
      setTimeout(() => setCopiedId(prev => (prev === tx.id ? null : prev)), 2000);
    } catch (err) {
      console.error('Failed to copy audit trail:', err);
      toast.error('Failed to copy audit trail');
    }
  };

  const toggleExpanded = (id: string) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

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
                <TableHead className="w-8"></TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Balance After</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-24 text-right">Audit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => {
                const isOpen = !!expanded[tx.id];
                const auditEntries = auditByTx[tx.id] || [];
                return (
                  <Collapsible key={tx.id} asChild open={isOpen} onOpenChange={() => toggleExpanded(tx.id)}>
                    <>
                      <TableRow>
                        <TableCell className="p-2">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
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
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyAuditTrail(tx)}
                            className="h-8 px-2"
                            title="Copy audit trail"
                          >
                            {copiedId === tx.id ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={8} className="py-3">
                            <div className="space-y-3 px-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                  <History className="h-4 w-4" />
                                  Audit Trail
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCopyAuditTrail(tx)}
                                  className="h-7"
                                >
                                  {copiedId === tx.id ? (
                                    <>
                                      <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" />
                                      Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                                      Copy audit log
                                    </>
                                  )}
                                </Button>
                              </div>

                              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                                <div><span className="text-muted-foreground">Transaction ID:</span> <span className="font-mono">{tx.id}</span></div>
                                <div><span className="text-muted-foreground">Recorded At:</span> {format(new Date(tx.created_at), 'MMM d, yyyy HH:mm:ss')}</div>
                                <div><span className="text-muted-foreground">Type:</span> {formatTransactionType(tx.transaction_type)}</div>
                                <div><span className="text-muted-foreground">Amount:</span> {formatCurrency(Math.abs(tx.amount))}</div>
                                {tx.balance_after !== null && (
                                  <div><span className="text-muted-foreground">Balance After:</span> {formatCurrency(tx.balance_after)}</div>
                                )}
                                {tx.reference_number && (
                                  <div><span className="text-muted-foreground">Reference:</span> {tx.reference_number}</div>
                                )}
                                {tx.payment_method && (
                                  <div><span className="text-muted-foreground">Method:</span> {tx.payment_method}</div>
                                )}
                                {tx.reason && (
                                  <div className="col-span-2"><span className="text-muted-foreground">Reason:</span> {tx.reason}</div>
                                )}
                                {tx.notes && (
                                  <div className="col-span-2"><span className="text-muted-foreground">Notes:</span> {tx.notes}</div>
                                )}
                              </div>

                              <div className="border-t pt-2">
                                <div className="text-xs font-medium mb-1.5">
                                  Audit Events {auditEntries.length > 0 && `(${auditEntries.length})`}
                                </div>
                                {auditEntries.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">
                                    No additional audit events recorded for this transaction.
                                  </p>
                                ) : (
                                  <ul className="space-y-1.5">
                                    {auditEntries.map((entry) => (
                                      <li key={entry.id} className="text-xs">
                                        <span className="text-muted-foreground">
                                          {format(new Date(entry.created_at), 'MMM d, yyyy HH:mm:ss')}
                                        </span>{' '}
                                        — <span className="font-medium">{formatAuditAction(entry.action_type)}</span>
                                        {entry.new_values && (
                                          <span className="text-muted-foreground"> · new: {JSON.stringify(entry.new_values)}</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default InvoiceTransactionLog;
