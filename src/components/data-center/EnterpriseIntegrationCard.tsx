import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Settings,
  History,
  ExternalLink,
  Loader2,
  Clock
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface SyncResult {
  status: 'success' | 'partial' | 'failed' | 'running';
  timestamp: string;
  duration?: string;
  synced: number;
  skipped: number;
  needsAttention: number;
  failed: number;
  skippedReason?: string;
}

interface IntegrationStats {
  invoices: number;
  customers: number;
  payments: number;
  credits?: number;
}

interface EnterpriseIntegrationCardProps {
  name: string;
  description: string;
  logo: ReactNode;
  isConnected: boolean;
  isSyncing: boolean;
  lastSync: SyncResult | null;
  stats: IntegrationStats;
  mode?: 'test' | 'live';
  accountId?: string;
  onSync: () => void;
  onSettings?: () => void;
  onHistory?: () => void;
  onDisconnect?: () => void;
  connectButton?: ReactNode;
}

export const EnterpriseIntegrationCard = ({
  name,
  description,
  logo,
  isConnected,
  isSyncing,
  lastSync,
  stats,
  mode,
  accountId,
  onSync,
  onSettings,
  onHistory,
  onDisconnect,
  connectButton
}: EnterpriseIntegrationCardProps) => {
  
  const getStatusBadge = () => {
    if (!isConnected) {
      return (
        <Badge variant="outline" className="bg-muted text-muted-foreground">
          Not Connected
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30">
        <CheckCircle className="h-3 w-3 mr-1" />
        Connected
      </Badge>
    );
  };

  const getSyncStatusIcon = () => {
    if (!lastSync) return null;
    switch (lastSync.status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'partial':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return null;
    }
  };

  const getSyncStatusLabel = () => {
    if (!lastSync) return 'No sync yet';
    switch (lastSync.status) {
      case 'success':
        return 'Sync Complete';
      case 'partial':
        return 'Partial Success';
      case 'failed':
        return 'Sync Failed';
      case 'running':
        return 'Syncing...';
      default:
        return lastSync.status;
    }
  };

  return (
    <Card className={isConnected ? "" : "border-dashed"}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {logo}
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {name}
                {getStatusBadge()}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {description}
              </CardDescription>
            </div>
          </div>
          {isConnected && (
            <Button
              onClick={onSync}
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

      <CardContent className="space-y-4">
        {!isConnected ? (
          <div className="py-4">
            {connectButton}
          </div>
        ) : (
          <>
            {/* Last Sync Info */}
            {lastSync && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    {getSyncStatusIcon()}
                    {getSyncStatusLabel()}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(lastSync.timestamp), 'MMM d, h:mm a')}
                    {lastSync.duration && ` • ${lastSync.duration}`}
                  </span>
                </div>

                {/* Skipped/Attention Info */}
                {(lastSync.skipped > 0 || lastSync.needsAttention > 0) && (
                  <div className="space-y-1.5">
                    {lastSync.skipped > 0 && (
                      <div className="flex items-start gap-2 text-xs p-2 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">{lastSync.skipped} records skipped</p>
                          {lastSync.skippedReason && (
                            <p className="text-amber-600 dark:text-amber-500">{lastSync.skippedReason}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {lastSync.needsAttention > 0 && (
                      <div className="flex items-start gap-2 text-xs p-2 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">{lastSync.needsAttention} need attention</p>
                          <p className="text-blue-600 dark:text-blue-500">Missing contact info</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-lg font-bold">{stats.invoices}</p>
                <p className="text-xs text-muted-foreground">Invoices</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-lg font-bold">{stats.customers}</p>
                <p className="text-xs text-muted-foreground">Customers</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-lg font-bold">{stats.payments}</p>
                <p className="text-xs text-muted-foreground">Payments</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-lg font-bold">{stats.credits || 0}</p>
                <p className="text-xs text-muted-foreground">Credits</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {onSettings && (
                <Button variant="outline" size="sm" onClick={onSettings} className="gap-1">
                  <Settings className="h-3 w-3" />
                  Settings
                </Button>
              )}
              {onHistory && (
                <Button variant="outline" size="sm" onClick={onHistory} className="gap-1">
                  <History className="h-3 w-3" />
                  History
                </Button>
              )}
            </div>

            <Separator />

            {/* Footer with account info */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                {mode && (
                  <Badge variant={mode === 'live' ? 'default' : 'secondary'} className="text-xs">
                    {mode === 'live' ? '🟢 Live' : '🟡 Test'}
                  </Badge>
                )}
                {accountId && (
                  <span className="font-mono">{accountId.slice(0, 4)}...{accountId.slice(-4)}</span>
                )}
              </div>
              {onDisconnect && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onDisconnect}
                  className="text-destructive hover:text-destructive h-7 px-2"
                >
                  Disconnect
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default EnterpriseIntegrationCard;
