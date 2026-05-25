import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Props {
  importId: string;
  debtorId: string | null;
}

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || "");
      const idx = res.indexOf(",");
      resolve(idx >= 0 ? res.slice(idx + 1) : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const ContractInvoiceRecapture = ({ importId, debtorId }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [lastInvoiceId, setLastInvoiceId] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!debtorId) {
      toast.error("Assign this contract to a customer first.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File must be under 25MB");
      return;
    }
    setBusy(true);
    setLastInvoiceId(null);
    try {
      const pdfBase64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("ocr-invoice-upload", {
        body: {
          pdfBase64,
          fileName: file.name,
          contractImportId: importId,
          debtorId,
          createInvoice: true,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const invId = (data as any)?.invoiceId;
      if (invId) {
        setLastInvoiceId(invId);
        toast.success("Invoice recaptured — AI collections workflow activated.");
      } else {
        toast.success("Invoice scanned. Review extracted data in the contract feed.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Recapture failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" /> Recapture Source-System Invoice
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Upload an invoice issued from your billing system (PDF). Recouply.ai will OCR it,
          create the matching invoice record on this contract's customer, and start the AI
          collections + outreach workflow automatically.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button onClick={() => inputRef.current?.click()} disabled={busy || !debtorId}>
            {busy ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scanning…</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" /> Upload invoice</>
            )}
          </Button>
          {!debtorId && (
            <span className="text-xs text-amber-700">Assign a customer to this contract first.</span>
          )}
          {lastInvoiceId && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/invoices?invoice=${lastInvoiceId}`}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                View captured invoice
                <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Each page consumes 1 Smart Ingestion credit. Duplicates are detected automatically.
        </p>
      </CardContent>
    </Card>
  );
};

export default ContractInvoiceRecapture;
