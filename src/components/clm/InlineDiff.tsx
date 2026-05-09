import { useMemo } from "react";
import { wordDiff, diffStats } from "@/lib/textDiff";
import { Badge } from "@/components/ui/badge";

export const InlineDiff = ({
  before, after, showStats = true, className = "",
}: { before: string; after: string; showStats?: boolean; className?: string }) => {
  const segs = useMemo(() => wordDiff(before ?? "", after ?? ""), [before, after]);
  const stats = useMemo(() => diffStats(segs), [segs]);

  return (
    <div className={className}>
      {showStats && (
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px]">
            +{stats.added} added
          </Badge>
          <Badge variant="outline" className="bg-rose-500/10 text-rose-700 border-rose-500/30 text-[10px]">
            −{stats.removed} removed
          </Badge>
        </div>
      )}
      <div className="rounded border bg-muted/20 p-3 text-[13px] leading-relaxed whitespace-pre-wrap font-sans max-h-[420px] overflow-y-auto">
        {segs.length === 0 ? (
          <span className="text-muted-foreground italic">No content</span>
        ) : (
          segs.map((s, i) => {
            if (s.type === "equal") return <span key={i}>{s.value}</span>;
            if (s.type === "added")
              return (
                <span
                  key={i}
                  className="bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 rounded px-0.5"
                >
                  {s.value}
                </span>
              );
            return (
              <span
                key={i}
                className="bg-rose-500/20 text-rose-900 dark:text-rose-200 line-through rounded px-0.5"
              >
                {s.value}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
};
