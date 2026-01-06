import { useState, useEffect } from 'react';
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
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';

export const QuickBooksSyncSection = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState({ customers: 0, invoices: 0, payments: 0 });
  const [checkingStatus, setCheckingStatus] = useState(true);
  const { toast } = useToast();

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
        setLastSync(profile.quickbooks_last_sync_at);
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

      // Count QuickBooks-synced records
      const [customersResult, invoicesResult] = await Promise.all([
        supabase.from('debtors').select('id', { count: 'exact' }).not('quickbooks_customer_id', 'is', null),
        supabase.from('invoices').select('id', { count: 'exact' }).eq('integration_source', 'quickbooks')
      ]);

      setSyncStats({
        customers: customersResult.count || 0,
        invoices: invoicesResult.count || 0,
        payments: 0
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
      
      // Redirect to QuickBooks OAuth
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
      setLastSync(null);
      
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
    setIsSyncing(true);
    try {
      toast({
        title: 'Syncing...',
        description: 'Importing data from QuickBooks. This may take a moment.',
      });

      // Get current user access token
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No access token available - please log in again');
      }

      const syncUrl = 'https://kguurazunazhhrhasahd.supabase.co/functions/v1/sync-quickbooks-data';
      console.log('[QB Sync] Calling URL:', syncUrl);
      console.log('[QB Sync] Request body:', JSON.stringify({ full_sync: true }));

      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ full_sync: true }),
      });

      console.log('[QB Sync] Response status:', response.status);
      const responseText = await response.text();
      console.log('[QB Sync] Response body:', responseText);

      if (!response.ok) {
        const errorPreview = responseText.substring(0, 300);
        toast({
          title: `Sync Failed (${response.status})`,
          description: errorPreview,
          variant: 'destructive',
        });
        throw new Error(`HTTP ${response.status}: ${errorPreview}`);
      }

      // Parse JSON from response text
      const data = responseText ? JSON.parse(responseText) : {};

      toast({
        title: '✅ Sync Complete!',
        description: `Synced ${data?.customers_synced || 0} customers, ${data?.invoices_synced || 0} invoices, ${data?.payments_synced || 0} payments, ${data?.contacts_synced || 0} contacts`,
      });
      
      checkConnectionStatus();
      loadSyncStats();
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#2CA01C]/10 rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="#2CA01C">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
            </div>
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
                Import customers, invoices, and payments from QuickBooks
              </CardDescription>
            </div>
          </div>

          {isConnected && (
            <Button 
              onClick={syncNow} 
              disabled={isSyncing}
              size="sm"
              className="gap-2"
            >
              {isSyncing ? (
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
            {/* Connection Info */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-[#2CA01C]" />
                <div>
                  <p className="font-medium">{companyName}</p>
                  <p className="text-xs text-muted-foreground">
                    Connected {connectedAt ? format(new Date(connectedAt), 'MMM d, yyyy') : ''}
                  </p>
                  {lastSync && (
                    <p className="text-xs text-muted-foreground">
                      Last synced: {format(new Date(lastSync), 'MMM d, h:mm a')}
                    </p>
                  )}
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

            {/* Sync Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xl font-bold">{syncStats.customers}</p>
                <p className="text-xs text-muted-foreground">Customers</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <FileText className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xl font-bold">{syncStats.invoices}</p>
                <p className="text-xs text-muted-foreground">Invoices</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <CreditCard className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xl font-bold">{syncStats.payments}</p>
                <p className="text-xs text-muted-foreground">Payments</p>
              </div>
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
  );
};

export default QuickBooksSyncSection;
