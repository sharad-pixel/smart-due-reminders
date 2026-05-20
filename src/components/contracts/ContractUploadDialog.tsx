import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Loader2, FileSearch, Sparkles, X, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtorId?: string;
  debtorName?: string;
}

const ACCEPT = [".pdf", ".docx", ".txt"];
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Controlled contract upload dialog.
 * On successful scan, routes the user to the contract detail page for review/validation.
 */
export function ContractUploadDialog({ open, onOpenChange, debtorId, debtorName }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; phase: string } | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const validate = (f: File): string | null => {
    const ext = "." + (f.name.split(".").pop() || "").toLowerCase();
    if (!ACCEPT.includes(ext)) return `${f.name}: unsupported file type`;
    if (f.size > MAX_BYTES) return `${f.name}: exceeds 25MB`;
    return null;
  };

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const errors: string[] = [];
    const ok: File[] = [];
    for (const f of arr) {
      const err = validate(f);
      if (err) errors.push(err); else ok.push(f);
    }
    if (errors.length) toast.error(errors.join(" • "));
    if (ok.length) setFiles((prev) => [...prev, ...ok]);
  };

  const uploadOne = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    if (debtorId) fd.append("debtor_id", debtorId);
    const { data, error } = await supabase.functions.invoke("live-contract-upload", { body: fd });
    if (error) throw new Error(error.message || "Upload failed");
    if (!data?.success || !data?.import?.id) throw new Error(data?.error || "Upload failed");
    return data;
  };

  const reset = () => {
    setFiles([]);
    setProgress(null);
  };

  const upload = useMutation({
    mutationFn: async () => {
      if (!files.length) throw new Error("Select at least one file");
      setProgress({ done: 0, total: files.length, phase: "Uploading" });
      const results: any[] = [];
      for (let i = 0; i < files.length; i++) {
        try {
          const r = await uploadOne(files[i]);
          results.push(r);
        } catch (e: any) {
          toast.error(`${files[i].name}: ${e.message}`);
        }
        setProgress({ done: i + 1, total: files.length, phase: "Uploading" });
      }
      if (!results.length) throw new Error("All uploads failed");

      // Fire-and-forget extraction(s) — GPT-5 can take 60–90s. Navigate
      // immediately so the user watches status update on the detail page
      // instead of staring at a blocked dialog.
      for (const r of results) {
        supabase.functions
          .invoke("live-contract-extract", { body: { importId: r.import.id } })
          .then(() => qc.invalidateQueries({ queryKey: ["lc-imports"] }))
          .catch(() => {/* surfaced on detail page */});
      }
      return results;
    },
    onSuccess: (results: any[]) => {
      qc.invalidateQueries({ queryKey: ["lc-imports"] });
      onOpenChange(false);
      reset();
      if (results.length === 1) {
        toast.success("Contract uploaded — AI is extracting the terms now.");
        navigate(`/ai-ingestion/${results[0].import.id}`);
      } else {
        toast.success(`${results.length} contracts uploaded — extracting…`);
        navigate(`/ai-ingestion`);
      }
    },
    onError: (e: any) => { toast.error(e.message); setProgress(null); },
  });

  const fmtSize = (b: number) =>
    b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!upload.isPending) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-primary" />
            AI Smart Ingestion — Contract
          </DialogTitle>
          <DialogDescription>
            {debtorName
              ? <>Attach a contract to <strong>{debtorName}</strong>. We'll scan it and take you straight to a full review of MRR/ARR/ACV/TCV, invoicing schedule, key dates and risks.</>
              : <>Upload a contract. We'll scan it for MRR/ARR/ACV/TCV, invoicing schedule, key dates and risks, then take you to the review page to validate and edit the data.</>}
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragActive(false);
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
          onClick={() => document.getElementById("contract-upload-dialog-input")?.click()}
        >
          <input
            id="contract-upload-dialog-input"
            type="file"
            multiple
            accept={ACCEPT.join(",")}
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
          <div className="mx-auto h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Upload className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-medium">{dragActive ? "Drop to upload" : "Drag & drop or click to browse"}</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT • up to 25MB each</p>
        </div>

        {files.length > 0 && (
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm border rounded px-2 py-1.5">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-xs text-muted-foreground">{fmtSize(f.size)}</span>
                {!upload.isPending && (
                  <Button size="icon" variant="ghost" className="h-6 w-6"
                    onClick={() => setFiles(files.filter((_, idx) => idx !== i))}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {progress && (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            {progress.phase}
            {progress.total > 1 && ` ${progress.done}/${progress.total}`}…
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={upload.isPending}>Cancel</Button>
          <Button onClick={() => upload.mutate()} disabled={!files.length || upload.isPending}>
            {upload.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {upload.isPending ? "Scanning…" : `Scan ${files.length || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ContractUploadDialog;
