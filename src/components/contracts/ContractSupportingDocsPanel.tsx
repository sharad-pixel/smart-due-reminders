import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FileText, Upload, Trash2, Loader2, Download, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { formatDateShort } from "@/lib/formatters";

const DOC_TYPES: { value: string; label: string }[] = [
  { value: "msa", label: "MSA" },
  { value: "dpa", label: "DPA" },
  { value: "expansion", label: "Expansion" },
  { value: "amendment", label: "Amendment" },
  { value: "sow", label: "SOW" },
  { value: "order_form", label: "Order Form" },
  { value: "nda", label: "NDA" },
  { value: "other", label: "Other" },
];

const labelFor = (v: string) => DOC_TYPES.find((d) => d.value === v)?.label || "Other";
const ACCEPT = [".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg"];
const MAX_BYTES = 25 * 1024 * 1024;

interface Props {
  importId: string;
  accountId: string;
}

export const ContractSupportingDocsPanel = ({ importId, accountId }: Props) => {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<string>("expansion");
  const [pending, setPending] = useState<File | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["lc-supporting-docs", importId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_contract_supporting_docs")
        .select("*")
        .eq("import_id", importId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
      if (!ACCEPT.includes(ext)) throw new Error("Unsupported file type");
      if (file.size > MAX_BYTES) throw new Error("Max 25MB per file");

      const path = `${accountId}/${importId}/supporting/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("live-contracts")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: { user } } = await supabase.auth.getUser();
      const { error: insErr } = await supabase
        .from("live_contract_supporting_docs")
        .insert({
          account_id: accountId,
          import_id: importId,
          uploaded_by: user?.id || null,
          doc_type: docType,
          file_name: file.name,
          storage_path: path,
          mime_type: file.type,
          file_size: file.size,
        });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success("Document attached");
      qc.invalidateQueries({ queryKey: ["lc-supporting-docs", importId] });
      setPending(null);
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (e: any) => toast.error(e.message || "Upload failed"),
  });

  const remove = useMutation({
    mutationFn: async (doc: any) => {
      try { await supabase.storage.from("live-contracts").remove([doc.storage_path]); } catch (_) { /* ignore */ }
      const { error } = await supabase
        .from("live_contract_supporting_docs")
        .delete()
        .eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["lc-supporting-docs", importId] });
    },
    onError: (e: any) => toast.error(e.message || "Delete failed"),
  });

  const downloadDoc = async (doc: any) => {
    const { data, error } = await supabase.storage
      .from("live-contracts")
      .createSignedUrl(doc.storage_path, 300);
    if (error || !data?.signedUrl) return toast.error("Could not generate link");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-primary" /> Supporting Documents
            </CardTitle>
            <CardDescription>
              Attach related agreements — MSA, DPA, expansions, amendments, SOWs.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 border rounded-md p-2 bg-muted/30">
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            ref={fileRef}
            type="file"
            accept={ACCEPT.join(",")}
            className="h-9 flex-1 min-w-[200px]"
            onChange={(e) => setPending(e.target.files?.[0] || null)}
          />
          <Button
            size="sm"
            onClick={() => pending && upload.mutate(pending)}
            disabled={!pending || upload.isPending}
          >
            {upload.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Attach
          </Button>
        </div>

        {isLoading ? (
          <div className="text-xs text-muted-foreground flex items-center gap-2 py-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </div>
        ) : data.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No supporting documents yet.
          </p>
        ) : (
          <ul className="divide-y border rounded-md">
            {data.map((doc: any) => (
              <li key={doc.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{labelFor(doc.doc_type)}</Badge>
                    <span className="font-medium truncate">{doc.file_name}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatDateShort(doc.created_at)}
                    {doc.file_size ? ` · ${(doc.file_size / 1024).toFixed(0)} KB` : ""}
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => downloadDoc(doc)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => remove.mutate(doc)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default ContractSupportingDocsPanel;
