import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  RefreshCw, 
  Upload, 
  Link2, 
  FileText, 
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  Eye,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

interface SyncConflict {
  id: string;
  invoice_id: string;
  integration_source: string;
  conflicts: Record<string, { recouply_value: any; stripe_value: any }>;
  resolved: boolean;
  created_at: string;
  invoice?: {
    invoice_number: string;
    amount: number;
  };
}

interface IntegrationStats {
  source: string;
  icon: React.ReactNode;
  count: number;
  transactionCount: number;
  lastSyncedAt: string | null;
  syncStatus: 'connected' | 'syncing' | 'error' | 'none';
  canSync: boolean;
}

export const IntegrationSyncDashboard = () => {
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch invoice counts by integration source
  const { data: integrationStats, isLoading: statsLoading } = useQuery({
    queryKey: ["integration-sync-stats"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch invoice counts grouped by integration_source
      const { data: invoices, error: invoicesError } = await supabase
        .from("invoices")
        .select("integration_source, last_synced_at")
        .eq("user_id", user.id);

      if (invoicesError) throw invoicesError;

      // Fetch transaction counts grouped by source_system
      const { data: transactions, error: txError } = await supabase
        .from("invoice_transactions")
        .select("source_system")
        .eq("user_id", user.id);

      if (txError) throw txError;

      // Fetch Stripe integration status
      const { data: stripeIntegration } = await supabase
        .from("stripe_integrations")
        .select("is_connected, sync_status, last_sync_at")
        .eq("user_id", user.id)
        .maybeSingle();

      // Count invoices by source
      const sourceCounts: Record<string, { count: number; lastSynced: string | null }> = {
        stripe: { count: 0, lastSynced: null },
        csv_upload: { count: 0, lastSynced: null },
        recouply_manual: { count: 0, lastSynced: null },
        quickbooks: { count: 0, lastSynced: null },
        xero: { count: 0, lastSynced: null }
      };

      (invoices || []).forEach(inv => {
        const source = inv.integration_source || 'recouply_manual';
        if (sourceCounts[source]) {
          sourceCounts[source].count++;
          if (inv.last_synced_at) {
            if (!sourceCounts[source].lastSynced || inv.last_synced_at > sourceCounts[source].lastSynced) {
              sourceCounts[source].lastSynced = inv.last_synced_at;
            }
          }
        }
      });

      // Count transactions by source
      const txCounts: Record<string, number> = { stripe: 0, recouply: 0, quickbooks: 0 };
      (transactions || []).forEach(tx => {
        const source = tx.source_system || 'recouply';
        if (txCounts[source] !== undefined) {
          txCounts[source]++;
        }
      });

      const stats: IntegrationStats[] = [
        {
          source: "Stripe",
          icon: <Link2 className="h-4 w-4 text-orange-500" />,
          count: sourceCounts.stripe.count,
          transactionCount: txCounts.stripe,
          lastSyncedAt: stripeIntegration?.last_sync_at || sourceCounts.stripe.lastSynced,
          syncStatus: stripeIntegration?.is_connected 
            ? (stripeIntegration.sync_status === 'syncing' ? 'syncing' : 
               stripeIntegration.sync_status === 'error' ? 'error' : 'connected')
            : 'none',
          canSync: stripeIntegration?.is_connected || false
        },
        {
          source: "CSV Upload",
          icon: <FileSpreadsheet className="h-4 w-4 text-blue-500" />,
          count: sourceCounts.csv_upload.count,
          transactionCount: 0,
          lastSyncedAt: sourceCounts.csv_upload.lastSynced,
          syncStatus: 'none',
          canSync: false
        },
        {
          source: "Recouply",
          icon: <FileText className="h-4 w-4 text-green-500" />,
          count: sourceCounts.recouply_manual.count,
          transactionCount: txCounts.recouply,
          lastSyncedAt: null,
          syncStatus: 'none',
          canSync: false
        }
      ];

      // Only show QuickBooks/Xero if they have invoices
      if (sourceCounts.quickbooks.count > 0) {
        stats.push({
          source: "QuickBooks",
          icon: <Link2 className="h-4 w-4 text-green-600" />,
          count: sourceCounts.quickbooks.count,
          transactionCount: txCounts.quickbooks || 0,
          lastSyncedAt: sourceCounts.quickbooks.lastSynced,
          syncStatus: 'connected',
          canSync: true
        });
      }

      if (sourceCounts.xero.count > 0) {
        stats.push({
          source: "Xero",
          icon: <Link2 className="h-4 w-4 text-blue-600" />,
          count: sourceCounts.xero.count,
          transactionCount: 0,
          lastSyncedAt: sourceCounts.xero.lastSynced,
          syncStatus: 'connected',
          canSync: true
        });
      }

      return stats;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch unresolved sync conflicts
  const { data: conflicts, isLoading: conflictsLoading } = useQuery({
    queryKey: ["sync-conflicts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("invoice_sync_conflicts")
        .select(`
          id,
          invoice_id,
          integration_source,
          conflicts,
          resolved,
          created_at
        `)
        .eq("user_id", user.id)
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      // Fetch invoice details for each conflict
      const conflictsWithInvoices: SyncConflict[] = [];
      for (const conflict of data || []) {
        const { data: invoice } = await supabase
          .from("invoices")
          .select("invoice_number, amount")
          .eq("id", conflict.invoice_id)
          .maybeSingle();

        conflictsWithInvoices.push({
          ...conflict,
          conflicts: conflict.conflicts as Record<string, { recouply_value: any; stripe_value: any }>,
          invoice: invoice || undefined
        });
      }

      return conflictsWithInvoices;
    }
  });

  const handleStripeSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-stripe-invoices");
      if (error) throw error;

      if (data?.overrides_reset && data.overrides_reset > 0) {
        toast.success(
          `Stripe sync complete. ${data.overrides_reset} local override${data.overrides_reset > 1 ? 's were' : ' was'} reset to Stripe values.`,
          { duration: 5000 }
        );
      } else {
        toast.success(`Sync complete. ${data?.invoices_synced || 0} invoice${data?.invoices_synced !== 1 ? 's' : ''} synced.`);
      }

      // Refetch stats
      queryClient.invalidateQueries({ queryKey: ["integration-sync-stats"] });
      queryClient.invalidateQueries({ queryKey: ["sync-conflicts"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to sync");
    } finally {
      setSyncing(false);
    }
  };

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="h-3 w-3 mr-1" /> Synced</Badge>;
      case 'syncing':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Syncing</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><AlertTriangle className="h-3 w-3 mr-1" /> Error</Badge>;
      default:
        return <span className="text-muted-foreground">-</span>;
    }
  };

  const formatLastSync = (lastSynced: string | null) => {
    if (!lastSynced) return "-";
    try {
      return formatDistanceToNow(new Date(lastSynced), { addSuffix: true });
    } catch {
      return "-";
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Integration Sync Status
          </CardTitle>
          <CardDescription>
            Monitor your connected integrations and sync invoice data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integrationStats?.map((stat) => (
                  <TableRow key={stat.source}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {stat.icon}
                        <span className="font-medium">{stat.source}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getSyncStatusBadge(stat.syncStatus)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-medium">{stat.count}</span>
                        {stat.transactionCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {stat.transactionCount} txns
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatLastSync(stat.lastSyncedAt)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {stat.source === "Stripe" && stat.canSync && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={handleStripeSync}
                          disabled={syncing}
                        >
                          {syncing ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3 mr-1" />
                          )}
                          Sync Now
                        </Button>
                      )}
                      {stat.source === "CSV Upload" && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => navigate("/data-center")}
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          Upload More
                        </Button>
                      )}
                      {stat.source === "Recouply" && (
                        <span className="text-muted-foreground text-xs">Manual entry</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Sync Conflicts Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Sync Conflicts
          </CardTitle>
          <CardDescription>
            Invoices with local modifications that differ from the source system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {conflictsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : conflicts && conflicts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Modified Fields</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conflicts.map((conflict) => (
                  <TableRow key={conflict.id}>
                    <TableCell>
                      <span className="font-medium">
                        {conflict.invoice?.invoice_number || "Unknown"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {conflict.integration_source}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {Object.keys(conflict.conflicts || {}).map((field) => (
                          <Badge key={field} variant="secondary" className="text-xs">
                            {field.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        Will be overwritten
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/invoices/${conflict.invoice_id}`)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                No sync conflicts. All integrations are in sync.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
