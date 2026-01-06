import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Loader2, 
  Clock, 
  Users, 
  FileText, 
  CreditCard,
  ChevronRight,
  UserCircle
} from 'lucide-react';
import { format, differenceInSeconds } from 'date-fns';

export interface SyncLogEntry {
  id: string;
  status: 'pending' | 'running' | 'success' | 'partial' | 'failed';
  sync_type: string;
  started_at: string;
  completed_at: string | null;
  records_synced: number;
  records_failed: number;
  errors: any[] | null;
  // Optional detailed counts
  customers_synced?: number;
  invoices_synced?: number;
  payments_synced?: number;
  contacts_synced?: number;
}

interface LastSyncRunCardProps {
  syncLog: SyncLogEntry | null;
  isLoading?: boolean;
  onViewDetails?: () => void;
  integrationName?: string;
}

export const LastSyncRunCard = ({ 
  syncLog, 
  isLoading, 
  onViewDetails,
  integrationName = 'Integration'
}: LastSyncRunCardProps) => {
  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading sync status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!syncLog) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground text-center">
            No sync history yet. Click "Sync Now" to start.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = () => {
    switch (syncLog.status) {
      case 'running':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Syncing...
          </Badge>
        );
      case 'success':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Partial
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const getDuration = () => {
    if (!syncLog.completed_at) {
      return syncLog.status === 'running' ? 'In progress...' : 'N/A';
    }
    const seconds = differenceInSeconds(
      new Date(syncLog.completed_at), 
      new Date(syncLog.started_at)
    );
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const hasErrors = syncLog.errors && syncLog.errors.length > 0;
  const showDetailedCounts = syncLog.customers_synced !== undefined || 
                              syncLog.invoices_synced !== undefined ||
                              syncLog.payments_synced !== undefined;

  return (
    <Card className={`${hasErrors ? 'border-amber-200 bg-amber-50/30' : ''}`}>
      <CardContent className="py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Last Sync Run
              </span>
              {getStatusBadge()}
            </div>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(syncLog.started_at), 'MMM d, h:mm a')}
              </span>
              <span>Duration: {getDuration()}</span>
            </div>

            {/* Detailed sync counts */}
            {showDetailedCounts && (
              <div className="flex flex-wrap items-center gap-3 mt-2">
                {syncLog.customers_synced !== undefined && (
                  <span className="inline-flex items-center gap-1 text-xs">
                    <Users className="h-3 w-3" />
                    <span className="font-medium">{syncLog.customers_synced}</span>
                    {syncLog.status === 'success' || syncLog.customers_synced > 0 ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : (
                      <span className="text-muted-foreground">customers</span>
                    )}
                  </span>
                )}
                {syncLog.invoices_synced !== undefined && (
                  <span className="inline-flex items-center gap-1 text-xs">
                    <FileText className="h-3 w-3" />
                    <span className="font-medium">{syncLog.invoices_synced}</span>
                    {syncLog.invoices_synced > 0 || syncLog.status === 'success' ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : syncLog.records_failed > 0 ? (
                      <XCircle className="h-3 w-3 text-red-500" />
                    ) : (
                      <span className="text-muted-foreground">invoices</span>
                    )}
                  </span>
                )}
                {syncLog.payments_synced !== undefined && (
                  <span className="inline-flex items-center gap-1 text-xs">
                    <CreditCard className="h-3 w-3" />
                    <span className="font-medium">{syncLog.payments_synced}</span>
                    {syncLog.payments_synced > 0 || syncLog.status === 'success' ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : (
                      <span className="text-muted-foreground">payments</span>
                    )}
                  </span>
                )}
                {syncLog.contacts_synced !== undefined && syncLog.contacts_synced > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs">
                    <UserCircle className="h-3 w-3" />
                    <span className="font-medium">{syncLog.contacts_synced}</span>
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                  </span>
                )}
              </div>
            )}

            {/* Simple counts if no detailed breakdown */}
            {!showDetailedCounts && syncLog.records_synced > 0 && (
              <div className="mt-2 text-xs">
                <span className="font-medium text-green-700">{syncLog.records_synced}</span>
                <span className="text-muted-foreground"> records synced</span>
                {syncLog.records_failed > 0 && (
                  <>
                    <span className="mx-1">•</span>
                    <span className="font-medium text-red-600">{syncLog.records_failed}</span>
                    <span className="text-muted-foreground"> failed</span>
                  </>
                )}
              </div>
            )}
          </div>

          {onViewDetails && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onViewDetails}
              className="text-xs shrink-0"
            >
              View details
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LastSyncRunCard;