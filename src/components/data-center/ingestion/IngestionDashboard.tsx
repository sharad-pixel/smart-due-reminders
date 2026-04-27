import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, CheckCircle2, XCircle, Eye, Scan, BarChart3, DollarSign } from "lucide-react";
import { SMART_INGESTION_PRICING } from "@/lib/subscriptionConfig";

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

      const now = new Date();
      const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

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
        currentPeriodCharges,
        allTimeCharges,
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
        supabase.from("ingestion_usage_charges").select("charge_amount, page_count").eq("user_id", accountId).eq("billing_period", billingPeriod),
        supabase.from("ingestion_usage_charges").select("charge_amount, page_count").eq("user_id", accountId),
      ]);

      const sum = (rows: any) => (rows?.data || []).reduce((s: number, r: any) => s + Number(r.charge_amount || 0), 0);
      const sumPages = (rows: any) => (rows?.data || []).reduce((s: number, r: any) => s + Number(r.page_count || 1), 0);
      const periodScanCount = (currentPeriodCharges?.data || []).length;
      const periodPageCount = sumPages(currentPeriodCharges);
      const periodTotal = sum(currentPeriodCharges);
      const allTimeScanCount = (allTimeCharges?.data || []).length;
      const allTimePageCount = sumPages(allTimeCharges);
      const allTimeTotal = sum(allTimeCharges);

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
        periodScanCount,
        periodPageCount,
        periodTotal,
        allTimeScanCount,
        allTimePageCount,
        allTimeTotal,
        billingPeriod,
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

      {/* OCR Billing Counter */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" /> AI Smart Ingestion — OCR Usage & Billing
              </CardTitle>
              <CardDescription>
                Each approved OCR scan is billed at ${SMART_INGESTION_PRICING.perFile.toFixed(2)} <strong>per page</strong> via Stripe metered usage (e.g. a 3-page invoice = ${(SMART_INGESTION_PRICING.perFile * 3).toFixed(2)}). Rejected and duplicate scans are never charged.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">Period: {stats.billingPeriod}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-background/60 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Scan className="h-3 w-3" /> OCR Pages (This Period)
              </p>
              <p className="text-2xl font-bold text-primary mt-1">{stats.periodPageCount}</p>
              <p className="text-xs text-muted-foreground mt-1">{stats.periodScanCount} approved file{stats.periodScanCount === 1 ? "" : "s"}</p>
            </div>
            <div className="rounded-lg border bg-background/60 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Current Period Billed
              </p>
              <p className="text-2xl font-bold text-green-600 mt-1">${stats.periodTotal.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">${SMART_INGESTION_PRICING.perFile.toFixed(2)} × {stats.periodPageCount} pages</p>
            </div>
            <div className="rounded-lg border bg-background/60 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <BarChart3 className="h-3 w-3" /> All-Time Totals
              </p>
              <p className="text-2xl font-bold mt-1">
                {stats.allTimePageCount} <span className="text-sm text-muted-foreground font-normal">pages</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">{stats.allTimeScanCount} files • ${stats.allTimeTotal.toFixed(2)} total billed</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
