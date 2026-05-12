import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Link as LinkIcon, Sparkles, X, UserPlus, CheckCircle2 } from "lucide-react";
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
  stagingStatus: string;
  onChanged: () => void;
}

export const ContractStagingPanel = ({
  contractId,
  accountId,
  debtorId,
  contractName,
  schedules,
  stagingStatus,
  onChanged,
}: Props) => {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [watcherEmail, setWatcherEmail] = useState("");

  // Watchers
  const { data: watchers = [] } = useQuery({
    queryKey: ["contract-watchers", contractId],
    queryFn: () => fetchContractWatchers(contractId),
  });

  const stagingMutation = useMutation({
    mutationFn: async (next: "staging" | "published") => {
      const updates: any = { staging_status: next };
      if (next === "staging") updates.staging_completed_at = new Date().toISOString();
      if (next === "published") updates.published_at = new Date().toISOString();
      const { error } = await supabase
        .from("live_contract_imports")
        .update(updates)
        .eq("id", contractId);
      if (error) throw error;
    },
    onSuccess: (_d, next) => {
      toast.success(next === "published" ? "Contract published" : "Marked ready for review");
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });

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
      {/* Staging status bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Contract Staging
              <Badge variant="outline" className="ml-1 capitalize">
                {stagingStatus}
              </Badge>
            </div>
            <div className="flex gap-2">
              {stagingStatus === "draft" && (
                <Button size="sm" variant="outline" onClick={() => stagingMutation.mutate("staging")}>
                  Mark ready for review
                </Button>
              )}
              {stagingStatus !== "published" && (
                <Button size="sm" onClick={() => stagingMutation.mutate("published")}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Publish contract
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Edit extracted financial terms inline above. Publish to feed this contract into Expansion Risk and the dashboard.
        </CardContent>
      </Card>

      {/* Invoice attachment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Invoice Attachments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <OcrPricingNotice />
          {schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scheduled invoices on this contract.</p>
          ) : (
            <div className="space-y-2">
              {schedules.map((s: any) => (
                <div key={s.id} className="border rounded-md p-3 text-sm space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
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
                    {s.invoice_id ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/invoices?invoice=${s.invoice_id}`}>
                          <LinkIcon className="h-3.5 w-3.5 mr-1" /> View / edit invoice
                        </Link>
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={uploading}
                          onClick={() => {
                            setActiveScheduleId(s.id);
                            fileRef.current?.click();
                          }}
                        >
                          <Upload className="h-3.5 w-3.5 mr-1" />
                          {uploading && activeScheduleId === s.id ? "Scanning…" : "Upload + OCR"}
                        </Button>
                        <span className="text-[11px] text-muted-foreground self-center">
                          $0.75/page
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
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
            Watchers receive in-app alerts when this contract moves through staging, gets published, or has invoices attached.
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
