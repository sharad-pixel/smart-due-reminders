import { useState } from 'react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock,
  ChevronRight,
  Users,
  FileText,
  CreditCard,
  UserCircle,
  X
} from 'lucide-react';
import { format, differenceInSeconds } from 'date-fns';
import { groupSyncErrors } from './syncErrorParser';
import { useIsMobile } from '@/hooks/use-mobile';
import type { SyncLogEntry } from './LastSyncRunCard';

interface SyncHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syncLogs: SyncLogEntry[];
  integrationName: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'success':
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Success
        </Badge>
      );
    case 'partial':
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Partial
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs">
          <Clock className="h-3 w-3 mr-1" />
          {status}
        </Badge>
      );
  }
};

const SyncRunDetail = ({ log }: { log: SyncLogEntry }) => {
  const getDuration = () => {
    if (!log.completed_at) return 'N/A';
    const seconds = differenceInSeconds(new Date(log.completed_at), new Date(log.started_at));
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const grouped = groupSyncErrors(log.errors);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Started</p>
          <p className="font-medium">{format(new Date(log.started_at), 'MMM d, h:mm a')}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Duration</p>
          <p className="font-medium">{getDuration()}</p>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {log.customers_synced !== undefined && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{log.customers_synced}</span>
            <span className="text-muted-foreground text-xs">customers</span>
          </div>
        )}
        {log.invoices_synced !== undefined && (
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{log.invoices_synced}</span>
            <span className="text-muted-foreground text-xs">invoices</span>
          </div>
        )}
        {log.payments_synced !== undefined && (
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{log.payments_synced}</span>
            <span className="text-muted-foreground text-xs">payments</span>
          </div>
        )}
        {log.contacts_synced !== undefined && log.contacts_synced > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <UserCircle className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{log.contacts_synced}</span>
            <span className="text-muted-foreground text-xs">contacts</span>
          </div>
        )}
      </div>

      {log.records_failed > 0 && (
        <>
          <Separator />
          <div>
            <p className="text-sm font-medium text-red-700 mb-2">
              {log.records_failed} record{log.records_failed !== 1 ? 's' : ''} failed
            </p>
            {grouped && (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {grouped.groups.map((g, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertTriangle className="h-3 w-3 mt-0.5 text-amber-500 shrink-0" />
                    <span>
                      {g.message}
                      {g.count > 1 && <span className="text-amber-600"> ({g.count}x)</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export const SyncHistoryDrawer = ({ 
  open, 
  onOpenChange, 
  syncLogs, 
  integrationName 
}: SyncHistoryDrawerProps) => {
  const [selectedLog, setSelectedLog] = useState<SyncLogEntry | null>(null);
  const isMobile = useIsMobile();

  const content = (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        {selectedLog ? (
          <div className="p-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedLog(null)}
              className="mb-4 -ml-2"
            >
              ← Back to history
            </Button>
            <h3 className="font-medium mb-4">
              Sync on {format(new Date(selectedLog.started_at), 'MMMM d, yyyy')}
            </h3>
            <SyncRunDetail log={selectedLog} />
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {syncLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No sync history available
                </p>
              ) : (
                syncLogs.map((log) => (
                  <button
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {format(new Date(log.started_at), 'MMM d, h:mm a')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {log.records_synced} synced
                          {log.records_failed > 0 && ` • ${log.records_failed} failed`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={log.status} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );

  // Use Sheet for desktop, Drawer for mobile
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>{integrationName} Sync History</DrawerTitle>
            <DrawerDescription>View past sync runs and their results</DrawerDescription>
          </DrawerHeader>
          {content}
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>{integrationName} Sync History</SheetTitle>
          <SheetDescription>View past sync runs and their results</SheetDescription>
        </SheetHeader>
        <div className="mt-4 h-[calc(100vh-120px)]">
          {content}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SyncHistoryDrawer;