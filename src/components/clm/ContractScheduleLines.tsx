import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getInvoiceStatusColor, getInvoiceStatusLabel } from "@/lib/invoiceStatuses";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Receipt,
  Pencil,
  Package2,
  AlertCircle,
  ScanSearch,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileX2,
  FilePlus2,
  Link as LinkIcon,
  Upload,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { formatCurrency, formatDateShort } from "@/lib/formatters";
import { GenerateInvoicesDialog } from "@/components/clm/GenerateInvoicesDialog";

interface Props {
  importId: string;
  debtorId: string | null;
  staged: boolean;
  published: boolean;
  schedules: any[];
  defaultCurrency: string;
  onChanged: () => void;
}

type RevenueKind = "recurring" | "non_recurring" | "prepaid_usage" | "other";

const REVENUE_TYPE_OPTIONS: { value: RevenueKind; label: string; hint: string }[] = [
  { value: "recurring", label: "Recurring (SaaS / subscription)", hint: "Repeats on a fixed cadence — counts toward MRR/ARR." },
  { value: "non_recurring", label: "One-time", hint: "Single charge — implementation, hardware, services." },
  { value: "prepaid_usage", label: "Prepaid usage", hint: "Pre-purchased usage / credits drawn down over time." },
  { value: "other", label: "Other", hint: "Doesn't fit the categories above." },
];

