import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, X } from "lucide-react";
import { parseErrorMessage } from "@/components/data-center/sync/syncErrorParser";

type SyncIssueEntity = "invoice" | "payment" | "customer" | "unknown";

type ParsedIssue = {
  entity: SyncIssueEntity;
  qbId?: string;
  docNumber?: string;
  error: string;
  errorType: string;
};

function normalizeError(e: unknown): string {
  return typeof e === "string" ? e : JSON.stringify(e);
}

function parseIssueFromError(error: string): ParsedIssue {
  const parsed = parseErrorMessage(error);

  const invoiceMatch = error.match(/qb_invoice_id=([^\s:]+)/i);
  const paymentMatch = error.match(/qb_payment_id=([^\s:]+)/i);
  const customerMatch = error.match(/qb_customer_id=([^\s:]+)/i);
  const docMatch = error.match(/doc=([^\s:]+)/i);

  if (invoiceMatch) {
    return {
      entity: "invoice",
      qbId: invoiceMatch[1],
      docNumber: docMatch?.[1],
      error,
      errorType: parsed.type,
    };
  }

  if (paymentMatch) {
    return {
      entity: "payment",
      qbId: paymentMatch[1],
      error,
      errorType: parsed.type,
    };
  }

  if (customerMatch) {
    return {
      entity: "customer",
      qbId: customerMatch[1],
      error,
      errorType: parsed.type,
    };
  }

  return { entity: "unknown", error, errorType: parsed.type };
}

