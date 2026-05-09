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
import { INDUSTRY_CATEGORIES } from "@/lib/clm/businessProfiles";

const MAX_SIZE = 15 * 1024 * 1024; // 15MB for contracts
const ACCEPT = ".pdf,.docx,.doc,.txt,.md";

const DOCUMENT_TYPES_BY_INDUSTRY: Record<string, string[]> = {
  saas: ["MSA", "Order Form", "SOW", "DPA", "SLA", "Amendment", "Renewal", "Change Order"],
  goods: ["Purchase Agreement", "Supply Agreement", "Sales Agreement", "Distributor Agreement", "Reseller Agreement", "Product Terms", "Warranty Terms", "Returns / Refund Terms"],
  services: ["Services Agreement", "Engagement Letter", "SOW", "Change Order", "SLA", "Retainer", "Project Agreement"],
  healthcare: ["BAA", "HIPAA Addendum", "Security Addendum", "DPA"],
  general: ["NDA", "Mutual NDA", "Vendor Agreement", "Partner Agreement", "Termination Notice", "Custom"],
};

export const TemplateUploadDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const [file, setFile] = useState<File | null>(null);
  const [industryCategory, setIndustryCategory] = useState<string>("general");
  const [documentType, setDocumentType] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const upload = useUploadClmTemplate();

  const reset = () => {
    setFile(null);
    setIndustryCategory("general");
    setDocumentType("");
    setName("");
    setDescription("");
  };

  const docTypes = DOCUMENT_TYPES_BY_INDUSTRY[industryCategory] ?? DOCUMENT_TYPES_BY_INDUSTRY.general;

  const composedName = () => {
    const trimmed = name.trim();
    if (!documentType) return trimmed;
    if (!trimmed) return documentType;
    if (trimmed.toLowerCase().startsWith(documentType.toLowerCase())) return trimmed;
    return `${documentType} — ${trimmed}`;
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
      await upload.mutateAsync({
        file,
        name: finalName,
        description,
        industry_category: industryCategory,
        document_type: documentType || undefined,
      });
      reset();
      onOpenChange(false);
    } catch {/* toast handled */}
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                <p className="text-sm font-medium">Drop your contract template here</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT (best results: TXT or extracted text). Max 15MB.</p>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Industry *</Label>
              <Select value={industryCategory} onValueChange={(v) => { setIndustryCategory(v); setDocumentType(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INDUSTRY_CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Document Type *</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {docTypes.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Template Name {documentType ? "(optional)" : "*"}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard v3, Enterprise Tier" />
            {documentType && (
              <p className="text-xs text-muted-foreground mt-1">Will be saved as: <span className="font-medium">{composedName() || documentType}</span></p>
            )}
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="When should this template be used?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!file || !composedName() || upload.isPending}>
            {upload.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Uploading…</> : "Upload & Sectionalize"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
