import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, Loader2, FileSearch, Sparkles, X, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  debtorId?: string;
  debtorName?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  label?: string;
  className?: string;
}

const ACCEPT = [".pdf", ".docx", ".txt"];
const MAX_BYTES = 25 * 1024 * 1024;

export function ContractUploadButton({
  debtorId, debtorName, variant = "default", size = "default", label = "Upload Contract (OCR)", className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
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

  const upload = useMutation({
    mutationFn: async () => {
      if (!files.length) throw new Error("Select at least one file");
      setProgress({ done: 0, total: files.length });
      const results: any[] = [];
      for (let i = 0; i < files.length; i++) {
        try {
          const r = await uploadOne(files[i]);
          results.push(r);
        } catch (e: any) {
          toast.error(`${files[i].name}: ${e.message}`);
        }
        setProgress({ done: i + 1, total: files.length });
      }
      return results;
    },
    onSuccess: (results: any[]) => {
      if (results.length) toast.success(`${results.length} contract${results.length > 1 ? "s" : ""} uploaded — extracting…`);
      qc.invalidateQueries({ queryKey: ["lc-imports"] });
      setOpen(false);
      setFiles([]);
      setProgress(null);
      Promise.allSettled(
        results.map((d: any) =>
          supabase.functions.invoke("live-contract-extract", { body: { importId: d.import.id } })
        )
      ).then(() => {
        qc.invalidateQueries({ queryKey: ["lc-imports"] });
        if (results.length === 1) {
          navigate(`/contracts/live/${results[0].import.id}`);
        } else {
          navigate(`/contracts/live`);
        }
      });
    },
    onError: (e: any) => { toast.error(e.message); setProgress(null); },
  });

  const fmtSize = (b: number) =>
    b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!upload.isPending) setOpen(o); }}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <FileSearch className="h-4 w-4 mr-2" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-primary" />
            Upload Contract for OCR
          </DialogTitle>
          <DialogDescription>
            {debtorName
              ? <>Attach a contract to <strong>{debtorName}</strong>. We'll extract renewal dates, MRR/ARR/ACV/TCV, opt-out windows, invoicing schedule, and create actionable tasks.</>
              : <>Upload a contract to extract renewal dates, MRR/ARR/ACV/TCV, opt-out windows, invoicing schedule, and create actionable tasks. You can assign it to an account in the next step.</>}
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
          onClick={() => document.getElementById("contract-upload-input")?.click()}
        >
          <input
            id="contract-upload-input"
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
          <div className="text-xs text-muted-foreground">Uploading {progress.done}/{progress.total}…</div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={upload.isPending}>Cancel</Button>
          <Button onClick={() => upload.mutate()} disabled={!files.length || upload.isPending}>
            {upload.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {upload.isPending ? "Uploading…" : `Extract ${files.length || ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
