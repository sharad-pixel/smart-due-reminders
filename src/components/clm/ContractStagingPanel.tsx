import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Upload, Link as LinkIcon, X, UserPlus, CheckCircle2, Sparkles, FilePlus2, Pencil, Trash2 } from "lucide-react";
import { OcrPricingNotice } from "@/components/ocr/OcrPricingNotice";
import { Link } from "react-router-dom";
import { formatCurrency, formatDateShort } from "@/lib/formatters";
import { GenerateInvoicesDialog } from "@/components/clm/GenerateInvoicesDialog";
import { useStripeConnected } from "@/hooks/useStripeConnected";
import { Checkbox } from "@/components/ui/checkbox";
import {
  fetchContractWatchers,
  addContractWatcher,
  removeContractWatcher,
} from "@/lib/supabase/contractWatchers";

interface Props {
  contractId: string;
  accountId: string;
  debtorId: string | null;
  contractName: string | null;
  schedules: any[];
  /** @deprecated kept for backward compatibility — staging happens at extraction time */
  stagingStatus?: string;
  onChanged: () => void;
}

export const ContractStagingPanel = ({
  contractId,
  accountId,
  debtorId,
  contractName,
  schedules,
  onChanged,
}: Props) => {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const [busyScheduleId, setBusyScheduleId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [watcherEmail, setWatcherEmail] = useState("");
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<{ invoice_number: string; amount: string; issue_date: string; due_date: string }>({ invoice_number: "", amount: "", issue_date: "", due_date: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { connected: stripeConnected } = useStripeConnected();
  const [pushToStripe, setPushToStripe] = useState(true);
  const [finalizeStripe, setFinalizeStripe] = useState(false);

  const pushInvoiceToStripe = async (invoiceId: string) => {
    if (!stripeConnected || !pushToStripe) return;
    try {
      const { error } = await supabase.functions.invoke("push-invoice-to-stripe", {
        body: { invoice_id: invoiceId, finalize: finalizeStripe },
      });
      if (error) throw error;
      toast.success(finalizeStripe ? "Invoice pushed & finalized in Stripe" : "Invoice pushed as Stripe draft");
    } catch (e: any) {
      toast.error(`Stripe push failed: ${e.message ?? "unknown error"}`);
    }
  };

  const { data: watchers = [] } = useQuery({
    queryKey: ["contract-watchers", contractId],
    queryFn: () => fetchContractWatchers(contractId),
  });

  const completed = schedules.filter((s: any) => !!s.invoice_id).length;
  const total = schedules.length;

  const handleOcrUpload = async (file: File, scheduleId?: string | null) => {
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
          contractImportId: contractId,
          scheduleId: scheduleId || null,
          debtorId,
        },
      });
      if (error) throw error;
      toast.success(
        `AI Smart Ingestion complete — ${data.pageCount} page${data.pageCount === 1 ? "" : "s"} · $${(data.totalCents / 100).toFixed(2)}`,
      );
      onChanged();
      qc.invalidateQueries({ queryKey: ["ocr-usage"] });
    } catch (e: any) {
      toast.error(e.message || "AI Smart Ingestion upload failed");
    } finally {
      setUploading(false);
      setActiveScheduleId(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const [genDialogSchedule, setGenDialogSchedule] = useState<any | null>(null);

  const handleGenerateRecouply = (schedule: any) => {
    setGenDialogSchedule(schedule);
  };

  const confirmGenerateRecouply = async (postingState: "draft" | "posted") => {
    if (!genDialogSchedule) return;
    const scheduleId = genDialogSchedule.id;
    setBusyScheduleId(scheduleId);
    try {
      const { data, error } = await supabase.functions.invoke("live-contract-actions", {
        body: { importId: contractId, action: "generate_invoices", scheduleIds: [scheduleId], postingState },
      });
      if (error) throw error;
      const label = data?.postingState === "posted" ? "Posted" : "Draft";
      if (data?.created > 0) toast.success(`${label} Recouply invoice generated`);
      else if (data?.duplicates > 0) toast.success("Linked to existing invoice");
      else toast.message("No invoice created", { description: data?.skipped?.[0]?.reason || "Check schedule details" });
      setGenDialogSchedule(null);
      // Push to Stripe if enabled: look up invoice_id from schedule row
      if (stripeConnected && pushToStripe && data?.created > 0) {
        const { data: sched } = await supabase
          .from("contract_invoice_schedules")
          .select("invoice_id")
          .eq("id", scheduleId)
          .maybeSingle();
        if (sched?.invoice_id) await pushInvoiceToStripe(sched.invoice_id);
      }
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Failed to generate invoice");
    } finally {
      setBusyScheduleId(null);
    }
  };

  const handleCreateManual = async (s: any) => {
    if (!debtorId) {
      toast.error("Attach a customer to this contract first");
      return;
    }
    setBusyScheduleId(s.id);
    try {
      const issue = s.scheduled_date as string;
      const due = (s.expected_due_date as string) || issue;
      const ymd = new Date(issue).toISOString().slice(0, 10).replace(/-/g, "");
      const rand4 = Math.random().toString(36).slice(2, 6).toUpperCase();
      const refId = `REC-${ymd}-${rand4}`;
      const invNum = `REC-${ymd}-${rand4}`;
      const amount = Number(s.amount) || 0;

      // Pre-insert duplicate check
      const { data: dupes } = await supabase
        .from("invoices")
        .select("id, invoice_number")
        .eq("debtor_id", debtorId)
        .eq("issue_date", issue)
        .eq("amount", amount)
        .limit(1);

      const { data: inv, error } = await supabase
        .from("invoices")
        .insert({
          user_id: accountId,
          debtor_id: debtorId,
          invoice_number: invNum,
          reference_id: refId,
          amount,
          subtotal: amount,
          total_amount: amount,
          amount_outstanding: amount,
          amount_original: amount,
          currency: s.currency || "USD",
          issue_date: issue,
          due_date: due,
          status: "Open",
          source_system: "manual",
          source_origin: "manual_from_contract",
          source_contract_id: contractId,
          source_contract_schedule_id: s.id,
          payment_terms: s.payment_terms || null,
          product_description: s.description || contractName || "Contract billing",
          notes: `Manually created from contract: ${contractName || ""}`,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      await supabase
        .from("contract_invoice_schedules")
        .update({
          invoice_id: inv.id,
          invoice_created_at: new Date().toISOString(),
          status: "invoice_created",
          attachment_source: "manual",
        } as any)
        .eq("id", s.id);

      // Audit trail
      const auditRows = [
        { field_name: "amount", source_value: String(s.amount), applied_value: String(amount) },
        { field_name: "issue_date", source_value: issue, applied_value: issue },
        { field_name: "due_date", source_value: due, applied_value: due },
        { field_name: "currency", source_value: s.currency || "USD", applied_value: s.currency || "USD" },
        { field_name: "invoice_number", source_value: invNum, applied_value: invNum },
      ].map((r) => ({
        ...r,
        invoice_id: inv.id,
        user_id: accountId,
        source_type: "manual",
        source_contract_id: contractId,
        source_schedule_id: s.id,
        source_reference: contractName || null,
        duplicate_of_invoice_id: dupes && dupes.length > 0 ? dupes[0].id : null,
        notes: dupes && dupes.length > 0 ? `Possible duplicate of invoice ${dupes[0].invoice_number}` : null,
      }));
      await supabase.from("invoice_data_audit").insert(auditRows as any);
      toast.success("Manual invoice created");
      await pushInvoiceToStripe(inv.id);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Failed to create invoice");
    } finally {
      setBusyScheduleId(null);
    }
  };

  const addWatcher = async () => {
    if (!watcherEmail.trim()) return;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("email", watcherEmail.trim().toLowerCase())
        .maybeSingle();
      if (!profile) {
        toast.error("No teammate found with that email");
        return;
      }
      const me = (await supabase.auth.getUser()).data.user;
      await addContractWatcher({
        contractId,
        accountId,
        userId: profile.id,
        addedBy: me?.id || profile.id,
      });
      setWatcherEmail("");
      qc.invalidateQueries({ queryKey: ["contract-watchers", contractId] });
      toast.success("Watcher added");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openEdit = async (s: any) => {
    if (!s.invoice_id) return;
    const { data: inv, error } = await supabase
      .from("invoices")
      .select("id, invoice_number, amount, issue_date, due_date")
      .eq("id", s.invoice_id)
      .maybeSingle();
    if (error || !inv) {
      toast.error("Could not load invoice");
      return;
    }
    setEditTarget({ schedule: s, invoice: inv });
    setEditForm({
      invoice_number: inv.invoice_number || "",
      amount: String(inv.amount ?? ""),
      issue_date: inv.issue_date || "",
      due_date: inv.due_date || "",
    });
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    const amt = Number(editForm.amount);
    if (!editForm.invoice_number.trim() || !Number.isFinite(amt) || amt <= 0) {
      toast.error("Invoice number and a positive amount are required");
      return;
    }
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("invoices")
        .update({
          invoice_number: editForm.invoice_number.trim(),
          amount: amt,
          subtotal: amt,
          total_amount: amt,
          amount_outstanding: amt,
          amount_original: amt,
          issue_date: editForm.issue_date || null,
          due_date: editForm.due_date || null,
        } as any)
        .eq("id", editTarget.invoice.id);
      if (error) throw error;
      toast.success("Invoice updated");
      setEditTarget(null);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Failed to update invoice");
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const invoiceId = deleteTarget.invoice_id;
      await supabase
        .from("contract_invoice_schedules")
        .update({ invoice_id: null, invoice_created_at: null, status: "pending", attachment_source: null } as any)
        .eq("id", deleteTarget.id);
      const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
      if (error) throw error;
      toast.success("Invoice deleted · schedule reset");
      setDeleteTarget(null);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete invoice");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Invoicing actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span>Invoicing Schedule</span>
            {total > 0 && (
              <Badge variant="outline" className="text-xs">
                {completed}/{total} invoiced
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <OcrPricingNotice />
          {schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scheduled invoices on this contract.</p>
          ) : (
            <div className="space-y-2">
              {schedules.map((s: any) => {
                const done = !!s.invoice_id;
                const busy = busyScheduleId === s.id;
                return (
                  <div key={s.id} className="border rounded-md p-3 text-sm space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center gap-2">
                          {done && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
                          {s.description || s.billing_type || "Scheduled invoice"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateShort(s.scheduled_date)}
                          {s.attachment_source && (
                            <Badge variant="outline" className="ml-2 text-[10px] capitalize">
                              {s.attachment_source}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="font-medium shrink-0">
                        {s.amount != null ? formatCurrency(Number(s.amount), s.currency || "USD") : "—"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {done ? (
                        <>
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/invoices/${s.invoice_id}`}>
                              <LinkIcon className="h-3.5 w-3.5 mr-1" /> Open
                            </Link>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(s)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            disabled={busy || uploading}
                            onClick={() => handleGenerateRecouply(s)}
                          >
                            <Sparkles className="h-3.5 w-3.5 mr-1" />
                            {busy ? "Generating…" : "Issue via Recouply"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy || uploading}
                            onClick={() => handleCreateManual(s)}
                          >
                            <FilePlus2 className="h-3.5 w-3.5 mr-1" /> Create manual
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={uploading || busy}
                            onClick={() => {
                              setActiveScheduleId(s.id);
                              fileRef.current?.click();
                            }}
                          >
                            <Upload className="h-3.5 w-3.5 mr-1" />
                            {uploading && activeScheduleId === s.id ? "Scanning…" : "Upload + AI Smart Ingestion"}
                          </Button>
                          <span className="text-[11px] text-muted-foreground self-center">
                            AI Smart Ingestion · 1 credit/page
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleOcrUpload(f, activeScheduleId);
            }}
          />
        </CardContent>
      </Card>

      {/* Watchers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" /> Alert Watchers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Watchers receive in-app alerts when invoices are generated or attached on this contract.
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="teammate@company.com"
              value={watcherEmail}
              onChange={(e) => setWatcherEmail(e.target.value)}
            />
            <Button size="sm" onClick={addWatcher} disabled={!watcherEmail.trim()}>
              Add
            </Button>
          </div>
          {watchers.length > 0 && (
            <div className="space-y-1">
              {watchers.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between border rounded-md px-3 py-1.5 text-xs"
                >
                  <span className="font-mono">{w.user_id.slice(0, 8)}…</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await removeContractWatcher(w.id);
                      qc.invalidateQueries({ queryKey: ["contract-watchers", contractId] });
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit invoice dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-invnum">Invoice number</Label>
              <Input
                id="edit-invnum"
                value={editForm.invoice_number}
                onChange={(e) => setEditForm({ ...editForm, invoice_number: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-amount">Amount</Label>
              <Input
                id="edit-amount"
                type="number"
                step="0.01"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-issue">Issue date</Label>
                <Input
                  id="edit-issue"
                  type="date"
                  value={editForm.issue_date}
                  onChange={(e) => setEditForm({ ...editForm, issue_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-due">Due date</Label>
                <Input
                  id="edit-due"
                  type="date"
                  value={editForm.due_date}
                  onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete invoice confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              The invoice will be permanently removed and the schedule line will be reset so you can re-issue it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete invoice"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <GenerateInvoicesDialog
        open={!!genDialogSchedule}
        onOpenChange={(v) => !v && setGenDialogSchedule(null)}
        schedules={genDialogSchedule ? [genDialogSchedule] : []}
        submitting={!!busyScheduleId}
        onConfirm={confirmGenerateRecouply}
      />
    </div>
  );
};

export default ContractStagingPanel;
