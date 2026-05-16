import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, Upload, Loader2, CheckCircle2, AlertTriangle, BookOpen, Trash2 } from "lucide-react";

type ComplianceDoc = {
  id: string;
  account_id: string;
  asc_standard: string;
  doc_category: string | null;
  title: string;
  file_name: string;
  storage_path: string;
  page_count: number | null;
  status: "pending" | "indexing" | "indexed" | "failed";
  error: string | null;
  summary: string | null;
  credits_charged: number | null;
  created_at: string;
};

interface Props {
  accountId: string;
  defaultStandard?: string; // "ASC 606", "ASC 842", "ALL"
}

const STANDARDS = ["ASC 606", "ASC 842", "ASC 805", "ASC 326", "ALL"];

export function ComplianceDocsManager({ accountId, defaultStandard = "ASC 606" }: Props) {
  const queryClient = useQueryClient();
  const [openUpload, setOpenUpload] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["compliance-docs", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_documents" as any)
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) as ComplianceDoc[];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["compliance-docs", accountId] });

  const remove = async (doc: ComplianceDoc) => {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    await supabase.storage.from("compliance-documents").remove([doc.storage_path]);
    const { error } = await supabase.from("compliance_documents" as any).delete().eq("id", doc.id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); refresh(); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4 text-primary" />
          Compliance Documents
          <Badge variant="outline" className="text-[10px]">{docs.length}</Badge>
        </CardTitle>
        <Button size="sm" onClick={() => setOpenUpload(true)}>
          <Upload className="h-4 w-4 mr-1" /> Upload
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Upload revenue/lease policies, SSP memos, and contract templates. We index every page (1 credit / page) and feed them into future ASC 606, ASC 842, and related assessments automatically.
        </p>

        {isLoading ? (
          <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : docs.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-6 border-2 border-dashed rounded">
            No compliance documents yet. Upload your first to power richer assessments.
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.id} className="flex items-start gap-3 border rounded p-3">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{d.title}</span>
                    <Badge variant="outline" className="text-[10px]">{d.asc_standard}</Badge>
                    {d.doc_category && <Badge variant="secondary" className="text-[10px]">{d.doc_category}</Badge>}
                    <StatusBadge status={d.status} />
                  </div>
                  {d.summary && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{d.summary}</p>}
                  {d.error && <p className="text-xs text-destructive mt-1">{d.error}</p>}
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {d.page_count ?? "?"} pages · {Number(d.credits_charged ?? 0)} credits · {new Date(d.created_at).toLocaleDateString()}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(d)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <UploadDialog
        open={openUpload}
        onOpenChange={setOpenUpload}
        accountId={accountId}
        defaultStandard={defaultStandard}
        onUploaded={refresh}
      />
    </Card>
  );
}

function StatusBadge({ status }: { status: ComplianceDoc["status"] }) {
  if (status === "indexed") return <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />Indexed</Badge>;
  if (status === "indexing") return <Badge variant="secondary" className="text-[10px]"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Indexing</Badge>;
  if (status === "failed") return <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Failed</Badge>;
  return <Badge variant="outline" className="text-[10px]">Pending</Badge>;
}

function UploadDialog({
  open, onOpenChange, accountId, defaultStandard, onUploaded,
}: { open: boolean; onOpenChange: (v: boolean) => void; accountId: string; defaultStandard: string; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [standard, setStandard] = useState(defaultStandard);
  const [busy, setBusy] = useState(false);

  const reset = () => { setFile(null); setTitle(""); setStandard(defaultStandard); };

  const submit = async () => {
    if (!file) { toast.error("Pick a file"); return; }
    if (!title.trim()) { toast.error("Title required"); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${accountId}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("compliance-documents").upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw upErr;

      const { data: doc, error: insErr } = await supabase.from("compliance_documents" as any).insert({
        account_id: accountId,
        asc_standard: standard,
        title: title.trim(),
        file_name: file.name,
        storage_path: path,
        mime_type: file.type,
        byte_size: file.size,
        status: "pending",
        uploaded_by: user.id,
      } as any).select().single();
      if (insErr) throw insErr;

      toast.success("Uploaded — indexing…");
      onOpenChange(false);
      reset();
      onUploaded();

      // Fire-and-monitor indexing
      const { error: idxErr } = await supabase.functions.invoke("asc-index-compliance-doc", {
        body: { documentId: (doc as any).id, paymentMethod: "credits" },
      });
      if (idxErr) toast.error(`Indexing failed: ${idxErr.message}`);
      else toast.success("Indexed successfully");
      onUploaded();
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Compliance Document</DialogTitle>
          <DialogDescription>
            Indexed at <strong>1 credit per page</strong>. Used as ongoing context for ASC 606 and other assessments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Revenue Recognition Policy 2026" />
          </div>
          <div>
            <Label>ASC Standard</Label>
            <Select value={standard} onValueChange={setStandard}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STANDARDS.map((s) => <SelectItem key={s} value={s}>{s === "ALL" ? "All standards (general policy)" : s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>File (PDF preferred)</Label>
            <Input type="file" accept=".pdf,.docx,.txt,.md" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file && <p className="text-xs text-muted-foreground mt-1">{file.name} — {(file.size / 1024).toFixed(0)} KB</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !file || !title.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
            Upload & Index
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
