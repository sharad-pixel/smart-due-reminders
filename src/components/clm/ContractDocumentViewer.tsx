import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface KeyRisk {
  title: string;
  severity?: string;
  clause?: string;
  explanation?: string;
  evidence_quote?: string;
}

interface Props {
  rawText: string | null | undefined;
  keyRisks?: KeyRisk[];
  ignoredIndices?: number[];
}

const sevBg = (s?: string) => {
  if (s === "high") return "bg-destructive/20 border-b-2 border-destructive";
  if (s === "medium") return "bg-amber-200/40 border-b-2 border-amber-500";
  return "bg-blue-200/30 border-b-2 border-blue-400";
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Match { start: number; end: number; risk: KeyRisk; index: number }

export const ContractDocumentViewer = ({ rawText, keyRisks = [], ignoredIndices = [] }: Props) => {
  const [zoom, setZoom] = useState(1);

  const segments = useMemo(() => {
    if (!rawText) return [];
    const matches: Match[] = [];
    keyRisks.forEach((r, idx) => {
      if (ignoredIndices.includes(idx)) return;
      const q = (r.evidence_quote ?? "").trim();
      if (!q || q.length < 4) return;
      // Normalize whitespace in the quote for matching
      const pattern = escapeRegExp(q).replace(/\s+/g, "\\s+");
      try {
        const re = new RegExp(pattern, "i");
        const m = re.exec(rawText);
        if (m) matches.push({ start: m.index, end: m.index + m[0].length, risk: r, index: idx });
      } catch {
        /* ignore bad regex */
      }
    });
    matches.sort((a, b) => a.start - b.start);
    // De-overlap (keep first)
    const filtered: Match[] = [];
    let last = -1;
    for (const m of matches) {
      if (m.start >= last) {
        filtered.push(m);
        last = m.end;
      }
    }
    // Build segments
    const segs: Array<{ text: string; risk?: Match }> = [];
    let cursor = 0;
    for (const m of filtered) {
      if (m.start > cursor) segs.push({ text: rawText.slice(cursor, m.start) });
      segs.push({ text: rawText.slice(m.start, m.end), risk: m });
      cursor = m.end;
    }
    if (cursor < rawText.length) segs.push({ text: rawText.slice(cursor) });
    return segs;
  }, [rawText, keyRisks, ignoredIndices]);

  const matchedCount = segments.filter((s) => s.risk).length;
  const unmatched = keyRisks.length - ignoredIndices.length - matchedCount;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Contract Document
          </CardTitle>
          <CardDescription>
            Full MSA text with risk areas highlighted.
            {keyRisks.length > 0 && (
              <span className="ml-1">
                {matchedCount} of {keyRisks.length - ignoredIndices.length} risks located in source text
                {unmatched > 0 && <span className="text-amber-600 ml-1">({unmatched} couldn't be auto-located)</span>}.
              </span>
            )}
          </CardDescription>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!rawText ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Document text not available yet — finish sectionalization first.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-3 text-xs">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-destructive/20 border-b-2 border-destructive rounded-sm" /> High</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-amber-200/40 border-b-2 border-amber-500 rounded-sm" /> Medium</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-blue-200/30 border-b-2 border-blue-400 rounded-sm" /> Low</span>
            </div>
            <div
              className="rounded border bg-background p-5 max-h-[70vh] overflow-y-auto font-serif leading-relaxed whitespace-pre-wrap"
              style={{ fontSize: `${zoom}rem` }}
            >
              {segments.map((seg, i) =>
                seg.risk ? (
                  <span
                    key={i}
                    className={cn("rounded-sm px-0.5 cursor-help", sevBg(seg.risk.risk.severity))}
                    title={`${seg.risk.risk.title}${seg.risk.risk.explanation ? ` — ${seg.risk.risk.explanation}` : ""}`}
                  >
                    {seg.text}
                    <Badge variant="outline" className="text-[10px] ml-1 align-middle bg-background/80">
                      {seg.risk.risk.title}
                    </Badge>
                  </span>
                ) : (
                  <span key={i}>{seg.text}</span>
                )
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
