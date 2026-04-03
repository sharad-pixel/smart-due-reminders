import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, Loader2, Activity } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export function OutreachBatchRunHistory() {
  const { data: runs, isLoading } = useQuery({
    queryKey: ["outreach-batch-runs"],
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("outreach_batch_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Batch Run History
          </CardTitle>
          <CardDescription>No batch runs yet. Click "Process Outreach Now" to start.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Batch Run History
        </CardTitle>
        <CardDescription>Recent outreach processing runs</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {runs.map((run) => {
          const statusIcon = run.status === "completed" ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : run.status === "failed" ? (
            <XCircle className="h-4 w-4 text-destructive" />
          ) : (
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          );

          const statusBadge = run.status === "completed" ? (
            <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 text-[10px]">Completed</Badge>
          ) : run.status === "failed" ? (
            <Badge variant="destructive" className="text-[10px]">Failed</Badge>
          ) : (
            <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-[10px]">Running</Badge>
          );

          const triggerLabel = run.trigger_type === "manual" ? "Manual" : run.trigger_type === "cron" ? "Scheduled" : run.trigger_type;

          const hasActivity = (run.drafts_generated || 0) + (run.drafts_sent || 0) + (run.drafts_cancelled || 0) > 0;

          return (
            <div
              key={run.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="mt-0.5">{statusIcon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {statusBadge}
                  <Badge variant="secondary" className="text-[10px]">{triggerLabel}</Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                  </span>
                </div>

                {hasActivity && (
                  <div className="flex gap-3 mt-1.5 text-xs">
                    {(run.drafts_generated || 0) > 0 && (
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">{run.drafts_generated}</span> generated
                      </span>
                    )}
                    {(run.drafts_sent || 0) > 0 && (
                      <span className="text-muted-foreground">
                        <span className="font-medium text-green-600">{run.drafts_sent}</span> sent
                      </span>
                    )}
                    {(run.drafts_cancelled || 0) > 0 && (
                      <span className="text-muted-foreground">
                        <span className="font-medium text-amber-600">{run.drafts_cancelled}</span> cancelled
                      </span>
                    )}
                    {(run.drafts_failed || 0) > 0 && (
                      <span className="text-muted-foreground">
                        <span className="font-medium text-destructive">{run.drafts_failed}</span> failed
                      </span>
                    )}
                    {(run.invoices_processed || 0) > 0 && (
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">{run.invoices_processed}</span> invoices
                      </span>
                    )}
                  </div>
                )}

                {run.summary && !hasActivity && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{run.summary}</p>
                )}

                {run.completed_at && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {format(new Date(run.started_at), "MMM d, h:mm a")}
                    {run.completed_at && ` — ${format(new Date(run.completed_at), "h:mm a")}`}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
