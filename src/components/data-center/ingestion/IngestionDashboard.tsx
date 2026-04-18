import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, CheckCircle2, XCircle, Eye, Scan, BarChart3 } from "lucide-react";

export function IngestionDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["ingestion-dashboard-stats"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: _eff } = user
        ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
        : { data: null };
      const accountId = (_eff as string | null) || user?.id;
      if (!user) return null;

      const [
        totalScanned,
        pendingExtraction,
        processed,
        errored,
        reviewPending,
        reviewApproved,
        reviewRejected,
        duplicates,
        lowConfidence,
        auditEvents,
      ] = await Promise.all([
        supabase.from("ingestion_scanned_files").select("id", { count: "exact" }).eq("user_id", accountId),
        supabase.from("ingestion_scanned_files").select("id", { count: "exact" }).eq("user_id", accountId).eq("processing_status", "pending"),
        supabase.from("ingestion_scanned_files").select("id", { count: "exact" }).eq("user_id", accountId).eq("processing_status", "processed"),
        supabase.from("ingestion_scanned_files").select("id", { count: "exact" }).eq("user_id", accountId).eq("processing_status", "error"),
        supabase.from("ingestion_review_queue").select("id", { count: "exact" }).eq("user_id", accountId).eq("review_status", "pending"),
        supabase.from("ingestion_review_queue").select("id", { count: "exact" }).eq("user_id", accountId).eq("review_status", "approved"),
        supabase.from("ingestion_review_queue").select("id", { count: "exact" }).eq("user_id", accountId).eq("review_status", "rejected"),
        supabase.from("ingestion_review_queue").select("id", { count: "exact" }).eq("user_id", accountId).eq("is_duplicate", true),
        supabase.from("ingestion_review_queue").select("id", { count: "exact" }).eq("user_id", accountId).lt("confidence_score", 50),
        supabase.from("ingestion_audit_log").select("id", { count: "exact" }).eq("user_id", accountId),
      ]);

      return {
        totalScanned: totalScanned.count || 0,
        pendingExtraction: pendingExtraction.count || 0,
        processed: processed.count || 0,
        errored: errored.count || 0,
        reviewPending: reviewPending.count || 0,
        reviewApproved: reviewApproved.count || 0,
        reviewRejected: reviewRejected.count || 0,
        duplicates: duplicates.count || 0,
        lowConfidence: lowConfidence.count || 0,
        auditEvents: auditEvents.count || 0,
      };
    },
  });

  // Recent audit log
  const { data: recentEvents } = useQuery({
    queryKey: ["ingestion-recent-audit"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: _eff } = user
        ? await supabase.rpc('get_effective_account_id', { p_user_id: user.id })
        : { data: null };
      const accountId = (_eff as string | null) || user?.id;
      if (!user) return [];
      const { data } = await supabase
        .from("ingestion_audit_log")
        .select("*")
        .eq("user_id", accountId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  if (isLoading) {
    return <Card><CardContent className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;
  }

  if (!stats) return null;

  const eventLabels: Record<string, { label: string; icon: any; color: string }> = {
    folder_scanned: { label: "Folder Scanned", icon: Scan, color: "text-blue-600" },
    file_extracted: { label: "File Extracted", icon: FileText, color: "text-primary" },
    invoice_approved: { label: "Invoice Approved", icon: CheckCircle2, color: "text-green-600" },
    invoice_rejected: { label: "Invoice Rejected", icon: XCircle, color: "text-red-600" },
  };

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide flex items-center gap-1">
              <Scan className="h-3 w-3" /> Files Scanned
            </CardDescription>
            <CardTitle className="text-2xl">{stats.totalScanned}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {stats.pendingExtraction} pending extraction
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide flex items-center gap-1">
              <FileText className="h-3 w-3" /> Invoices Extracted
            </CardDescription>
            <CardTitle className="text-2xl text-primary">{stats.processed}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {stats.errored > 0 && <span className="text-destructive">{stats.errored} errors</span>}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide flex items-center gap-1">
              <Eye className="h-3 w-3" /> Pending Review
            </CardDescription>
            <CardTitle className="text-2xl text-amber-600">{stats.reviewPending}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {stats.lowConfidence > 0 && <span className="text-amber-600">{stats.lowConfidence} low confidence</span>}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Approved Imports
            </CardDescription>
            <CardTitle className="text-2xl text-green-600">{stats.reviewApproved}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {stats.reviewRejected} rejected • {stats.duplicates} duplicates
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Audit Trail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Ingestion Audit Trail
          </CardTitle>
          <CardDescription>Complete history of all ingestion events</CardDescription>
        </CardHeader>
        <CardContent>
          {!recentEvents || recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No events yet</p>
          ) : (
            <div className="space-y-2">
              {recentEvents.map((event: any) => {
                const config = eventLabels[event.event_type] || { label: event.event_type, icon: FileText, color: "text-muted-foreground" };
                const EventIcon = config.icon;
                return (
                  <div key={event.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/30">
                    <EventIcon className={`h-4 w-4 shrink-0 ${config.color}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{config.label}</p>
                      {event.event_details && (
                        <p className="text-xs text-muted-foreground truncate">
                          {event.event_type === "folder_scanned"
                            ? `Found ${event.event_details.new_files} new files`
                            : event.event_type === "file_extracted"
                            ? `Confidence: ${event.event_details.confidence_score}%`
                            : event.event_type === "invoice_approved"
                            ? `Invoice imported`
                            : JSON.stringify(event.event_details).slice(0, 80)
                          }
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
