import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScanSearch, Loader2, RefreshCw, CheckCircle2, AlertTriangle, XCircle, FileX2, FilePlus2, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { formatCurrency, formatDateShort } from "@/lib/formatters";

type Schedule = {
  id: string;
  scheduled_date: string;
  amount: number | null;
  description: string | null;
  invoice_id: string | null;
  reconciliation_status: string | null;
  reconciliation_candidates: Array<{ invoice_id: string; score: number; reason: string }> | null;
  reconciled_at: string | null;
  completion_status: string | null;
};

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  matched:  { label: "Matched",  color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  partial:  { label: "Partial",  color: "bg-amber-50 text-amber-700 border-amber-200",       icon: AlertTriangle },
  unclear:  { label: "Unclear",  color: "bg-amber-50 text-amber-700 border-amber-200",       icon: AlertTriangle },
  missing:  { label: "Missing",  color: "bg-red-50 text-red-700 border-red-200",             icon: XCircle },
  extra:    { label: "Extra",    color: "bg-blue-50 text-blue-700 border-blue-200",          icon: FileX2 },
  pending:  { label: "Pending",  color: "bg-muted text-muted-foreground border-border",      icon: ScanSearch },
};

interface Props {
  importId: string;
  debtorId: string | null;
  staged: boolean; // staging_status === 'staging' | 'draft'
  published: boolean;
  schedules: Schedule[];
  defaultCurrency?: string;
  onChanged: () => void;
}

export const ContractReconciliationPanel = ({
  importId,
  debtorId,
  staged,
  published,
  schedules,
  defaultCurrency = "USD",
  onChanged,
}: Props) => {
  const qc = useQueryClient();

  // Live invoice list to show candidate names instead of IDs
  const { data: invoiceMap = {} } = useQuery({
    enabled: !!debtorId,
    queryKey: ["recon-invoices", debtorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, amount, total_amount, due_date, status")
        .eq("debtor_id", debtorId!)
        .eq("is_archived", false)
        .limit(500);
      return Object.fromEntries((data ?? []).map((i: any) => [i.id, i]));
    },
  });

  const summary = useMemo(() => {
    const s = { matched: 0, partial: 0, unclear: 0, missing: 0, pending: 0 };
    schedules.forEach((row) => {
      const k = (row.reconciliation_status || "pending") as keyof typeof s;
      s[k] = (s[k] ?? 0) + 1;
    });
    return s;
  }, [schedules]);

  const reconcile = useMutation({
    mutationFn: async (opts: { generateTasks?: boolean }) => {
      const { data, error } = await supabase.functions.invoke("contract-reconcile", {
        body: { importId, generateTasks: opts.generateTasks ?? false },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (d) => {
      toast.success(
        `Reconciled · ${d.summary?.matched ?? 0} matched · ${d.summary?.missing ?? 0} missing · ${d.summary?.unclear ?? 0} unclear` +
          (d.tasks_created ? ` · ${d.tasks_created} tasks created` : ""),
      );
      qc.invalidateQueries();
      onChanged();
    },
    onError: (e: any) => toast.error(e.message || "Reconcile failed"),
  });

  const linkCandidate = useMutation({
    mutationFn: async (args: { scheduleId: string; invoiceId: string }) => {
      const { error } = await supabase
        .from("contract_invoice_schedules")
        .update({
          invoice_id: args.invoiceId,
          attachment_source: "linked",
          reconciliation_status: "matched",
          completion_status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", args.scheduleId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Invoice linked"); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!debtorId) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ScanSearch className="h-4 w-4 text-primary" /> Invoice Reconciliation
          </CardTitle>
          <CardDescription>
            Link this contract to a debtor account to compare its billing schedule against existing invoices in Recouply.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalScheduled = schedules.length;
  const reconciled = totalScheduled
    ? Math.round(((summary.matched + summary.partial) / totalScheduled) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ScanSearch className="h-4 w-4 text-primary" /> Invoice Reconciliation
            </CardTitle>
            <CardDescription>
              {totalScheduled === 0
                ? "No scheduled billing rows yet — add a schedule to reconcile."
                : <>
                    {summary.matched + summary.partial} of {totalScheduled} scheduled invoices reconciled · {summary.missing} missing · {summary.unclear} unclear
                  </>
              }
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => reconcile.mutate({ generateTasks: false })}
              disabled={reconcile.isPending}
            >
              {reconcile.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Reconcile now
            </Button>
            {published && (
              <Button
                size="sm"
                onClick={() => reconcile.mutate({ generateTasks: true })}
                disabled={reconcile.isPending}
              >
                <FilePlus2 className="h-3.5 w-3.5 mr-1" />
                Reconcile + create tasks
              </Button>
            )}
          </div>
        </div>

        {totalScheduled > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${reconciled}%` }} />
            </div>
            <span className="text-muted-foreground tabular-nums w-10 text-right">{reconciled}%</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {staged && !published && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            This contract is in <b>Staging</b>. Reconciliation runs read-only — tasks for missing/unclear rows will be created automatically when you publish.
          </p>
        )}

        {totalScheduled > 0 && (
          <div className="rounded border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Best match</TableHead>
                  <TableHead className="w-32 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((row) => {
                  const status = (row.reconciliation_status || "pending") as keyof typeof STATUS_META;
                  const meta = STATUS_META[status] || STATUS_META.pending;
                  const Icon = meta.icon;
                  const cands = row.reconciliation_candidates || [];
                  const top = cands[0];
                  const topInv = top ? invoiceMap[top.invoice_id] : null;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm">{formatDateShort(row.scheduled_date)}</TableCell>
                      <TableCell className="text-sm">
                        {row.amount ? formatCurrency(Number(row.amount), defaultCurrency) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] gap-1 ${meta.color}`}>
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.invoice_id && invoiceMap[row.invoice_id] ? (
                          <Link
                            to={`/invoices/${row.invoice_id}`}
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <LinkIcon className="h-3 w-3" />
                            {invoiceMap[row.invoice_id].invoice_number}
                          </Link>
                        ) : top && topInv ? (
                          <span className="text-muted-foreground">
                            {topInv.invoice_number} ({top.score}%)
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">no candidate</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!row.invoice_id && top && (status === "partial" || status === "unclear") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7"
                            onClick={() => linkCandidate.mutate({ scheduleId: row.id, invoiceId: top.invoice_id })}
                            disabled={linkCandidate.isPending}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Confirm
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