const CATEGORY_OPTIONS: { value: string; label: string; revenue: RevenueKind }[] = [
  { value: "subscription", label: "Subscription (SaaS)", revenue: "recurring" },
  { value: "platform", label: "Platform fee", revenue: "recurring" },
  { value: "license", label: "License", revenue: "recurring" },
  { value: "support", label: "Support", revenue: "recurring" },
  { value: "maintenance", label: "Maintenance", revenue: "recurring" },
  { value: "usage_minimum", label: "Usage minimum / commitment", revenue: "recurring" },
  { value: "prepaid_usage", label: "Prepaid usage / credits", revenue: "prepaid_usage" },
  { value: "professional_services", label: "Professional services", revenue: "non_recurring" },
  { value: "implementation", label: "Implementation", revenue: "non_recurring" },
  { value: "onboarding", label: "Onboarding", revenue: "non_recurring" },
  { value: "training", label: "Training", revenue: "non_recurring" },
  { value: "hardware", label: "Hardware", revenue: "non_recurring" },
  { value: "other", label: "Other", revenue: "other" },
];

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  matched: { label: "Matched", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  partial: { label: "Partial", color: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertTriangle },
  unclear: { label: "Unclear", color: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertTriangle },
  missing: { label: "Missing", color: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  extra: { label: "Extra", color: "bg-blue-50 text-blue-700 border-blue-200", icon: FileX2 },
  pending: { label: "Pending", color: "bg-muted text-muted-foreground border-border", icon: ScanSearch },
};

const categoryLabel = (v: string | null | undefined) =>
  CATEGORY_OPTIONS.find((o) => o.value === v)?.label || null;

const revenueFor = (cat: string): RevenueKind =>
  CATEGORY_OPTIONS.find((o) => o.value === cat)?.revenue || "non_recurring";

const revenueBadgeClass = (rev: string | null | undefined) => {
  switch (rev) {
    case "recurring": return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    case "prepaid_usage": return "bg-violet-100 text-violet-700 border border-violet-200";
    case "non_recurring": return "bg-slate-100 text-slate-700 border border-slate-200";
    default: return "bg-amber-50 text-amber-800 border border-amber-200";
  }
};

export const ContractScheduleLines = ({
  importId,
  debtorId,
  staged,
  published,
  schedules,
  defaultCurrency,
  onChanged,
}: Props) => {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadScheduleId, setUploadScheduleId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [billingId, setBillingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    product_description: "",
    quantity: "",
    unit_price: "",
    amount: "",
    scheduled_date: "",
    expected_due_date: "",
    product_category: "",
    revenue_type: "",
  });
  const [saving, setSaving] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});

  // Live invoice list for candidate names
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

  useEffect(() => {
    const ids = schedules.map((s: any) => s.invoice_id).filter(Boolean);
    if (ids.length === 0) {
      setStatusMap({});
      return;
    }
    let cancelled = false;
    supabase
      .from("invoices")
      .select("id, status")
      .in("id", ids)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const m: Record<string, string> = {};
        data.forEach((r: any) => (m[r.id] = r.status));
        setStatusMap(m);
      });
    return () => {
      cancelled = true;
    };
  }, [schedules]);

  const summary = useMemo(() => {
    const s = { matched: 0, partial: 0, unclear: 0, missing: 0, pending: 0 };
    schedules.forEach((row: any) => {
      const k = (row.reconciliation_status || "pending") as keyof typeof s;
      s[k] = (s[k] ?? 0) + 1;
    });
    return s;
  }, [schedules]);

  const totalScheduled = schedules.length;
  const reconciledPct = totalScheduled
    ? Math.round(((summary.matched + summary.partial) / totalScheduled) * 100)
    : 0;

  const reconcile = useMutation({
    mutationFn: async (opts: { generateTasks?: boolean }) => {
      const { data, error } = await supabase.functions.invoke("contract-reconcile", {
        body: { importId, generateTasks: opts.generateTasks ?? false },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (d: any) => {
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
    onSuccess: () => {
      toast.success("Invoice linked");
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const triggerUpload = (scheduleId: string) => {
    setUploadScheduleId(scheduleId);
    fileRef.current?.click();
  };

  const handleOcrUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File exceeds 25MB");
      return;
    }
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);
      const { data, error } = await supabase.functions.invoke("ocr-invoice-upload", {
        body: {
          pdfBase64: base64,
          fileName: file.name,
          contractImportId: importId,
          scheduleId: uploadScheduleId || null,
          debtorId,
        },
      });
      if (error) throw error;
      toast.success(
        `Invoice uploaded — ${data.pageCount} page${data.pageCount === 1 ? "" : "s"} · $${(data.totalCents / 100).toFixed(2)}`,
      );
      onChanged();
      qc.invalidateQueries({ queryKey: ["ocr-usage"] });
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
      setUploadScheduleId(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const open = (s: any) => {
    const qty = s.quantity != null ? Number(s.quantity) : null;
    const up = s.unit_price != null ? Number(s.unit_price) : null;
    setCreatingNew(false);
    setEditTarget(s);
    setForm({
      product_description: s.product_description || s.description || "",
      quantity: qty != null ? String(qty) : "",
      unit_price: up != null ? String(up) : "",
      amount: s.amount != null ? String(s.amount) : "",
      scheduled_date: s.scheduled_date || "",
      expected_due_date: s.expected_due_date || "",
      product_category: s.product_category || "",
      revenue_type: s.revenue_type || "",
    });
  };

  const openCreate = () => {
    setEditTarget({ __new: true });
    setCreatingNew(true);
    setForm({
      product_description: "",
      quantity: "1",
      unit_price: "",
      amount: "",
      scheduled_date: new Date().toISOString().slice(0, 10),
      expected_due_date: "",
      product_category: "",
      revenue_type: "",
    });
  };

  const recalcAmount = (qty: string, up: string) => {
    const q = Number(qty);
    const u = Number(up);
    if (Number.isFinite(q) && Number.isFinite(u) && q > 0 && u >= 0) {
      setForm((f) => ({ ...f, quantity: qty, unit_price: up, amount: (q * u).toFixed(2) }));
    } else {
      setForm((f) => ({ ...f, quantity: qty, unit_price: up }));
    }
  };

  const setCategory = (v: string) => {
    setForm((f) => ({ ...f, product_category: v, revenue_type: revenueFor(v) }));
  };

  const addToBilling = async (scheduleId: string) => {
    if (!debtorId) {
      toast.error("Link this contract to a customer first.");
      return;
    }
    setBillingId(scheduleId);
    try {
      const { data, error } = await supabase.functions.invoke("live-contract-actions", {
        body: { importId, action: "generate_invoices", scheduleIds: [scheduleId] },
      });
      if (error) throw error;
      if (data?.created > 0) toast.success("Invoice generated from this line");
      else if (data?.duplicates > 0) toast.success("Linked to an existing invoice");
      else toast.message("No invoice created", { description: data?.skipped?.[0]?.reason || "Check the row details" });
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Failed to add to billing");
    } finally {
      setBillingId(null);
    }
  };

  const save = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const qty = form.quantity.trim() === "" ? null : Number(form.quantity);
      const up = form.unit_price.trim() === "" ? null : Number(form.unit_price);
      const amt = form.amount.trim() === "" ? null : Number(form.amount);
      const cat = form.product_category || null;
      const rev = cat ? form.revenue_type || revenueFor(cat) : form.revenue_type || null;
      const desc = form.product_description.trim();

      if (creatingNew) {
        if (!form.scheduled_date) {
          toast.error("Scheduled date is required");
          setSaving(false);
          return;
        }
        if (amt == null && (qty == null || up == null)) {
          toast.error("Provide an amount, or quantity × unit price");
          setSaving(false);
          return;
        }
        // Look up account_id from the import row (RLS-safe; user already has access).
        const { data: imp, error: impErr } = await supabase
          .from("live_contract_imports")
          .select("account_id, debtor_id")
          .eq("id", importId)
          .single();
        if (impErr) throw impErr;
        const computedAmt = amt != null ? amt : (Number(qty) * Number(up));
        const { error } = await supabase.from("contract_invoice_schedules").insert({
          account_id: imp.account_id,
          import_id: importId,
          debtor_id: imp.debtor_id ?? null,
          scheduled_date: form.scheduled_date,
          expected_due_date: form.expected_due_date || null,
          amount: computedAmt,
          quantity: qty,
          unit_price: up,
          description: desc || null,
          product_description: desc || null,
          product_category: cat,
          revenue_type: rev,
          category_source: cat ? "user" : null,
          attachment_source: "manual",
          status: "forecast",
          completion_status: "pending",
          reconciliation_status: "pending",
        } as any);
        if (error) throw error;
        toast.success("Line item added");
      } else {
        const { error } = await supabase
          .from("contract_invoice_schedules")
          .update({
            product_description: desc || null,
            description: desc || editTarget.description || null,
            quantity: qty,
            unit_price: up,
            amount: amt,
            scheduled_date: form.scheduled_date || editTarget.scheduled_date,
            expected_due_date: form.expected_due_date || null,
            product_category: cat,
            revenue_type: rev,
            category_source: cat ? "user" : null,
          } as any)
          .eq("id", editTarget.id);
        if (error) throw error;
        toast.success("Schedule line updated");
      }
      setEditTarget(null);
      setCreatingNew(false);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" /> Invoice Schedule & Reconciliation
            </CardTitle>
            <CardDescription className="mt-1">
              {totalScheduled === 0
                ? "No scheduled billing rows yet."
                : (
                  <>
                    {summary.matched + summary.partial} of {totalScheduled} reconciled · {summary.missing} missing · {summary.unclear} unclear
                  </>
                )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={openCreate}>
              <FilePlus2 className="h-3.5 w-3.5 mr-1" /> Add line item
            </Button>
            {totalScheduled > 0 && debtorId && (
              <>
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
              </>
            )}
          </div>
        </div>

        {totalScheduled > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${reconciledPct}%` }} />
            </div>
            <span className="text-muted-foreground tabular-nums w-10 text-right">{reconciledPct}%</span>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleOcrUpload(f);
          }}
        />

        {!debtorId && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mb-3">
            Link this contract to a customer to enable reconciliation and invoice upload/OCR.
          </p>
        )}

        {staged && !published && debtorId && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mb-3">
            This contract is in <b>Staging</b>. Reconciliation runs read-only — tasks for missing/unclear rows will be created when you publish.
          </p>
        )}

        {schedules.length > 0 && (() => {
          const mix: Record<string, { count: number; total: number }> = {};
          for (const s of schedules) {
            const key = s.product_category || s.revenue_type || "uncategorized";
            const amt = Number(s.amount || 0);
            if (!mix[key]) mix[key] = { count: 0, total: 0 };
            mix[key].count += 1;
            mix[key].total += amt;
          }
          const entries = Object.entries(mix).sort((a, b) => b[1].total - a[1].total);
          const hasPs = entries.some(([k]) => k === "professional_services" || k === "implementation");
          return (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium">Revenue mix:</span>
              {entries.map(([k, v]) => (
                <Badge key={k} variant="outline" className="font-normal">
                  {(CATEGORY_OPTIONS.find((c) => c.value === k)?.label) || k} · {v.count} ·{" "}
                  {v.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </Badge>
              ))}
              {!hasPs && (
                <span className="text-amber-700 inline-flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> No Professional Services line — verify the contract.
                </span>
              )}
            </div>
          );
        })()}

        {schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scheduled invoices.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase tracking-wide">
                <tr className="border-b">
                  <th className="text-left py-2 pr-3 font-medium">Description</th>
                  <th className="text-left py-2 px-2 font-medium">Category</th>
                  <th className="text-right py-2 px-2 font-medium">Qty</th>
                  <th className="text-right py-2 px-2 font-medium">Unit price</th>
                  <th className="text-right py-2 px-2 font-medium">Amount</th>
                  <th className="text-left py-2 px-2 font-medium">Scheduled</th>
                  <th className="text-left py-2 px-2 font-medium">Reconciliation</th>
                  <th className="text-left py-2 px-2 font-medium">Best match</th>
                  <th className="text-right py-2 pl-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s: any) => {
                  const desc = s.product_description || s.description || s.billing_type || "Scheduled invoice";
                  const qty = s.quantity != null ? Number(s.quantity) : null;
                  const up = s.unit_price != null ? Number(s.unit_price) : null;
                  const cat = s.product_category as string | null;
                  const rev = s.revenue_type as string | null;
                  const reconStatus = (s.reconciliation_status || "pending") as keyof typeof STATUS_META;
                  const reconMeta = STATUS_META[reconStatus] || STATUS_META.pending;
                  const ReconIcon = reconMeta.icon;
                  const cands = s.reconciliation_candidates || [];
                  const top = cands[0];
                  const topInv = top ? (invoiceMap as any)[top.invoice_id] : null;
                  const linkedInv = s.invoice_id ? (invoiceMap as any)[s.invoice_id] : null;
                  return (
                    <tr key={s.id} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-3 max-w-[280px]">
                        <div className="font-medium flex items-start gap-2">
                          <Package2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <span className="whitespace-normal break-words leading-snug">{desc}</span>
                        </div>
                        {s.invoice_id && (
                          <Link
                            to={`/invoices/${s.invoice_id}`}
                            className="text-[11px] text-primary underline hover:no-underline ml-5"
                          >
                            View invoice
                          </Link>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {cat ? (
                          <div className="space-y-0.5">
                            <Badge className={`text-[10px] ${revenueBadgeClass(rev)}`}>
                              {categoryLabel(cat)}
                            </Badge>
                            {rev && (
                              <div className="text-[10px] text-muted-foreground">
                                {REVENUE_TYPE_OPTIONS.find((o) => o.value === rev)?.label || rev}
                              </div>
                            )}
                            {s.category_source === "industry_default" && (
                              <div className="text-[10px] text-muted-foreground">industry default</div>
                            )}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                            onClick={() => open(s)}
                          >
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Pick a category
                          </Button>
                        )}
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums">
                        {qty != null ? qty : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums">
                        {up != null ? formatCurrency(up, s.currency || defaultCurrency) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums font-medium">
                        {s.amount != null
                          ? formatCurrency(Number(s.amount), s.currency || defaultCurrency)
                          : "—"}
                      </td>
                      <td className="py-2 px-2 text-xs">
                        <div>{formatDateShort(s.scheduled_date)}</div>
                        {s.expected_due_date && (
                          <Badge variant="outline" className="text-[10px] mt-1">
                            Due {formatDateShort(s.expected_due_date)}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <div className="space-y-1">
                          <Badge variant="outline" className={`text-[10px] gap-1 ${reconMeta.color}`}>
                            <ReconIcon className="h-3 w-3" />
                            {reconMeta.label}
                          </Badge>
                          {s.invoice_id && statusMap[s.invoice_id] && (
                            <Badge className={`text-[10px] block w-fit ${getInvoiceStatusColor(statusMap[s.invoice_id])}`}>
                              {getInvoiceStatusLabel(statusMap[s.invoice_id])}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-xs">
                        {linkedInv ? (
                          <Link
                            to={`/invoices/${s.invoice_id}`}
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <LinkIcon className="h-3 w-3" />
                            {linkedInv.invoice_number}
                          </Link>
                        ) : top && topInv ? (
                          <div className="space-y-1">
                            <span className="text-muted-foreground">
                              {topInv.invoice_number} ({top.score}%)
                            </span>
                            {(reconStatus === "partial" || reconStatus === "unclear") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px]"
                                onClick={() => linkCandidate.mutate({ scheduleId: s.id, invoiceId: top.invoice_id })}
                                disabled={linkCandidate.isPending}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Confirm
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">no candidate</span>
                        )}
                      </td>
                      <td className="text-right py-2 pl-2">
                        <div className="flex justify-end gap-1 flex-wrap">
                          {!s.invoice_id && debtorId && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px]"
                                onClick={() => addToBilling(s.id)}
                                disabled={billingId === s.id || !s.amount}
                                title={s.amount ? "Generate an invoice from this line" : "Add an amount before billing"}
                              >
                                {billingId === s.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <Receipt className="h-3 w-3 mr-1" />
                                    Add to billing
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px]"
                                onClick={() => triggerUpload(s.id)}
                                disabled={uploading}
                                title="Upload or OCR an invoice for this row"
                              >
                                {uploading && uploadScheduleId === s.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    Upload/OCR
                                  </>
                                )}
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => open(s)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) { setEditTarget(null); setCreatingNew(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{creatingNew ? "Add line item" : "Edit schedule line"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sl-desc">Product / service description</Label>
              <Input
                id="sl-desc"
                placeholder="e.g. Platform Fee — Annual Subscription"
                value={form.product_description}
                onChange={(e) => setForm({ ...form, product_description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sl-cat">Product category</Label>
                <Select value={form.product_category} onValueChange={setCategory}>
                  <SelectTrigger id="sl-cat">
                    <SelectValue placeholder="Pick a category…" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sl-rev">Revenue type</Label>
                <Select
                  value={form.revenue_type}
                  onValueChange={(v) => setForm({ ...form, revenue_type: v })}
                >
                  <SelectTrigger id="sl-rev">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {REVENUE_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {REVENUE_TYPE_OPTIONS.find((o) => o.value === form.revenue_type)?.hint
                    || "Recurring counts toward MRR / ARR. One-time and prepaid usage do not."}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sl-qty">Quantity</Label>
                <Input
                  id="sl-qty"
                  type="number"
                  step="0.01"
                  value={form.quantity}
                  onChange={(e) => recalcAmount(e.target.value, form.unit_price)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sl-up">Unit price</Label>
                <Input
                  id="sl-up"
                  type="number"
                  step="0.01"
                  value={form.unit_price}
                  onChange={(e) => recalcAmount(form.quantity, e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sl-amt">Amount</Label>
                <Input
                  id="sl-amt"
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sl-sched">Scheduled date</Label>
                <Input
                  id="sl-sched"
                  type="date"
                  value={form.scheduled_date}
                  onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sl-due">Expected due date</Label>
                <Input
                  id="sl-due"
                  type="date"
                  value={form.expected_due_date}
                  onChange={(e) => setForm({ ...form, expected_due_date: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditTarget(null); setCreatingNew(false); }} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : creatingNew ? "Add line" : "Save line"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ContractScheduleLines;
