import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  History, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Loader2,
  Download,
  Filter,
  CreditCard,
  FileText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";

interface SyncLogEntry {
  id: string;
  source: 'stripe' | 'quickbooks';
  status: string;
  started_at: string;
  completed_at: string | null;
  records_synced: number | null;
  records_failed: number | null;
  errors: unknown;
}

export const SyncActivityLog = () => {
  const [filter, setFilter] = useState<"all" | "stripe" | "quickbooks">("all");
  const [limit, setLimit] = useState(3);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["sync-activity-log", filter, limit],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const results: SyncLogEntry[] = [];

      // Fetch from both sources based on filter
      if (filter === "all" || filter === "stripe") {
        const { data: stripeLogs } = await supabase
          .from("stripe_sync_log")
          .select("id, status, started_at, completed_at, records_synced, records_failed, errors")
          .eq("user_id", user.id)
          .order("started_at", { ascending: false })
          .limit(filter === "stripe" ? limit : Math.ceil(limit / 2));

        (stripeLogs || []).forEach(log => {
          results.push({
            ...log,
            source: 'stripe',
            errors: log.errors || []
          });
        });
      }

      if (filter === "all" || filter === "quickbooks") {
        const { data: qbLogs } = await supabase
          .from("quickbooks_sync_log")
          .select("id, status, started_at, completed_at, records_synced, records_failed, errors")
          .eq("user_id", user.id)
          .order("started_at", { ascending: false })
          .limit(filter === "quickbooks" ? limit : Math.ceil(limit / 2));

        (qbLogs || []).forEach(log => {
          results.push({
            ...log,
            source: 'quickbooks',
            errors: log.errors || []
          });
        });
      }

      // Sort by start time
      return results.sort((a, b) => 
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      ).slice(0, limit);
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
      case 'completed':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Done
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Partial
          </Badge>
        );
      case 'running':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Running
          </Badge>
        );
      case 'failed':
      case 'error':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSourceIcon = (source: string) => {
    if (source === 'stripe') {
      return <CreditCard className="h-4 w-4 text-[#635BFF]" />;
    }
    return <FileText className="h-4 w-4 text-[#2CA01C]" />;
  };

  const getDuration = (started: string, completed: string | null) => {
    if (!completed) return "In progress";
    const start = new Date(started);
    const end = new Date(completed);
    const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.round(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Sync Activity
            </CardTitle>
            <CardDescription>Recent synchronization history</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-3 w-3 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="quickbooks">QuickBooks</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1">
              <Download className="h-3 w-3" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : logs && logs.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[140px]">Time</TableHead>
                  <TableHead className="w-[120px]">Source</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  <TableHead className="w-[80px]">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={`${log.source}-${log.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {format(new Date(log.started_at), 'MMM d, h:mm a')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.started_at), { addSuffix: true })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getSourceIcon(log.source)}
                        <span className="capitalize">{log.source}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-medium text-green-600">
                          {log.records_synced || 0}
                        </span>
                        {(log.records_failed || 0) > 0 && (
                          <span className="text-xs text-red-500">
                            {log.records_failed} failed
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {getDuration(log.started_at, log.completed_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No sync activity yet</p>
            <p className="text-xs">Connect an integration to start syncing</p>
          </div>
        )}

        {logs && logs.length > 0 && (
          <div className="flex justify-center mt-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLimit(prev => prev + 10)}
            >
              Load More
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SyncActivityLog;