export function SyncIssuesPanel(props: {
  sourceLabel: string;
  syncLogId: string | null;
  errors: any[] | null | undefined;
  dismissedErrors?: string[] | null;
  qbIds?: string[];
  onClearFilter?: () => void;
  onAfterIgnore?: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const dismissed = props.dismissedErrors ?? [];

  const activeErrorStrings = useMemo(() => {
    const all = (props.errors ?? []).map(normalizeError);
    return all.filter((e) => !dismissed.includes(e));
  }, [props.errors, dismissed]);

  const issues = useMemo(() => {
    const parsed = activeErrorStrings.map(parseIssueFromError);
    if (props.qbIds && props.qbIds.length > 0) {
      return parsed.filter((p) => p.qbId && props.qbIds!.includes(p.qbId));
    }
    return parsed;
  }, [activeErrorStrings, props.qbIds]);

  const qbInvoiceIds = useMemo(
    () => Array.from(new Set(issues.filter((i) => i.entity === "invoice" && i.qbId).map((i) => i.qbId!))),
    [issues]
  );
  const qbPaymentIds = useMemo(
    () => Array.from(new Set(issues.filter((i) => i.entity === "payment" && i.qbId).map((i) => i.qbId!))),
    [issues]
  );
  const qbCustomerIds = useMemo(
    () => Array.from(new Set(issues.filter((i) => i.entity === "customer" && i.qbId).map((i) => i.qbId!))),
    [issues]
  );

  const { data: invoiceMap } = useQuery({
    queryKey: ["sync-issues-invoices", qbInvoiceIds.join(",")],
    queryFn: async () => {
      if (qbInvoiceIds.length === 0) return new Map<string, { id: string; invoice_number: string | null }>();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, quickbooks_invoice_id")
        .eq("user_id", user.id)
        .in("quickbooks_invoice_id", qbInvoiceIds);

      if (error) throw error;

      const map = new Map<string, { id: string; invoice_number: string | null }>();
      (data || []).forEach((row: any) => {
        if (row.quickbooks_invoice_id) {
          map.set(String(row.quickbooks_invoice_id), { id: row.id, invoice_number: row.invoice_number ?? null });
        }
      });
      return map;
    },
    enabled: qbInvoiceIds.length > 0,
  });

  const { data: paymentMap } = useQuery({
    queryKey: ["sync-issues-payments", qbPaymentIds.join(",")],
    queryFn: async () => {
      if (qbPaymentIds.length === 0) return new Map<string, { id: string; reference: string | null }>();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Use explicit any cast to avoid TS2589 deep instantiation error
      const { data, error } = await (supabase
        .from("payments")
        .select("id, quickbooks_payment_id, reference")
        .eq("user_id", user.id) as any)
        .in("quickbooks_payment_id", qbPaymentIds);

      if (error) throw error;

      const map = new Map<string, { id: string; reference: string | null }>();
      ((data as any[]) || []).forEach((row) => {
        if (row.quickbooks_payment_id) {
          map.set(String(row.quickbooks_payment_id), { id: row.id, reference: row.reference ?? null });
        }
      });
      return map;
    },
    enabled: qbPaymentIds.length > 0,
  });

  const { data: customerMap } = useQuery({
    queryKey: ["sync-issues-customers", qbCustomerIds.join(",")],
    queryFn: async () => {
      if (qbCustomerIds.length === 0) return new Map<string, { id: string; name: string | null }>();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("debtors")
        .select("id, name, company_name, quickbooks_customer_id")
        .eq("user_id", user.id)
        .in("quickbooks_customer_id", qbCustomerIds);

      if (error) throw error;

      const map = new Map<string, { id: string; name: string | null }>();
      (data || []).forEach((row: any) => {
        if (row.quickbooks_customer_id) {
          const label = row.company_name ?? row.name ?? null;
          map.set(String(row.quickbooks_customer_id), { id: row.id, name: label });
        }
      });
      return map;
    },
    enabled: qbCustomerIds.length > 0,
  });

  const ignoreMutation = useMutation({
    mutationFn: async (errorToIgnore: string) => {
      if (!props.syncLogId) throw new Error("Missing sync log id");

      const next = Array.from(new Set([...(dismissed || []), errorToIgnore]));

      const { error } = await supabase
        .from("quickbooks_sync_log")
        .update({ dismissed_errors: next })
        .eq("id", props.syncLogId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qb-sync-log"] });
      toast({ title: "Ignored", description: "Removed from sync summary." });
      props.onAfterIgnore?.();
    },
    onError: (err: any) => {
      toast({ title: "Could not ignore", description: err.message, variant: "destructive" });
    },
  });

  const rerunSyncMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("sync-quickbooks-data", {
        body: { full_sync: false },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Sync started", description: "Re-check this list in a moment." });
    },
    onError: (err: any) => {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle className="flex items-center justify-between">
          <span>Sync issues from {props.sourceLabel}</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => rerunSyncMutation.mutate()}
              disabled={rerunSyncMutation.isPending}
              className="gap-2"
            >
              <RefreshCw className={"h-4 w-4 " + (rerunSyncMutation.isPending ? "animate-spin" : "")} />
              Re-run sync
            </Button>
            {props.onClearFilter && (
              <Button size="sm" variant="ghost" onClick={props.onClearFilter} className="gap-2">
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </AlertTitle>
        <AlertDescription>
          {activeErrorStrings.length === 0 ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>All issues are resolved or ignored for this sync run.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{activeErrorStrings.length}</Badge>
              <span>failed item{activeErrorStrings.length !== 1 ? "s" : ""} detected.</span>
            </div>
          )}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Failed transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {issues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No failed records found for the current filter.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Source ID</TableHead>
                  <TableHead>In Recouply</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue, idx) => {
                  const inLocal =
                    issue.entity === "invoice"
                      ? invoiceMap?.get(issue.qbId || "")
                      : issue.entity === "customer"
                      ? customerMap?.get(issue.qbId || "")
                      : issue.entity === "payment"
                      ? paymentMap?.get(issue.qbId || "")
                      : undefined;

                  const isIgnored = dismissed.includes(issue.error);

                  return (
                    <TableRow key={`${issue.error}-${idx}`}>
                      <TableCell className="font-medium">
                        {issue.entity === "invoice" ? "Invoice" : issue.entity === "payment" ? "Payment" : issue.entity === "customer" ? "Customer" : "Other"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-xs">{issue.qbId || "—"}</span>
                          {issue.docNumber && <span className="text-xs text-muted-foreground">Doc: {issue.docNumber}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {inLocal ? (
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {issue.entity === "invoice"
                                ? (inLocal as any).invoice_number || (issue.docNumber ? `Invoice ${issue.docNumber}` : "Invoice")
                                : issue.entity === "customer"
                                ? (inLocal as any).name || "Customer"
                                : (inLocal as any).reference || "Payment"}
                            </span>
                            <span className="text-xs text-muted-foreground">ID: {(inLocal as any).id}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not found</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{issue.error}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {inLocal && issue.entity === "invoice" && (
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/invoices/${(inLocal as any).id}`} className="gap-2 inline-flex items-center">
                                <ExternalLink className="h-4 w-4" />
                                Open
                              </Link>
                            </Button>
                          )}
                          {inLocal && issue.entity === "customer" && (
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/debtors/${(inLocal as any).id}`} className="gap-2 inline-flex items-center">
                                <ExternalLink className="h-4 w-4" />
                                Open
                              </Link>
                            </Button>
                          )}
                          {inLocal && issue.entity === "payment" && (
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/reconciliation?payment_id=${(inLocal as any).id}`} className="gap-2 inline-flex items-center">
                                <ExternalLink className="h-4 w-4" />
                                Open
                              </Link>
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!props.syncLogId || ignoreMutation.isPending || isIgnored}
                            onClick={() => ignoreMutation.mutate(issue.error)}
                          >
                            {isIgnored ? "Ignored" : "Ignore"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
