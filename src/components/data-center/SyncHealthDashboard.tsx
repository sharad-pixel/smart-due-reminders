import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Activity,
  TrendingUp,
  Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface SyncStats {
  total: number;
  success: number;
  partial: number;
  failed: number;
  rate: number;
  lastSyncAt: string | null;
}

export const SyncHealthDashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["sync-health-stats"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch last 24h sync logs from both sources
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      const [stripeLogs, qbLogs] = await Promise.all([
        supabase
          .from("stripe_sync_log")
          .select("id, status, started_at, completed_at, records_synced, records_failed")
          .eq("user_id", user.id)
          .gte("started_at", yesterday.toISOString())
          .order("started_at", { ascending: false }),
        supabase
          .from("quickbooks_sync_log")
          .select("id, status, started_at, completed_at, records_synced, records_failed")
          .eq("user_id", user.id)
          .gte("started_at", yesterday.toISOString())
          .order("started_at", { ascending: false })
      ]);

      const allLogs = [...(stripeLogs.data || []), ...(qbLogs.data || [])];
      
      const successCount = allLogs.filter(l => l.status === 'success' || l.status === 'completed').length;
      const partialCount = allLogs.filter(l => l.status === 'partial').length;
      const failedCount = allLogs.filter(l => l.status === 'failed' || l.status === 'error').length;
      const total = allLogs.length;

      // Find most recent sync
      let lastSyncAt: string | null = null;
      if (allLogs.length > 0) {
        const sorted = allLogs.sort((a, b) => 
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        );
        lastSyncAt = sorted[0]?.started_at || null;
      }

      return {
        total,
        success: successCount,
        partial: partialCount,
        failed: failedCount,
        rate: total > 0 ? Math.round(((successCount + partialCount) / total) * 100) : 100,
        lastSyncAt
      } as SyncStats;
    },
    refetchInterval: 30000
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return "text-green-600";
    if (rate >= 70) return "text-amber-600";
    return "text-red-600";
  };

  const getProgressColor = (rate: number) => {
    if (rate >= 90) return "bg-green-500";
    if (rate >= 70) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Sync Health
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Last 24h
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {/* Total Syncs */}
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{stats?.total || 0}</p>
            <p className="text-xs text-muted-foreground">Total Syncs</p>
          </div>

          {/* Successful */}
          <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
            <p className="text-2xl font-bold text-green-600">{stats?.success || 0}</p>
            <p className="text-xs text-green-700 dark:text-green-400 flex items-center justify-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Success
            </p>
          </div>

          {/* Partial */}
          <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
            <p className="text-2xl font-bold text-amber-600">{stats?.partial || 0}</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center justify-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Partial
            </p>
          </div>

          {/* Failed */}
          <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
            <p className="text-2xl font-bold text-red-600">{stats?.failed || 0}</p>
            <p className="text-xs text-red-700 dark:text-red-400 flex items-center justify-center gap-1">
              <XCircle className="h-3 w-3" />
              Failed
            </p>
          </div>

          {/* Sync Rate */}
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className={`text-2xl font-bold ${getSuccessRateColor(stats?.rate || 100)}`}>
              {stats?.rate || 100}%
            </p>
            <div className="mt-1">
              <Progress 
                value={stats?.rate || 100} 
                className="h-1.5"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Sync Rate
            </p>
          </div>
        </div>

        {/* Last sync info */}
        {stats?.lastSyncAt && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            Last sync: {formatDistanceToNow(new Date(stats.lastSyncAt), { addSuffix: true })}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default SyncHealthDashboard;
