import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { 
  RefreshCw, 
  Check, 
  X, 
  AlertTriangle, 
  Loader2, 
  CreditCard,
  Calendar,
  FileText,
  Zap
} from "lucide-react";
import { format } from "date-fns";

interface StripeIntegration {
  id: string;
  user_id: string;
  is_connected: boolean;
  stripe_account_id: string | null;
  last_sync_at: string | null;
  sync_frequency: string;
  auto_sync_enabled: boolean;
  sync_status: string;
  last_sync_error: string | null;
  invoices_synced_count: number;
}

export const StripeIntegrationCard = () => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [integration, setIntegration] = useState<StripeIntegration | null>(null);

  useEffect(() => {
    fetchIntegration();
  }, []);

  const fetchIntegration = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get effective account ID for team support
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

  const handleConnect = async () => {
    setSyncing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get effective account ID
      const { data: effectiveAccountId } = await supabase.rpc('get_effective_account_id', { p_user_id: user.id });
      const accountId = effectiveAccountId || user.id;

      // Create/update integration record
      const { error: upsertError } = await supabase
        .from('stripe_integrations')
        .upsert({
          user_id: accountId,
          is_connected: true,
          auto_sync_enabled: true,
          sync_status: 'syncing'
        }, { onConflict: 'user_id' });

      if (upsertError) throw upsertError;

      // Trigger sync
      const { data, error } = await supabase.functions.invoke('sync-stripe-invoices');
      
      if (error) throw error;

      toast.success(`Synced ${data.synced_count} invoices from Stripe!`, {
        description: data.created_debtors > 0 
          ? `Created ${data.created_debtors} new accounts` 
          : undefined
      });

      await fetchIntegration();
    } catch (error: any) {
      console.error("Sync error:", error);
      toast.error(error.message || "Failed to sync Stripe invoices");
    } finally {
      setSyncing(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-stripe-invoices');
      
      if (error) throw error;

      toast.success(`Synced ${data.synced_count} invoices from Stripe!`, {
        description: data.created_debtors > 0 
          ? `Created ${data.created_debtors} new accounts` 
          : undefined
      });

      await fetchIntegration();
    } catch (error: any) {
      console.error("Sync error:", error);
      toast.error(error.message || "Failed to sync Stripe invoices");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: effectiveAccountId } = await supabase.rpc('get_effective_account_id', { p_user_id: user.id });
      const accountId = effectiveAccountId || user.id;

      const { error } = await supabase
        .from('stripe_integrations')
        .update({ 
          is_connected: false, 
          auto_sync_enabled: false 
        })
        .eq('user_id', accountId);

      if (error) throw error;

      toast.success("Stripe integration disconnected");
      await fetchIntegration();
    } catch (error: any) {
      toast.error("Failed to disconnect");
    }
  };

  const handleToggleAutoSync = async (enabled: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: effectiveAccountId } = await supabase.rpc('get_effective_account_id', { p_user_id: user.id });
      const accountId = effectiveAccountId || user.id;

      const { error } = await supabase
        .from('stripe_integrations')
        .update({ auto_sync_enabled: enabled })
        .eq('user_id', accountId);

      if (error) throw error;

      setIntegration(prev => prev ? { ...prev, auto_sync_enabled: enabled } : null);
      toast.success(enabled ? "Auto-sync enabled" : "Auto-sync disabled");
    } catch (error: any) {
      toast.error("Failed to update setting");
    }
  };

  const getSyncStatusBadge = () => {
    if (!integration) return null;
    
    switch (integration.sync_status) {
      case 'success':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <Check className="h-3 w-3 mr-1" />
            Synced
          </Badge>
        );
      case 'syncing':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Syncing
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <X className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Partial
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            Idle
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle>Stripe Invoice Integration</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-[#635BFF]/10 rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 60 25" className="h-5 w-10" fill="#635BFF">
                <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a13.77 13.77 0 0 1-4.56.75c-4.22 0-6.85-2.55-6.85-6.68 0-3.89 2.38-6.73 6.15-6.73 3.87 0 5.98 2.84 5.98 6.5 0 .49-.05 1.19-.09 1.24zm-4.33-5.87c-1.21 0-2.15.93-2.32 2.55h4.51c-.01-1.62-.82-2.55-2.19-2.55zM45.6 6.58c.91 0 1.67.16 2.32.42v3.7a5.28 5.28 0 0 0-1.94-.42c-1.69 0-2.68 1.23-2.68 3.32v6.5h-4.29V6.82h4.01v1.86c.54-1.29 1.4-2.1 2.58-2.1zM31.79 6.54c1.93 0 3.62.89 3.62 3.08v10.48h-4.08v-1.2c-.91.99-2.13 1.48-3.53 1.48-2.68 0-4.56-1.55-4.56-4.08 0-2.63 1.85-4.22 5.17-4.22 1.21 0 2.27.21 2.96.54v-.33c0-1.16-.89-1.88-2.5-1.88-1.35 0-2.82.33-4.08.91V7.45c1.21-.54 3.06-.91 5-.91zm-.47 9.61c.97 0 1.81-.44 2.49-1.3v-1.3c-.59-.28-1.35-.42-2.11-.42-1.4 0-2.27.61-2.27 1.53 0 .89.68 1.49 1.89 1.49zM17.14 6.54c1.93 0 3.62.89 3.62 3.08v10.48h-4.08v-1.2c-.91.99-2.13 1.48-3.53 1.48-2.68 0-4.56-1.55-4.56-4.08 0-2.63 1.85-4.22 5.17-4.22 1.21 0 2.27.21 2.96.54v-.33c0-1.16-.89-1.88-2.5-1.88-1.35 0-2.82.33-4.08.91V7.45c1.21-.54 3.06-.91 5-.91zm-.47 9.61c.97 0 1.81-.44 2.49-1.3v-1.3c-.59-.28-1.35-.42-2.11-.42-1.4 0-2.27.61-2.27 1.53 0 .89.68 1.49 1.89 1.49zM0 0h4.24v20.1H0V0z"/>
              </svg>
            </div>
            <div>
              <CardTitle>Stripe Invoices</CardTitle>
              <CardDescription>
                Import open and past due invoices from Stripe for collection outreach
              </CardDescription>
            </div>
          </div>
          {integration?.is_connected && getSyncStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!integration?.is_connected ? (
          <>
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
              <Zap className="h-5 w-5 text-amber-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Automatic Invoice Import</p>
                <p className="text-muted-foreground mt-1">
                  Connect to automatically sync open and past due invoices from your Stripe account. 
                  New accounts will be created for Stripe customers not yet in Recouply.
                </p>
              </div>
            </div>
            <Button 
              onClick={handleConnect} 
              disabled={syncing}
              className="w-full gap-2"
            >
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting & Syncing...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  Connect & Sync Stripe Invoices
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Uses your existing Stripe API key configured in Lovable Cloud
            </p>
          </>
        ) : (
          <>
            {/* Connected State */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  Invoices Synced
                </div>
                <p className="text-2xl font-bold mt-1">
                  {integration.invoices_synced_count || 0}
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Last Sync
                </div>
                <p className="text-sm font-medium mt-1">
                  {integration.last_sync_at 
                    ? format(new Date(integration.last_sync_at), 'MMM d, h:mm a')
                    : 'Never'
                  }
                </p>
              </div>
            </div>

            {/* Error Alert */}
            {integration.last_sync_error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {integration.last_sync_error}
                </AlertDescription>
              </Alert>
            )}

            {/* Auto-sync toggle */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="auto-sync">Auto-sync daily</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically import new invoices every day
                </p>
              </div>
              <Switch
                id="auto-sync"
                checked={integration.auto_sync_enabled}
                onCheckedChange={handleToggleAutoSync}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button 
                onClick={handleSync} 
                disabled={syncing}
                className="flex-1 gap-2"
              >
                {syncing ? (
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
              <Button 
                variant="outline" 
                onClick={handleDisconnect}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Disconnect
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default StripeIntegrationCard;
