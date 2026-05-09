import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Clock, Check, X, Sparkles, RotateCcw, Loader2 } from "lucide-react";
import { useInstanceRevisions, useRestoreRevision } from "@/hooks/useClmInstance";
import { InlineDiff } from "./InlineDiff";
import { formatDistanceToNow, format } from "date-fns";

const statusBadge: Record<string, { tone: string; icon: any; label: string }> = {
  pending:  { tone: "bg-amber-500/15 text-amber-700 border-amber-500/30",     icon: Clock,    label: "Pending" },
  approved: { tone: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", icon: Check,    label: "Approved" },
  rejected: { tone: "bg-rose-500/15 text-rose-700 border-rose-500/30",        icon: X,        label: "Rejected" },
  auto:     { tone: "bg-slate-500/15 text-slate-600 border-slate-500/30",     icon: Sparkles, label: "Saved" },
};

interface Props {
  instanceId: string;
  section: any;
  trigger?: React.ReactNode;
}

export const SectionVersionHistoryDialog = ({ instanceId, section, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const { data: allRevs = [], isLoading } = useInstanceRevisions(instanceId);
  const restore = useRestoreRevision(instanceId);

  const revisions = useMemo(
    () => (allRevs as any[])
      .filter((r) => r.section_id === section.id)
      .sort((a, b) => (b.version_number ?? 0) - (a.version_number ?? 0)),
    [allRevs, section.id],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = revisions.find((r: any) => r.id === selectedId) ?? revisions[0];

  return (
    <>
      {trigger ? (
        <span onClick={(e) => { e.stopPropagation(); setOpen(true); }}>{trigger}</span>
      ) : (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
          <History className="h-3.5 w-3.5 mr-1" /> History
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" /> Version history — {section.title}
            </DialogTitle>
            <DialogDescription>
              Every change is timestamped and attributable. Click a version to compare against the live section, or restore it.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : revisions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No saved versions yet. Edits to this section will appear here.
            </p>
          ) : (
            <div className="grid grid-cols-[260px_1fr] gap-4 min-h-[440px]">
              <ScrollArea className="h-[480px] pr-2">
                <div className="space-y-1.5">
                  {revisions.map((r: any, idx: number) => {
                    const meta = statusBadge[r.approval_status] || statusBadge.auto;
                    const Icon = meta.icon;
                    const isCurrent = idx === 0;
                    const active = (selected?.id ?? revisions[0].id) === r.id;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setSelectedId(r.id)}
                        className={`w-full text-left rounded-md border p-2 transition ${
                          active ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold">v{r.version_number ?? "—"}</span>
                          {isCurrent && <Badge variant="secondary" className="text-[9px] h-4">Current</Badge>}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {r.edited_by_name || "Someone"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                        </div>
                        <Badge variant="outline" className={`${meta.tone} text-[9px] h-4 mt-1`}>
                          <Icon className="h-2.5 w-2.5 mr-0.5" /> {meta.label}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="min-w-0">
                {selected && (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold">Version {selected.version_number}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {selected.edited_by_name || "Someone"} · {format(new Date(selected.created_at), "PPp")}
                        </p>
                        {selected.change_summary && (
                          <p className="text-xs italic text-foreground/80 mt-1">"{selected.change_summary}"</p>
                        )}
                      </div>
                      {revisions[0]?.id !== selected.id && (
                        <Button
                          size="sm" variant="outline"
                          disabled={restore.isPending}
                          onClick={() => restore.mutate({ revisionId: selected.id })}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Restore this version
                        </Button>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                        Change vs. previous version
                      </p>
                      <InlineDiff before={selected.previous_body ?? ""} after={selected.new_body ?? ""} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
