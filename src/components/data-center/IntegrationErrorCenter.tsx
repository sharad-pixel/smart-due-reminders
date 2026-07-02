import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccountId } from "@/hooks/useAccountId";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  AlertTriangle, Sparkles, EyeOff, RotateCw, ShieldCheck, Info, ChevronRight, Bug, FileText, CreditCard, Users, Building2,
} from "lucide-react";
import { groupSyncErrors, getErrorTypeLabel } from "@/components/data-center/sync/syncErrorParser";
import { formatDistanceToNow } from "date-fns";

type Source = "stripe" | "quickbooks" | "netsuite" | "sage" | "all";

interface AggregatedError {
  source: string;
  type: string;
  fingerprint: string;
  message: string;
  count: number;
  lastSeen: string;
  details: string[];
  transactionClass: "invoice" | "customer" | "payment" | "contract" | "other";
}

interface AIResolution {
  root_cause?: string;
  user_action?: string;
  severity?: "low" | "medium" | "high";
  auto_resolvable?: boolean;
  safe_to_ignore?: boolean;
  recommended_action?: string;
}

function fingerprint(source: string, type: string, message: string) {
  const seed = `${source}::${type}::${(message || "").slice(0, 120).toLowerCase()}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return `f${Math.abs(h).toString(36)}`;
}

function classifyType(t: string): AggregatedError["transactionClass"] {
  if (t.includes("invoice") || t.includes("status")) return "invoice";
  if (t.includes("customer") || t.includes("contact")) return "customer";
  if (t.includes("payment")) return "payment";
  if (t.includes("contract")) return "contract";
  return "other";
}

const CLASS_META: Record<string, { label: string; icon: any; color: string }> = {
  invoice: { label: "Invoice", icon: FileText, color: "text-purple-700 bg-purple-100" },
  customer: { label: "Customer", icon: Users, color: "text-blue-700 bg-blue-100" },
  payment: { label: "Payment", icon: CreditCard, color: "text-green-700 bg-green-100" },
  contract: { label: "Contract", icon: Building2, color: "text-indigo-700 bg-indigo-100" },
  other: { label: "Other", icon: Bug, color: "text-slate-700 bg-slate-100" },
};

export default function IntegrationErrorCenter() {
  const { accountId } = useAccountId();
  const qc = useQueryClient();
  const [sourceTab, setSourceTab] = useState<Source>("all");
  const [selected, setSelected] = useState<AggregatedError | null>(null);
  const [ignoreReason, setIgnoreReason] = useState("");
  const [showIgnore, setShowIgnore] = useState(false);
  const [aiResolution, setAiResolution] = useState<AIResolution | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Load Stripe sync logs (last 20)
  const { data: stripeLogs, isLoading: stripeLoading } = useQuery({
    queryKey: ["integration-error-stripe-logs", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("stripe_sync_log")
        .select("id, started_at, errors, needs_attention_details")
        .eq("user_id", accountId)
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!accountId,
  });

  // Load QuickBooks sync log errors
  const { data: qbLogs, isLoading: qbLoading } = useQuery({
    queryKey: ["integration-error-qb-logs", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("quickbooks_sync_log")
        .select("id, started_at, error_message, status")
        .eq("user_id", accountId)
        .in("status", ["failed", "partial"])
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) return [];
      return data ?? [];
    },
    enabled: !!accountId,
  });

  // Load dismissals
  const { data: dismissals } = useQuery({
    queryKey: ["integration-error-dismissals", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("integration_error_dismissals")
        .select("*")
        .eq("user_id", accountId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!accountId,
  });

  const dismissedSet = useMemo(
    () => new Set((dismissals ?? []).map((d: any) => `${d.integration_source}::${d.error_fingerprint}`)),
    [dismissals],
  );

  // Aggregate errors across sources
  const aggregated = useMemo(() => {
    const map = new Map<string, AggregatedError>();

    const ingest = (source: string, errors: any[], startedAt: string) => {
      const grouped = groupSyncErrors(errors);
      if (!grouped) return;
      for (const g of grouped.groups) {
        const fp = fingerprint(source, g.type, g.message);
        const key = `${source}::${fp}`;
        const existing = map.get(key);
        if (existing) {
          existing.count += g.count;
          if (new Date(startedAt) > new Date(existing.lastSeen)) existing.lastSeen = startedAt;
          existing.details = Array.from(new Set([...existing.details, ...(g.details ?? [])])).slice(0, 8);
        } else {
          map.set(key, {
            source,
            type: g.type,
            fingerprint: fp,
            message: g.message,
            count: g.count,
            lastSeen: startedAt,
            details: (g.details ?? []).slice(0, 8),
            transactionClass: classifyType(g.type),
          });
        }
      }
    };

    (stripeLogs ?? []).forEach((l: any) => {
      const errs: any[] = [
        ...(Array.isArray(l.errors) ? l.errors : []),
        ...(Array.isArray(l.needs_attention_details) ? l.needs_attention_details : []),
      ];
      if (errs.length) ingest("stripe", errs, l.started_at);
    });

    (qbLogs ?? []).forEach((l: any) => {
      if (l.error_message) ingest("quickbooks", [l.error_message], l.started_at);
    });

    return Array.from(map.values()).sort(
      (a, b) => b.count - a.count || new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime(),
    );
  }, [stripeLogs, qbLogs]);

  const visible = aggregated.filter((e) => {
    if (dismissedSet.has(`${e.source}::${e.fingerprint}`)) return false;
    if (sourceTab === "all") return true;
    return e.source === sourceTab;
  });

  const dismissedList = useMemo(
    () => (dismissals ?? []) as any[],
    [dismissals],
  );

  const dismissMutation = useMutation({
    mutationFn: async (payload: { err: AggregatedError; reason: string; resolution?: AIResolution | null }) => {
      if (!accountId) throw new Error("No account");
      const { error } = await supabase.from("integration_error_dismissals").upsert(
        {
          user_id: accountId,
          integration_source: payload.err.source,
          error_type: payload.err.type,
          error_fingerprint: payload.err.fingerprint,
          sample_message: payload.err.message,
          reason: payload.reason || null,
          ai_resolution: payload.resolution as any,
          dismissed_by: accountId,
        },
        { onConflict: "user_id,integration_source,error_fingerprint" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Error permanently ignored");
      setShowIgnore(false);
      setIgnoreReason("");
      setSelected(null);
      setAiResolution(null);
      qc.invalidateQueries({ queryKey: ["integration-error-dismissals"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to dismiss"),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("integration_error_dismissals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Restored to active errors");
      qc.invalidateQueries({ queryKey: ["integration-error-dismissals"] });
    },
  });

  const handleAiResolve = async () => {
    if (!selected) return;
    setAiLoading(true);
    setAiResolution(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-resolve-integration-error", {
        body: {
          integration_source: selected.source,
          error_type: selected.type,
          sample_message: selected.message,
          sample_details: selected.details,
          count: selected.count,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAiResolution((data as any)?.resolution ?? null);
    } catch (e: any) {
      toast.error(e.message ?? "AI resolution failed");
    } finally {
      setAiLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!selected) return;
    try {
      const fn = selected.source === "stripe" ? "sync-stripe-invoices" : selected.source === "quickbooks" ? "sync-quickbooks" : null;
      if (!fn) { toast.info("Retry available from the source's sync page"); return; }
      toast.info("Retry triggered");
      await supabase.functions.invoke(fn);
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message ?? "Retry failed");
    }
  };

  const loading = stripeLoading || qbLoading;
  const totalUnresolved = visible.reduce((s, e) => s + e.count, 0);
  const sourceCounts = {
    stripe: aggregated.filter((e) => e.source === "stripe" && !dismissedSet.has(`stripe::${e.fingerprint}`)).length,
    quickbooks: aggregated.filter((e) => e.source === "quickbooks" && !dismissedSet.has(`quickbooks::${e.fingerprint}`)).length,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Integration Error Center
            </CardTitle>
            <CardDescription>
              Deep dive into failed transactions across Stripe & QuickBooks. Use AI to diagnose or permanently ignore
              benign errors so they stop appearing in your sync feeds.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Bug className="h-3 w-3" /> {totalUnresolved} active
            </Badge>
            <Badge variant="outline" className="gap-1">
              <EyeOff className="h-3 w-3" /> {dismissedList.length} ignored
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={sourceTab} onValueChange={(v) => setSourceTab(v as Source)}>
          <TabsList>
            <TabsTrigger value="all">All ({visible.length})</TabsTrigger>
            <TabsTrigger value="stripe">Stripe ({sourceCounts.stripe})</TabsTrigger>
            <TabsTrigger value="quickbooks">QuickBooks ({sourceCounts.quickbooks})</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        ) : visible.length === 0 ? (
          <div className="text-center py-10 border border-dashed rounded-lg">
            <ShieldCheck className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-medium">No active integration errors</p>
            <p className="text-xs text-muted-foreground mt-1">
              {dismissedList.length > 0 ? `${dismissedList.length} errors permanently ignored.` : "All syncs are running cleanly."}
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Error Type</TableHead>
                  <TableHead className="hidden md:table-cell">Message</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="hidden md:table-cell">Last Seen</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((e) => {
                  const meta = CLASS_META[e.transactionClass];
                  const Icon = meta.icon;
                  return (
                    <TableRow key={`${e.source}::${e.fingerprint}`}>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{e.source}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs ${meta.color}`}>
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </div>
                      </TableCell>
                      <TableCell><span className="text-sm font-medium">{getErrorTypeLabel(e.type)}</span></TableCell>
                      <TableCell className="hidden md:table-cell max-w-md">
                        <p className="text-xs text-muted-foreground truncate">{e.message}</p>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{e.count}x</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(e.lastSeen), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="gap-1"
                          onClick={() => { setSelected(e); setAiResolution(null); }}>
                          Inspect <ChevronRight className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {dismissedList.length > 0 && (
          <div className="pt-2">
            <details className="group">
              <summary className="cursor-pointer text-sm text-muted-foreground flex items-center gap-1">
                <EyeOff className="h-3 w-3" /> Permanently ignored ({dismissedList.length})
              </summary>
              <div className="mt-2 border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dismissedList.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell><Badge variant="outline" className="capitalize">{d.integration_source}</Badge></TableCell>
                        <TableCell className="text-sm">{getErrorTypeLabel(d.error_type)}</TableCell>
                        <TableCell className="max-w-xs"><p className="text-xs text-muted-foreground truncate">{d.sample_message}</p></TableCell>
                        <TableCell className="max-w-xs"><p className="text-xs text-muted-foreground truncate">{d.reason || "—"}</p></TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => restoreMutation.mutate(d.id)}>Restore</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </details>
          </div>
        )}
      </CardContent>

      {/* Inspect dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setAiResolution(null); } }}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  {getErrorTypeLabel(selected.type)}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{selected.source}</Badge>
                  <Badge variant="outline">{CLASS_META[selected.transactionClass].label}</Badge>
                  <span className="text-xs">{selected.count} occurrence{selected.count !== 1 ? "s" : ""}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium mb-1">Summary</p>
                  <p className="text-sm">{selected.message}</p>
                </div>

                <div>
                  <p className="text-xs font-medium mb-1">Raw samples ({selected.details.length})</p>
                  <div className="max-h-40 overflow-auto rounded border bg-muted/40 p-2 space-y-1">
                    {selected.details.slice(0, 5).map((d, i) => (
                      <div key={i} className="text-[11px] font-mono text-muted-foreground break-all">{d}</div>
                    ))}
                  </div>
                </div>

                {aiResolution && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-800 text-sm flex items-center gap-2">
                      AI Resolution
                      {aiResolution.severity && (
                        <Badge variant="outline" className="capitalize">{aiResolution.severity} severity</Badge>
                      )}
                      {aiResolution.safe_to_ignore && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Safe to ignore</Badge>}
                      {aiResolution.auto_resolvable && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Auto-resolvable</Badge>}
                    </AlertTitle>
                    <AlertDescription className="text-sm text-blue-900 mt-2 space-y-2">
                      {aiResolution.root_cause && <p><strong>Root cause:</strong> {aiResolution.root_cause}</p>}
                      {aiResolution.user_action && <p><strong>Next step:</strong> {aiResolution.user_action}</p>}
                      {aiResolution.recommended_action && (
                        <p className="text-xs uppercase tracking-wide"><strong>Recommendation:</strong> {aiResolution.recommended_action.replace(/_/g, " ")}</p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {showIgnore && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium">Reason for permanently ignoring (optional)</p>
                    <Textarea
                      value={ignoreReason}
                      onChange={(e) => setIgnoreReason(e.target.value)}
                      placeholder="e.g. Voided invoices from Stripe should stay canceled — no action needed."
                      className="h-20"
                    />
                    <Alert className="bg-amber-50 border-amber-200">
                      <Info className="h-4 w-4 text-amber-700" />
                      <AlertDescription className="text-xs text-amber-800">
                        Ignoring hides all future occurrences of this exact error fingerprint from your active feed.
                        You can restore it any time from the "Permanently ignored" list below.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleRetry} className="gap-1">
                  <RotateCw className="h-3 w-3" /> Retry Sync
                </Button>
                <Button variant="outline" size="sm" onClick={handleAiResolve} disabled={aiLoading} className="gap-1">
                  <Sparkles className="h-3 w-3" /> {aiLoading ? "Analyzing…" : "AI Resolve"}
                </Button>
                {!showIgnore ? (
                  <Button variant="destructive" size="sm" onClick={() => setShowIgnore(true)} className="gap-1">
                    <EyeOff className="h-3 w-3" /> Permanently Ignore
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => dismissMutation.mutate({ err: selected, reason: ignoreReason, resolution: aiResolution })}
                    disabled={dismissMutation.isPending}
                    className="gap-1"
                  >
                    <EyeOff className="h-3 w-3" /> Confirm Ignore
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
