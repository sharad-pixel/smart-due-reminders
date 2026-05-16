import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Upload, Loader2, FileText, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ACCEPT = [".pdf", ".docx", ".txt"];
const MAX_BYTES = 25 * 1024 * 1024;

interface Props {
  importId: string;
  currentFileName?: string | null;
}

/**
 * Lets the user re-run AI extraction on the existing file, or upload a corrected
 * copy of the contract and re-extract it in place. Used on the contract detail page
 * to fix inaccuracies the AI may have introduced on the first pass.
 */
export function ContractReassessPanel({ importId, currentFileName }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "extract" | "replace">(null);

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["live-contract-detail", importId] });

  const reExtract = async () => {
    setBusy("extract");
    try {
      const { error } = await supabase.functions.invoke("live-contract-extract", {
        body: { importId },
      });
      if (error) throw error;
      toast.success("Re-scan complete — review the updated terms below.");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Re-scan failed");
    } finally {
      setBusy(null);
    }
  };

  const onPick = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const ext = "." + (f.name.split(".").pop() || "").toLowerCase();
    if (!ACCEPT.includes(ext)) return toast.error("Unsupported file type");
    if (f.size > MAX_BYTES) return toast.error("File exceeds 25MB");

    setBusy("replace");
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("import_id", importId);
      const { data, error } = await supabase.functions.invoke("live-contract-replace-file", {
        body: fd,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Replace failed");
      toast.success("File replaced — re-scanning…");
      const { error: exErr } = await supabase.functions.invoke("live-contract-extract", {
        body: { importId },
      });
      if (exErr) throw exErr;
      toast.success("Contract re-assessed with the new file.");
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "Replace failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Re-assess Contract
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          If the AI missed or misread anything, re-scan the original file or upload a
          corrected copy. Existing extracted terms, schedule, dates and risk flags will
          be replaced with the new results.
        </p>
        {currentFileName && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            Current file: <span className="font-medium text-foreground">{currentFileName}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={reExtract}
            disabled={!!busy}
          >
            {busy === "extract"
              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              : <RefreshCw className="h-4 w-4 mr-2" />}
            Re-run AI extraction
          </Button>
          <Button
            size="sm"
            onClick={onPick}
            disabled={!!busy}
          >
            {busy === "replace"
              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              : <Upload className="h-4 w-4 mr-2" />}
            Upload corrected file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT.join(",")}
            className="hidden"
            onChange={onFile}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default ContractReassessPanel;
