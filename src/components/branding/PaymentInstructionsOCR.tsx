import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSearch, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MAX_UPLOAD_SIZE } from "@/lib/uploadUtils";

interface Props {
  wireValue: string;
  checkValue: string;
  onExtracted: (next: { wire?: string; check?: string }) => void;
}

const ACCEPT = ".pdf,image/png,image/jpeg,image/jpg,image/webp";

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export const PaymentInstructionsOCR = ({ wireValue, checkValue, onExtracted }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File) => {
    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error("File must be 5MB or smaller.");
      return;
    }
    setLoading(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("extract-payment-instructions", {
        body: { fileBase64, mimeType: file.type, fileName: file.name },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const wire = (data?.wire_text || "").trim();
      const check = (data?.check_text || "").trim();
      if (!wire && !check) {
        toast.warning("No payment details detected in this document.");
        return;
      }

      const next: { wire?: string; check?: string } = {};
      if (wire) {
        next.wire = wireValue?.trim()
          ? `${wireValue.trim()}\n\n${wire}`
          : wire;
      }
      if (check) {
        next.check = checkValue?.trim()
          ? `${checkValue.trim()}\n\n${check}`
          : check;
      }
      onExtracted(next);
      toast.success("Payment details extracted. Review before saving.");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to extract payment details.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-md border border-dashed bg-muted/30 p-3 flex items-center justify-between gap-3">
      <div className="text-xs text-muted-foreground">
        <p className="font-medium text-foreground">AI Smart Ingestion — Payment Docs</p>
        <p>
          Upload a voided check, bank letter, or wire instructions PDF/image. We'll extract the
          bank name, routing/account, SWIFT, and mailing address into the fields below.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
        className="shrink-0"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Extracting…
          </>
        ) : (
          <>
            <FileSearch className="h-4 w-4 mr-2" /> Upload Document
          </>
        )}
      </Button>
    </div>
  );
};

export default PaymentInstructionsOCR;
