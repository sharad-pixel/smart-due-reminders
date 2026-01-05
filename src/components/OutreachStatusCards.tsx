import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Workflow, Clock, Send, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface OutreachStatusCardsProps {
  onRefresh?: () => void;
}

export function OutreachStatusCards({ onRefresh }: OutreachStatusCardsProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch outreach status metrics
  const { data: metrics, isLoading, refetch } = useQuery({
    queryKey: ["outreach-status-metrics"],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get past due invoices count
      const { count: pastDueCount } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("status", ["Open", "InPaymentPlan"])
        .neq("aging_bucket", "current")
        .lt("due_date", today.toISOString().split("T")[0]);

      // Get invoices with active workflows
      const { data: workflows } = await supabase
        .from("ai_workflows")
        .select("invoice_id")
        .eq("user_id", user.id)
        .eq("is_active", true);

      const withWorkflowCount = workflows?.length || 0;

      // Get pending approval drafts count
      const { count: pendingApprovalCount } = await supabase
        .from("ai_drafts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "pending_approval")
        .is("sent_at", null);

      // Get approved (ready to send) drafts count
      const { count: approvedReadyCount } = await supabase
        .from("ai_drafts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "approved")
        .is("sent_at", null);

      // Get sent today count
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: sentTodayCount } = await supabase
        .from("ai_drafts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("sent_at", todayStart.toISOString());

      // Get error count (last 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const { count: errorCount } = await supabase
        .from("outreach_errors")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("resolved_at", null)
        .gte("created_at", yesterday.toISOString());

      return {
        pastDue: pastDueCount || 0,
        withWorkflow: withWorkflowCount,
        pendingApproval: pendingApprovalCount || 0,
        approvedReady: approvedReadyCount || 0,
        sentToday: sentTodayCount || 0,
        errors: errorCount || 0,
      };
    },
  });

  const handleRefreshOutreach = async () => {
    setIsRefreshing(true);
    try {
      toast.info("Processing outreach...");
      
      const { data, error } = await supabase.functions.invoke("ensure-invoice-workflows", {
        body: {},
      });

      if (error) {
        console.error("Refresh error:", error);
        toast.error("Failed to refresh outreach");
        return;
      }

      const messages: string[] = [];
      if (data?.workflowsAssigned > 0) messages.push(`${data.workflowsAssigned} workflow(s) assigned`);
      if (data?.workflowsUpgraded > 0) messages.push(`${data.workflowsUpgraded} workflow(s) upgraded`);
      if (data?.cadenceFixed > 0) messages.push(`${data.cadenceFixed} cadence(s) fixed`);
      if (data?.schedulerResult?.draftsCreated > 0) messages.push(`${data.schedulerResult.draftsCreated} draft(s) created`);
      if (data?.schedulerResult?.sent > 0) messages.push(`${data.schedulerResult.sent} email(s) sent`);

      if (messages.length > 0) {
        toast.success(messages.join(", "));
      } else {
        toast.success("All invoices are up to date");
      }

      refetch();
      onRefresh?.();
    } catch (err) {
      console.error("Refresh exception:", err);
      toast.error("Failed to refresh outreach");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-9 w-36" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Outreach Status
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshOutreach}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Processing..." : "Process Outreach Now"}
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
              <FileText className="h-4 w-4" />
              <span className="text-sm">Invoices Past Due</span>
            </div>
            <p className="text-2xl font-bold">{metrics?.pastDue || 0}</p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Pending Approval</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{metrics?.pendingApproval || 0}</p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
              <Workflow className="h-4 w-4" />
              <span className="text-sm">Approved (Ready)</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{metrics?.approvedReady || 0}</p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
              <Send className="h-4 w-4" />
              <span className="text-sm">Sent Today</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{metrics?.sentToday || 0}</p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
              <Workflow className="h-4 w-4" />
              <span className="text-sm">With Workflow</span>
            </div>
            <p className="text-2xl font-bold">{metrics?.withWorkflow || 0}</p>
          </div>
        </div>

        {(metrics?.approvedReady || 0) > 0 && (metrics?.sentToday || 0) === 0 && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div className="flex-1">
              <p className="font-medium text-amber-700">
                {metrics?.approvedReady} Approved Draft{metrics?.approvedReady !== 1 ? "s" : ""} Ready to Send
              </p>
              <p className="text-sm text-muted-foreground">
                Drafts are approved but haven't been sent yet. Click "Process Outreach Now" to send them.
              </p>
            </div>
          </div>
        )}

        {(metrics?.errors || 0) > 0 && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <p className="font-medium text-destructive">
                {metrics?.errors} Outreach Error{metrics?.errors !== 1 ? "s" : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                Some outreach drafts failed to generate. Check the errors below.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
