import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Unlink,
  Building2,
  Users,
  FileText,
  CreditCard,
  Loader2,
  ExternalLink,
  UserCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  LastSyncRunCard, 
  SyncErrorBanner, 
  SyncHistoryDrawer, 
  SyncMetricCard,
  type SyncLogEntry 
} from './sync';
import quickbooksLogo from "@/assets/quickbooks-logo.png";

export const QuickBooksSyncSection = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState({ customers: 0, invoices: 0, payments: 0, contacts: 0 });
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { toast } = useToast();

  // Fetch sync logs
  const { data: syncLogs, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['quickbooks-sync-logs'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('quickbooks_sync_log')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as SyncLogEntry[];
    },
    enabled: isConnected,
  });

  const latestSync = syncLogs?.[0] || null;
  const isSyncRunning = latestSync?.status === 'running' || isSyncing;

  useEffect(() => {
    checkConnectionStatus();
    handleOAuthCallback();
    loadSyncStats();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('quickbooks_realm_id, quickbooks_company_name, quickbooks_connected_at, quickbooks_last_sync_at')
        .eq('id', user.id)
        .single();

      if (profile?.quickbooks_realm_id) {
        setIsConnected(true);
        setCompanyName(profile.quickbooks_company_name || 'QuickBooks Company');
        setConnectedAt(profile.quickbooks_connected_at);
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      console.error('Error checking QB status:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const loadSyncStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [customersResult, invoicesResult, contactsResult] = await Promise.all([
        supabase.from('debtors').select('id', { count: 'exact' }).not('quickbooks_customer_id', 'is', null),
        supabase.from('invoices').select('id', { count: 'exact' }).eq('integration_source', 'quickbooks'),
        supabase.from('contacts').select('id', { count: 'exact' }).eq('source', 'quickbooks')
      ]);

      setSyncStats({
        customers: customersResult.count || 0,
        invoices: invoicesResult.count || 0,
        payments: 0,
        contacts: contactsResult.count || 0
      });
    } catch (error) {
      console.error('Error loading sync stats:', error);
    }
  };

  const handleOAuthCallback = () => {
    const params = new URLSearchParams(window.location.search);
    
    if (params.get('qb_connected') === 'true') {
      const company = params.get('company') || 'QuickBooks';
      toast({
        title: '🎉 QuickBooks Connected!',
        description: `Successfully connected to ${decodeURIComponent(company)}`,
      });
      checkConnectionStatus();
      loadSyncStats();
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    if (params.get('qb_error')) {
      toast({
        title: 'Connection Failed',
        description: `Error: ${params.get('qb_error')}`,
        variant: 'destructive',
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const connectQuickBooks = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('quickbooks-oauth-start');
      
      if (error) throw error;
      if (!data?.authUrl) throw new Error('No auth URL returned');
      
      window.location.href = data.authUrl;
      
    } catch (error: any) {
      toast({
        title: 'Connection Failed',
        description: error.message || 'Could not start QuickBooks connection',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const disconnectQuickBooks = async () => {
    if (!confirm('Are you sure you want to disconnect QuickBooks? Your synced data will remain but no new data will sync.')) {
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('quickbooks-disconnect');
      if (error) throw error;
      
      setIsConnected(false);
      setCompanyName('');
      setConnectedAt(null);
      
      toast({
        title: 'Disconnected',
        description: 'QuickBooks has been disconnected from your account.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Could not disconnect QuickBooks',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const syncNow = async () => {
    if (isSyncRunning) return;
    
    setIsSyncing(true);
    try {
      toast({
        title: 'Syncing...',
        description: 'Importing data from QuickBooks. This may take a moment.',
      });

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No access token available - please log in again');
      }

      const syncUrl = 'https://kguurazunazhhrhasahd.supabase.co/functions/v1/sync-quickbooks-data';

      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ full_sync: true }),
      });

      const responseText = await response.text();

      if (!response.ok) {
        const errorPreview = responseText.substring(0, 300);
        toast({
          title: `Sync Failed (${response.status})`,
          description: errorPreview,
          variant: 'destructive',
        });
        throw new Error(`HTTP ${response.status}: ${errorPreview}`);
      }

      const data = responseText ? JSON.parse(responseText) : {};

      toast({
        title: '✅ Sync Complete!',
        description: `Synced ${data?.customers_synced || 0} customers, ${data?.invoices_synced || 0} invoices, ${data?.payments_synced || 0} payments, ${data?.contacts_synced || 0} contacts`,
      });
      
      checkConnectionStatus();
      loadSyncStats();
      refetchLogs();
    } catch (error: any) {
      console.error('[QB Sync] Error:', error);
      toast({
        title: 'Sync Failed',
        description: error.message || 'Could not sync QuickBooks data',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Transform sync log to include detailed counts
  const enrichedLatestSync: SyncLogEntry | null = latestSync ? {
    ...latestSync,
    customers_synced: latestSync.records_synced, // Approximation - ideally stored separately
    invoices_synced: 0,
    payments_synced: 0,
    contacts_synced: 0,
  } : null;

  if (checkingStatus) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={quickbooksLogo} alt="QuickBooks" className="w-10 h-10 rounded-full object-cover" />
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  QuickBooks Online
                  {isConnected ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted text-muted-foreground">
                      <XCircle className="h-3 w-3 mr-1" />
                      Not Connected
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  Centralized system of record for collections — not just another integration
                </CardDescription>
              </div>
            </div>

            {isConnected && (
              <Button 
                onClick={syncNow} 
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
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <div className="space-y-4">
              {/* Last Sync Run Card */}
              <LastSyncRunCard 
                syncLog={enrichedLatestSync}
                isLoading={logsLoading}
                onViewDetails={() => setHistoryOpen(true)}
                integrationName="QuickBooks"
              />

              {/* Error Banner */}
              {latestSync?.errors && latestSync.errors.length > 0 && (
                <SyncErrorBanner 
                  errors={latestSync.errors}
                  objectType="records"
                  onViewDetails={() => setHistoryOpen(true)}
                />
              )}

              {/* Connection Info */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-[#2CA01C]" />
                  <div>
                    <p className="font-medium">{companyName}</p>
                    <p className="text-xs text-muted-foreground">
                      Connected {connectedAt ? format(new Date(connectedAt), 'MMM d, yyyy') : ''}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={disconnectQuickBooks}
                  disabled={isLoading}
                  className="text-destructive hover:text-destructive"
                >
                  <Unlink className="h-4 w-4 mr-1" />
                  Disconnect
                </Button>
              </div>

              {/* Sync Stats with Delta + Total */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SyncMetricCard
                  icon={Users}
                  label="Customers"
                  total={syncStats.customers}
                  delta={latestSync?.records_synced ?? undefined}
                  status={latestSync?.status === 'success' ? 'success' : latestSync?.status === 'partial' ? 'warning' : 'neutral'}
                />
                <SyncMetricCard
                  icon={FileText}
                  label="Invoices"
                  total={syncStats.invoices}
                  delta={0}
                  status={latestSync?.records_failed && latestSync.records_failed > 0 ? 'error' : 'neutral'}
                />
                <SyncMetricCard
                  icon={CreditCard}
                  label="Payments"
                  total={syncStats.payments}
                  delta={0}
                  status="neutral"
                />
                <SyncMetricCard
                  icon={UserCircle}
                  label="Contacts"
                  total={syncStats.contacts}
                  delta={0}
                  status="success"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Connect your QuickBooks Online account to automatically import:
                </p>
                <div className="flex justify-center gap-6 text-xs text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    Customers
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    Invoices
                  </div>
                  <div className="flex items-center gap-1">
                    <CreditCard className="h-3.5 w-3.5" />
                    Payments
                  </div>
                </div>
              </div>
              <Button
                className="w-full bg-[#2CA01C] hover:bg-[#238615] text-white"
                onClick={connectQuickBooks}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Connect QuickBooks
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync History Drawer */}
      <SyncHistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        syncLogs={syncLogs || []}
        integrationName="QuickBooks"
      />
    </>
  );
};

export default QuickBooksSyncSection;