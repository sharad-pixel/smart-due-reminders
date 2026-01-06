import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { 
  RefreshCw, 
  Check, 
  X, 
  Loader2, 
  CreditCard,
  Calendar,
  FileText,
  ArrowUpRight,
  DollarSign,
  RotateCcw,
  MinusCircle,
  Users
} from "lucide-react";
import { format } from "date-fns";
import { 
  LastSyncRunCard, 
  SyncErrorBanner, 
  SyncHistoryDrawer, 
  SyncMetricCard,
  type SyncLogEntry 
} from './sync';

interface StripeIntegration {
  id: string;
  user_id: string;
  is_connected: boolean;
  last_sync_at: string | null;
  sync_status: string;
  last_sync_error: string | null;
  invoices_synced_count: number;
  stripe_secret_key_encrypted: string | null;
}

interface InvoiceTransaction {
  id: string;
  invoice_id: string;
  transaction_type: string;
  amount: number;
  transaction_date: string;
  reason: string | null;
  notes: string | null;
  reference_number: string | null;
  metadata: any;
  created_at: string;
  invoice?: {
    invoice_number: string;
    debtor?: {
      company_name: string;
    };
  };
}

export const StripeSyncSection = () => {
  const [syncing, setSyncing] = useState(false);
  const [integration, setIntegration] = useState<StripeIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    fetchIntegration();
  }, []);

  const fetchIntegration = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: effectiveAccountId } = await supabase.rpc('get_effective_account_id', { p_user_id: user.id });
      const accountId = effectiveAccountId || user.id;

      const { data, error } = await supabase
        .from('stripe_integrations')
        .select('*')
        .eq('user_id', accountId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setIntegration(data);
    } catch (error: any) {
      console.error("Failed to fetch Stripe integration:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch sync logs
  const { data: syncLogs, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['stripe-sync-logs'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('stripe_sync_log')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as SyncLogEntry[];
    },
    enabled: !!integration?.stripe_secret_key_encrypted,
  });

  const latestSync = syncLogs?.[0] || null;
  const isSyncRunning = latestSync?.status === 'running' || syncing;

  const { data: transactions, isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery({
    queryKey: ["stripe-synced-transactions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("invoice_transactions")
        .select(`
          *,
          invoice:invoices(
            invoice_number,
            debtor:debtors(company_name)
          )
        `)
        .contains('metadata', { source: 'stripe_sync' })
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as InvoiceTransaction[];
    },
    enabled: !!integration?.stripe_secret_key_encrypted,
  });

  // Fetch total counts
  const { data: syncStats } = useQuery({
    queryKey: ['stripe-sync-stats'],
    queryFn: async () => {
      const [invoicesResult, customersResult] = await Promise.all([
        supabase.from('invoices').select('id', { count: 'exact' }).eq('integration_source', 'stripe'),
        supabase.from('debtors').select('id', { count: 'exact' }).not('stripe_customer_id', 'is', null)
      ]);

      return {
        invoices: invoicesResult.count || 0,
        customers: customersResult.count || 0,
        transactions: transactions?.length || 0
      };
    },
    enabled: !!integration?.stripe_secret_key_encrypted,
  });

  const handleSync = async () => {
    if (isSyncRunning) return;
    
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-stripe-invoices');
      
      if (error) throw error;

      toast.success(`Synced ${data.synced_count} invoices from Stripe!`, {
        description: data.transactions_logged > 0
          ? `Imported ${data.transactions_logged} invoice transactions (payments/credits/refunds)`
          : data.created_debtors > 0 
            ? `Created ${data.created_debtors} new accounts` 
            : 'No new invoice transactions found on this sync'
      });

      await fetchIntegration();
      refetchTransactions();
      refetchLogs();
    } catch (error: any) {
      console.error("Sync error:", error);
      toast.error(error.message || "Failed to sync Stripe invoices");
    } finally {
      setSyncing(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'payment':
        return <ArrowUpRight className="h-4 w-4 text-green-600" />;
      case 'credit':
        return <MinusCircle className="h-4 w-4 text-blue-600" />;
      case 'refund':
        return <RotateCcw className="h-4 w-4 text-amber-600" />;
      case 'write_off':
        return <X className="h-4 w-4 text-red-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'payment':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Payment</Badge>;
      case 'credit':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Credit</Badge>;
      case 'refund':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Refund</Badge>;
      case 'write_off':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Write-off</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const hasStripeKey = integration?.stripe_secret_key_encrypted;

  // Enrich latest sync with counts
  const enrichedLatestSync: SyncLogEntry | null = latestSync ? {
    ...latestSync,
    invoices_synced: latestSync.records_synced,
    customers_synced: 0,
    payments_synced: 0,
  } : null;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!hasStripeKey) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#635BFF]/10 rounded-lg flex items-center justify-center p-1.5">
              <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none">
                <path fill="#635BFF" d="M13.976 9.15c0-1.185.965-2.12 2.12-2.12 1.156 0 2.121.935 2.121 2.12v6.81c0 1.185-.965 2.12-2.12 2.12s-2.121-.935-2.121-2.12V9.15z"/>
                <path fill="#635BFF" d="M10.08 18.08c0 1.156-.934 2.12-2.12 2.12-1.185 0-2.12-.964-2.12-2.12V11.27c0-1.156.935-2.12 2.12-2.12s2.12.964 2.12 2.12v6.81z"/>
                <path fill="#635BFF" d="M26.16 18.08c0 1.156-.935 2.12-2.121 2.12s-2.12-.964-2.12-2.12V11.27c0-1.156.934-2.12 2.12-2.12 1.186 0 2.12.964 2.12 2.12v6.81z"/>
                <path fill="#635BFF" d="M18.08 22.85c0 1.185-.935 2.12-2.12 2.12s-2.121-.935-2.121-2.12V16c0-1.156.936-2.12 2.12-2.12s2.121.964 2.121 2.12v6.85z"/>
              </svg>
            </div>
            <div>
              <CardTitle className="text-base">Stripe Integration</CardTitle>
              <CardDescription className="text-xs">
                Connect in Settings → Integrations to sync invoices
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" asChild>
            <a href="/settings">Go to Settings</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-[#635BFF]/10 rounded-lg flex items-center justify-center p-1.5">
                <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none">
                  <path fill="#635BFF" d="M13.976 9.15c0-1.185.965-2.12 2.12-2.12 1.156 0 2.121.935 2.121 2.12v6.81c0 1.185-.965 2.12-2.12 2.12s-2.121-.935-2.121-2.12V9.15z"/>
                  <path fill="#635BFF" d="M10.08 18.08c0 1.156-.934 2.12-2.12 2.12-1.185 0-2.12-.964-2.12-2.12V11.27c0-1.156.935-2.12 2.12-2.12s2.12.964 2.12 2.12v6.81z"/>
                  <path fill="#635BFF" d="M26.16 18.08c0 1.156-.935 2.12-2.121 2.12s-2.12-.964-2.12-2.12V11.27c0-1.156.934-2.12 2.12-2.12 1.186 0 2.12.964 2.12 2.12v6.81z"/>
                  <path fill="#635BFF" d="M18.08 22.85c0 1.185-.935 2.12-2.12 2.12s-2.121-.935-2.121-2.12V16c0-1.156.936-2.12 2.12-2.12s2.121.964 2.121 2.12v6.85z"/>
                </svg>
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Stripe Sync
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Check className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Import invoices and transactions from Stripe
                </CardDescription>
              </div>
            </div>
            <Button 
              onClick={handleSync} 
              disabled={isSyncRunning}
              size="sm"
              className="gap-2"
            >
              {isSyncRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Sync Now
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Last Sync Run Card */}
          <LastSyncRunCard 
            syncLog={enrichedLatestSync}
            isLoading={logsLoading}
            onViewDetails={() => setHistoryOpen(true)}
            integrationName="Stripe"
          />

          {/* Error Banner */}
          {latestSync?.errors && latestSync.errors.length > 0 && (
            <SyncErrorBanner 
              errors={latestSync.errors}
              objectType="invoices"
              onViewDetails={() => setHistoryOpen(true)}
            />
          )}

          {/* Stats Row with Delta + Total */}
          <div className="grid grid-cols-3 gap-4">
            <SyncMetricCard
              icon={FileText}
              label="Invoices"
              total={syncStats?.invoices || integration?.invoices_synced_count || 0}
              delta={latestSync?.records_synced}
              status={latestSync?.status === 'success' ? 'success' : latestSync?.status === 'partial' ? 'warning' : 'neutral'}
            />
            <SyncMetricCard
              icon={Users}
              label="Customers"
              total={syncStats?.customers || 0}
              delta={0}
              status="neutral"
            />
            <SyncMetricCard
              icon={DollarSign}
              label="Transactions"
              total={transactions?.length || 0}
              delta={0}
              status="neutral"
            />
          </div>

          {/* Transactions Log */}
          {transactions && transactions.length > 0 ? (
            <div className="border rounded-lg">
              <div className="p-3 border-b bg-muted/30">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Synced Transactions
                </h4>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Type</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
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
                        <TableCell className="text-right font-medium">
                          ${(tx.amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(tx.transaction_date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                          {tx.reason || tx.notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
              <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No transactions synced yet</p>
              <p className="text-xs">Click "Sync Now" to import from Stripe</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync History Drawer */}
      <SyncHistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        syncLogs={syncLogs || []}
        integrationName="Stripe"
      />
    </>
  );
};

export default StripeSyncSection;