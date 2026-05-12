import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Link as LinkIcon, X, UserPlus, CheckCircle2, Sparkles, FilePlus2 } from "lucide-react";
import { OcrPricingNotice } from "@/components/ocr/OcrPricingNotice";
import { Link } from "react-router-dom";
import { formatCurrency, formatDateShort } from "@/lib/formatters";
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
        `OCR complete — ${data.pageCount} page${data.pageCount === 1 ? "" : "s"} · $${(data.totalCents / 100).toFixed(2)}`,
      );
      onChanged();
      qc.invalidateQueries({ queryKey: ["ocr-usage"] });
    } catch (e: any) {
      toast.error(e.message || "OCR upload failed");
    } finally {
      setUploading(false);
      setActiveScheduleId(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleGenerateRecouply = async (scheduleId: string) => {
    setBusyScheduleId(scheduleId);
    try {
      const { data, error } = await supabase.functions.invoke("live-contract-actions", {
        body: { importId: contractId, action: "generate_invoices", scheduleIds: [scheduleId] },
      });
      if (error) throw error;
      if (data?.created > 0) toast.success("Recouply invoice generated");
      else if (data?.duplicates > 0) toast.success("Linked to existing invoice");
      else toast.message("No invoice created", { description: data?.skipped?.[0]?.reason || "Check schedule details" });
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
      toast.success("Manual invoice created");
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
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/invoices/${s.invoice_id}`}>
                            <LinkIcon className="h-3.5 w-3.5 mr-1" /> View / edit invoice
                          </Link>
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            disabled={busy || uploading}
                            onClick={() => handleGenerateRecouply(s.id)}
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
                            {uploading && activeScheduleId === s.id ? "Scanning…" : "Upload + OCR"}
                          </Button>
                          <span className="text-[11px] text-muted-foreground self-center">
                            OCR $0.75/page
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
    </div>
  );
};

export default ContractStagingPanel;
