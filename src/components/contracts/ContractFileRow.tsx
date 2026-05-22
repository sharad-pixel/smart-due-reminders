import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileText, Scissors, X, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  inspectPdf,
  isPdf,
  splitPdfByPages,
  shouldRecommendSplit,
  DEFAULT_SPLIT_PAGES,
  PDF_SOFT_MAX_BYTES,
  PDF_SOFT_MAX_PAGES,
  type PdfInfo,
} from "@/lib/pdfSplit";

interface Props {
  file: File;
  index: number;
  disabled?: boolean;
  /** Remove this file from the list. */
  onRemove: (index: number) => void;
  /** Replace this file with one-or-more new files (used by the splitter). */
  onReplace: (index: number, replacements: File[]) => void;
}

const fmtSize = (b: number) =>
  b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

/**
 * Row for a single staged upload. Inspects PDFs to surface page count and
 * offers an inline splitter when the file exceeds the OCR-friendly limits.
 */
export function ContractFileRow({ file, index, disabled, onRemove, onReplace }: Props) {
  const [info, setInfo] = useState<PdfInfo | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [pagesPerSegment, setPagesPerSegment] = useState<number>(DEFAULT_SPLIT_PAGES);
  const [splitting, setSplitting] = useState(false);

  useEffect(() => {
    if (!isPdf(file)) return;
    let cancelled = false;
    setInspecting(true);
    inspectPdf(file)
      .then((i) => { if (!cancelled) setInfo(i); })
      .catch(() => { /* unreadable / encrypted — show no page count */ })
      .finally(() => { if (!cancelled) setInspecting(false); });
    return () => { cancelled = true; };
  }, [file]);

  const needsSplit = shouldRecommendSplit(file, info);

  const runSplit = async () => {
    if (!isPdf(file)) return;
    const n = Math.max(1, Math.min(100, Math.floor(pagesPerSegment || DEFAULT_SPLIT_PAGES)));
    setSplitting(true);
    try {
      const segments = await splitPdfByPages(file, n);
      if (segments.length <= 1) {
        toast.message("Nothing to split — the file is already within the segment size.");
      } else {
        onReplace(index, segments);
        toast.success(`Split into ${segments.length} segments of up to ${n} pages.`);
      }
      setSplitOpen(false);
    } catch (e: any) {
      toast.error(`Couldn't split PDF: ${e?.message || e}`);
    } finally {
      setSplitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-1 border rounded px-2 py-1.5 text-sm">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="flex-1 truncate" title={file.name}>{file.name}</span>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {fmtSize(file.size)}{info ? ` • ${info.pageCount}p` : inspecting ? " • …" : ""}
        </span>

        {isPdf(file) && (
          <Popover open={splitOpen} onOpenChange={(o) => !disabled && !splitting && setSplitOpen(o)}>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                variant={needsSplit ? "secondary" : "ghost"}
                className="h-6 w-6"
                disabled={disabled || splitting}
                title="Split into segments"
              >
                {splitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Scissors className="h-3 w-3" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 space-y-2" align="end">
              <div className="text-xs font-medium">Split into segments</div>
              <div className="text-xs text-muted-foreground">
                Large or scanned PDFs scan faster as smaller chunks. Each segment becomes its own contract record you can review separately.
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={pagesPerSegment}
                  onChange={(e) => setPagesPerSegment(parseInt(e.target.value || "0", 10))}
                  className="h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-xs text-muted-foreground">pages each</span>
              </div>
              <Button size="sm" className="w-full" onClick={runSplit} disabled={splitting || !info}>
                {splitting ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Scissors className="h-3 w-3 mr-2" />}
                {info ? `Split ${info.pageCount} pages` : "Inspecting…"}
              </Button>
            </PopoverContent>
          </Popover>
        )}

        {!disabled && (
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onRemove(index)}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {needsSplit && (
        <div className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 pl-6">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            {file.size > PDF_SOFT_MAX_BYTES
              ? `Over ${(PDF_SOFT_MAX_BYTES / 1024 / 1024).toFixed(0)} MB`
              : `Over ${PDF_SOFT_MAX_PAGES} pages`}
            — splitting into segments improves OCR accuracy and avoids scan timeouts.
          </span>
        </div>
      )}
    </div>
  );
}

export default ContractFileRow;
