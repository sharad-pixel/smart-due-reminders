import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { useUploadClmTemplate } from "@/hooks/useClmTemplates";
import { toast } from "sonner";

const MAX_SIZE = 15 * 1024 * 1024; // 15MB for contracts
const ACCEPT = ".pdf,.docx,.doc,.txt,.md";

const TEMPLATE_TYPES = [
  { value: "MSA", label: "MSA — Master Services Agreement" },
  { value: "BAA", label: "BAA — Business Associate Agreement" },
  { value: "SLA", label: "SLA — Service Level Agreement" },
  { value: "Order Form", label: "Order Form" },
  { value: "NDA", label: "NDA — Non-Disclosure Agreement" },
  { value: "DPA", label: "DPA — Data Processing Agreement" },
  { value: "Other", label: "Other" },
];

export const TemplateUploadDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const [file, setFile] = useState<File | null>(null);
  const [templateType, setTemplateType] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const upload = useUploadClmTemplate();

  const reset = () => { setFile(null); setTemplateType(""); setName(""); setDescription(""); };

  const composedName = () => {
    const trimmed = name.trim();
    if (!templateType) return trimmed;
    if (!trimmed) return templateType;
    if (trimmed.toLowerCase().startsWith(templateType.toLowerCase())) return trimmed;
    return `${templateType} — ${trimmed}`;
  };

  const onPick = (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_SIZE) { toast.error("File must be under 15MB"); return; }
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleSubmit = async () => {
    const finalName = composedName();
    if (!file || !finalName) return;
    try {
      await upload.mutateAsync({ file, name: finalName, description });
      reset();
      onOpenChange(false);
    } catch {/* toast handled */}
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Upload Contract Template</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 cursor-pointer"
            onClick={() => document.getElementById("clm-file")?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onPick(e.dataTransfer.files[0]); }}
          >
            <input id="clm-file" type="file" className="hidden" accept={ACCEPT}
              onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
            {file ? (
              <div className="flex items-center gap-3 justify-center">
                <FileText className="h-6 w-6 text-primary" />
                <div className="text-left">
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Drop your MSA / contract template here</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT (best results: TXT or extracted text). Max 15MB.</p>
              </>
            )}
          </div>

          <div>
            <Label>Template Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Standard MSA v3" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="When should legal use this template?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!file || !name.trim() || upload.isPending}>
            {upload.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Uploading…</> : "Upload & Sectionalize"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
