import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDocuments, useUploadDocument } from "@/hooks/useDocuments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

export default function InvoicePaymentDocuments({ invoiceId, debtorId }: { invoiceId: string; debtorId: string }) {
  const cache = useQueryClient();
  const upload = useUploadDocument();
  const { data: available = [] } = useDocuments();
  const [documentId, setDocumentId] = useState("");
  const [category, setCategory] = useState("WIRE");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: attachments = [], error: loadError } = useQuery({
    queryKey: ["invoice-payment-documents", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoice_document_attachments").select("document_id,documents(id,file_name,file_url,category)").eq("invoice_id", invoiceId);
      if (error) throw error;
      return data ?? [];
    },
  });
  const refresh = () => cache.invalidateQueries({ queryKey: ["invoice-payment-documents", invoiceId] });
  const attach = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Please sign in again");
    const { error } = await supabase.from("invoice_document_attachments").insert({ invoice_id: invoiceId, document_id: id, created_by: user.id });
    if (error && error.code !== "23505") throw error;
    await refresh();
  };
  const save = async (newFile: boolean) => {
    setBusy(true);
    try {
      if (newFile) {
        if (!file) return;
        const doc = await upload.mutateAsync({ file, category, debtorId });
        await attach(doc.id);
        setFile(null);
      } else { await attach(documentId); setDocumentId(""); }
      toast.success("Payment document attached to invoice");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to attach document"); }
    finally { setBusy(false); }
  };
  const options = available.filter(d => ["WIRE", "ACH", "BANKING_INFO", "OTHER"].includes(d.category) && !["rejected", "expired"].includes(d.status) && !attachments.some(a => a.document_id === d.id));
  return <Card>
    <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Paperclip className="h-4 w-4" />Payment Documents</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-xs text-muted-foreground">Attached files are shared with anyone who has this invoice’s Recouply link. They are not sent to Stripe or other connected systems.</p>
      {loadError && <p className="text-sm text-destructive">Unable to load attachments.</p>}
      {attachments.map(a => a.documents && <div key={a.document_id} className="flex items-center gap-2 border-b pb-2">
        <span className="text-sm break-words min-w-0 flex-1">{a.documents.file_name}</span>
        <Button size="icon" variant="ghost" aria-label={`Download ${a.documents.file_name}`} onClick={async () => {
          if (!a.documents) return;
          const { data, error } = await supabase.storage.from("documents").download(a.documents.file_url);
          if (error) { toast.error(error.message); return; }
          const url = URL.createObjectURL(data); const link = document.createElement("a"); link.href = url; link.download = a.documents.file_name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}><Download className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" aria-label={`Detach ${a.documents.file_name}`} disabled={busy} onClick={async () => {
          const { error } = await supabase.from("invoice_document_attachments").delete().eq("invoice_id", invoiceId).eq("document_id", a.document_id);
          if (error) toast.error(error.message); else await refresh();
        }}><X className="h-4 w-4" /></Button>
      </div>)}
      <div className="space-y-2">
        <Label>Existing payment document</Label>
        <Select value={documentId} onValueChange={setDocumentId}><SelectTrigger><SelectValue placeholder="Select document" /></SelectTrigger><SelectContent>{options.map(d => <SelectItem key={d.id} value={d.id}>{d.file_name}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" size="sm" disabled={!documentId || busy} onClick={() => save(false)}><Paperclip className="h-4 w-4 mr-2" />Attach Selected</Button>
      </div>
      <div className="space-y-2 border-t pt-3">
        <Label htmlFor={`payment-file-${invoiceId}`}>New payment document</Label>
        <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="WIRE">Wire Instructions</SelectItem><SelectItem value="ACH">ACH Details</SelectItem><SelectItem value="BANKING_INFO">Banking Information</SelectItem><SelectItem value="OTHER">Other Payment Details</SelectItem></SelectContent></Select>
        <Input id={`payment-file-${invoiceId}`} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt,.csv" onChange={e => setFile(e.target.files?.[0] ?? null)} disabled={busy} />
        <p className="text-xs text-muted-foreground">Maximum 5MB per file.</p>
        <Button size="sm" disabled={!file || busy} onClick={() => save(true)}><Paperclip className="h-4 w-4 mr-2" />{busy ? "Attaching…" : "Upload & Attach"}</Button>
      </div>
    </CardContent>
  </Card>;
}