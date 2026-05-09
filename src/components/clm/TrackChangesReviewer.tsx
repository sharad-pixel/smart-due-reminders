// Google-Docs-style track changes reviewer.
// Renders the diff between previous_body and new_body as inline
// insertions/deletions, each with hover-accept/reject controls.
// Reviewer cherry-picks which changes to keep, then approves; the resulting
// merged body replaces the revision's `new_body` and triggers the
// existing "promote on approval" flow.
import { useEffect, useMemo, useState } from "react";
import { wordDiff, type DiffSegment } from "@/lib/textDiff";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Undo2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

type Decision = "pending" | "kept" | "discarded";

export interface TrackChangesReviewerHandle {
  mergedBody: string;
  unresolved: number;
  totalChanges: number;
}

export const TrackChangesReviewer = ({
  before,
  after,
  onChange,
  authorName,
}: {
  before: string;
  after: string;
  authorName?: string;
  onChange?: (h: TrackChangesReviewerHandle) => void;
}) => {
  const segs = useMemo(() => wordDiff(before ?? "", after ?? ""), [before, after]);
  // index of each non-equal segment → decision
  const initial: Record<number, Decision> = useMemo(() => {
    const o: Record<number, Decision> = {};
    segs.forEach((s, i) => {
      if (s.type !== "equal") o[i] = "pending";
    });
    return o;
  }, [segs]);
  const [decisions, setDecisions] = useState<Record<number, Decision>>(initial);

  useEffect(() => setDecisions(initial), [initial]);

  const totalChanges = Object.keys(decisions).length;
  const unresolved = Object.values(decisions).filter((d) => d === "pending").length;

  // Build merged body from current decisions.
  // pending insertions are tentatively included; pending deletions are tentatively kept (status quo).
  const mergedBody = useMemo(() => {
    let out = "";
    segs.forEach((s, i) => {
      if (s.type === "equal") {
        out += s.value;
        return;
      }
      const d = decisions[i] ?? "pending";
      if (s.type === "added") {
        // Include if kept or pending (preview shows tentative accept).
        if (d === "kept" || d === "pending") out += s.value;
      } else {
        // removed: include only if reviewer rejected the deletion (kept original)
        if (d === "discarded") out += s.value;
      }
    });
    return out;
  }, [segs, decisions]);

  useEffect(() => {
    onChange?.({ mergedBody, unresolved, totalChanges });
  }, [mergedBody, unresolved, totalChanges, onChange]);

  const setAll = (d: Decision) => {
    const next: Record<number, Decision> = {};
    Object.keys(decisions).forEach((k) => (next[Number(k)] = d));
    setDecisions(next);
  };

  const counts = useMemo(() => {
    const c = { kept: 0, discarded: 0, pending: 0 };
    Object.values(decisions).forEach((d) => (c[d] = (c[d] as number) + 1));
    return c;
  }, [decisions]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px]">
              {counts.kept} kept
            </Badge>
            <Badge variant="outline" className="bg-rose-500/10 text-rose-700 border-rose-500/30 text-[10px]">
              {counts.discarded} discarded
            </Badge>
            {counts.pending > 0 && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-[10px]">
                {counts.pending} pending
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setAll("kept")}>
              Accept all
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setAll("discarded")}>
              Reject all
            </Button>
          </div>
        </div>

        <div className="rounded border bg-muted/20 p-3 text-[13px] leading-relaxed whitespace-pre-wrap font-sans max-h-[460px] overflow-y-auto">
          {segs.length === 0 ? (
            <span className="text-muted-foreground italic">No content</span>
          ) : (
            segs.map((s, i) => <Segment key={i} seg={s} idx={i} decision={decisions[i]} setDecision={(d) => setDecisions({ ...decisions, [i]: d })} authorName={authorName} />)
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

const Segment = ({
  seg, idx, decision, setDecision, authorName,
}: {
  seg: DiffSegment; idx: number; decision?: Decision;
  setDecision: (d: Decision) => void; authorName?: string;
}) => {
  if (seg.type === "equal") return <span>{seg.value}</span>;

  const isAdded = seg.type === "added";
  const d = decision ?? "pending";
  const visible =
    isAdded ? d !== "discarded" : d === "discarded"; // deletions: if "discarded" we keep original
  const showStrikeThrough = !isAdded && d !== "discarded"; // pending or "kept" deletion → strike

  // styling
  const base = isAdded
    ? "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 underline decoration-emerald-600/60 decoration-2 underline-offset-2 rounded px-0.5"
    : "bg-rose-500/15 text-rose-900 dark:text-rose-200 line-through rounded px-0.5";
  const dim = d === "discarded" && isAdded ? "opacity-40 no-underline line-through" : "";
  const dim2 = !isAdded && d === "discarded" ? "no-underline opacity-90 bg-emerald-500/10 text-emerald-900" : "";

  const tooltipLabel = isAdded
    ? `${authorName ? `${authorName} ` : ""}added`
    : `${authorName ? `${authorName} ` : ""}deleted`;

  // hide pure visual deletion when reviewer chose to accept (i.e., remove from final)
  if (!isAdded && d !== "discarded") {
    // still render so reviewer sees what's being removed
  }

  // If this is a deletion the reviewer accepted to discard (keep original text), show as plain reverted text.
  if (!isAdded && d === "discarded") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`bg-amber-500/15 text-amber-900 rounded px-0.5 cursor-pointer`} onClick={() => setDecision("pending")}>
            {seg.value}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Deletion rejected — original kept. Click to undo.
        </TooltipContent>
      </Tooltip>
    );
  }

  // Hidden insertion (rejected) – show strikethrough faint marker so reviewer can revert
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`${base} ${dim} ${dim2} cursor-pointer group/seg relative`}>
          {seg.value}
          <span className="hidden group-hover/seg:inline-flex items-center gap-0.5 absolute -top-3 left-0 z-10 bg-background border rounded shadow-sm px-0.5 py-0.5">
            {d !== "kept" && (
              <button
                onClick={(e) => { e.stopPropagation(); setDecision("kept"); }}
                className="p-0.5 hover:bg-emerald-500/20 rounded"
                title="Accept"
              >
                <Check className="h-3 w-3 text-emerald-700" />
              </button>
            )}
            {d !== "discarded" && (
              <button
                onClick={(e) => { e.stopPropagation(); setDecision("discarded"); }}
                className="p-0.5 hover:bg-rose-500/20 rounded"
                title="Reject"
              >
                <X className="h-3 w-3 text-rose-700" />
              </button>
            )}
            {d !== "pending" && (
              <button
                onClick={(e) => { e.stopPropagation(); setDecision("pending"); }}
                className="p-0.5 hover:bg-muted rounded"
                title="Reset"
              >
                <Undo2 className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {tooltipLabel} · {d === "pending" ? "pending" : d === "kept" ? "accepted" : "rejected"}
      </TooltipContent>
    </Tooltip>
  );
};
