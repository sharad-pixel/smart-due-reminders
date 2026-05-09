import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  GitBranch, MessageSquare, CheckCircle2, XCircle, Repeat, Clock, Loader2, Sparkles, ChevronRight, Filter,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useInstanceRevisions, useReviewRevision } from "@/hooks/useClmInstance";
import { canApproveRevisions, canMergeRevisions } from "@/lib/clmRoles";
import { AccessSidebar } from "./AccessSidebar";
import { InlineDiff } from "./InlineDiff";

interface Props {
  instanceId: string;
  instance: any;
  contacts: any[];
  externalAccess?: any[];
  debtors: any[];
  comments?: any[];
  sections?: any[];
  myRole?: string | null;
}

const initials = (s: string) =>
  s.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

const jumpTo = (sectionId: string) => {
  window.dispatchEvent(new CustomEvent("clm-jump-to-section", { detail: { sectionId } }));
};

export const TrackChangesAndCollaborators = ({
  instanceId, instance, contacts, externalAccess = [], debtors, comments = [], sections = [], myRole,
}: Props) => {
  const { data: revisions = [] } = useInstanceRevisions(instanceId);
  const review = useReviewRevision(instanceId);

  const canApprove = canApproveRevisions(myRole);
  const canMerge = canMergeRevisions(myRole);

  const [filter, setFilter] = useState<"all" | "pending" | "comments">("all");
  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [counterText, setCounterText] = useState("");
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const sectionMap = useMemo(() => {
    const m = new Map<string, any>();
    sections.forEach((s) => {
      m.set(s.id, s);
      if (s.section_key) m.set(`key:${s.section_key}`, s);
    });
    return m;
  }, [sections]);

  // Combined activity feed: pending/auto revisions + comments, newest first
  const items = useMemo(() => {
    const out: Array<
      | { kind: "revision"; id: string; ts: string; sectionId: string; data: any }
      | { kind: "comment"; id: string; ts: string; sectionId: string; data: any }
    > = [];

    (revisions as any[])
      .filter((r) => r.approval_status === "pending" || r.approval_status === "auto")
      .forEach((r) =>
        out.push({ kind: "revision", id: r.id, ts: r.created_at, sectionId: r.section_id, data: r })
      );

    comments.forEach((c: any) => {
      const sec = sectionMap.get(`key:${c.section_key}`);
      if (!sec) return;
      out.push({ kind: "comment", id: c.id, ts: c.created_at, sectionId: sec.id, data: c });
    });

    out.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    if (filter === "pending") return out.filter((i) => i.kind === "revision");
    if (filter === "comments") return out.filter((i) => i.kind === "comment");
    return out;
  }, [revisions, comments, sectionMap, filter]);

  const pendingCount = (revisions as any[]).filter((r) => r.approval_status === "pending").length;
  const draftCount = (revisions as any[]).filter((r) => r.approval_status === "auto").length;

  const handleAccept = (revisionId: string) =>
    review.mutate({ revisionId, decision: "approved" });

  const handleCounterSubmit = (revisionId: string) => {
    if (!counterText.trim()) return;
    review.mutate(
      { revisionId, decision: "approved", override_body: counterText, note: "Counter-proposal applied" },
      { onSuccess: () => { setCounterFor(null); setCounterText(""); } }
    );
  };

  const handleRejectSubmit = (revisionId: string) => {
    review.mutate(
      { revisionId, decision: "rejected", note: rejectNote || undefined, revertOnReject: true },
      { onSuccess: () => { setRejectFor(null); setRejectNote(""); } }
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Collaborators on top */}
      <AccessSidebar
        instanceId={instanceId}
        instance={instance}
        contacts={contacts}
        externalAccess={externalAccess}
        debtors={debtors}
      />

      {/* Track changes & comments on top (right) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="h-4 w-4" /> Track changes & comments
              </CardTitle>
              <CardDescription>
                Click a contributor's name to jump to that section.{" "}
                {canApprove
                  ? "You can accept, counter, or reject pending changes."
                  : canMerge
                    ? "You can merge edits; only Approver/Legal/Owner can sign off."
                    : "View-only — invited reviewers with the right role can act."}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {pendingCount > 0 && (
                <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px] h-5">
                  <Clock className="h-2.5 w-2.5 mr-1" />{pendingCount} pending
                </Badge>
              )}
              {draftCount > 0 && (
                <Badge variant="outline" className="bg-sky-500/15 text-sky-700 border-sky-500/30 text-[10px] h-5">
                  {draftCount} draft
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 pt-2">
            <Filter className="h-3 w-3 text-muted-foreground" />
            {(["all", "pending", "comments"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[10.5px] px-2 py-0.5 rounded-full border capitalize transition-colors ${
                  filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="rounded border border-dashed bg-muted/20 p-6 text-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">
                No {filter === "all" ? "tracked changes or comments" : filter}. Document is clean.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[280px] pr-2">
              <TooltipProvider>
                <ul className="space-y-2">
                  {items.map((item) => {
                    const sec = sectionMap.get(item.sectionId);
                    const sectionTitle = sec?.title ?? "Section";
                    const r = item.kind === "revision" ? item.data : null;
                    const c = item.kind === "comment" ? item.data : null;
                    const authorName = r?.edited_by_name || r?.edited_by_email || c?.author_name || c?.author_email || "—";
                    const isPending = r?.approval_status === "pending";

                    return (
                      <li
                        key={item.id}
                        className={`group rounded-md border bg-background p-2.5 hover:border-primary/40 transition-colors ${
                          item.kind === "revision"
                            ? isPending
                              ? "border-l-2 border-l-amber-500"
                              : "border-l-2 border-l-sky-500"
                            : "border-l-2 border-l-violet-500"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <Avatar className="h-6 w-6 shrink-0">
                            <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                              {initials(authorName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                onClick={() => jumpTo(item.sectionId)}
                                className="text-xs font-semibold hover:underline text-foreground truncate"
                                title="Jump to section"
                              >
                                {authorName}
                              </button>
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              <button
                                onClick={() => jumpTo(item.sectionId)}
                                className="text-[11px] text-muted-foreground hover:text-foreground hover:underline truncate"
                              >
                                {sectionTitle}
                              </button>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                                    {formatDistanceToNow(new Date(item.ts), { addSuffix: true })}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{format(new Date(item.ts), "PPpp")}</TooltipContent>
                              </Tooltip>
                            </div>

                            {item.kind === "revision" ? (
                              <div className="mt-1 space-y-1.5">
                                <p className="text-[10.5px] text-muted-foreground">
                                  {isPending ? (
                                    <span className="inline-flex items-center gap-1 text-amber-700">
                                      <Clock className="h-2.5 w-2.5" /> Pending review
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-sky-700">
                                      <Sparkles className="h-2.5 w-2.5" /> Private draft
                                    </span>
                                  )}
                                  {r?.change_summary ? <> · "<em>{r.change_summary}</em>"</> : null}
                                </p>

                                {isPending && (canApprove || canMerge) && (
                                  <div className="flex flex-wrap items-center gap-1 pt-1">
                                    {canApprove && (
                                      <>
                                        <Button
                                          size="sm" variant="outline"
                                          className="h-6 px-2 text-[10.5px] text-emerald-700 border-emerald-500/40 hover:bg-emerald-500/10"
                                          disabled={review.isPending}
                                          onClick={() => handleAccept(r.id)}
                                        >
                                          {review.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                                          Accept
                                        </Button>

                                        <Popover open={counterFor === r.id} onOpenChange={(o) => { if (!o) { setCounterFor(null); setCounterText(""); } }}>
                                          <PopoverTrigger asChild>
                                            <Button
                                              size="sm" variant="outline"
                                              className="h-6 px-2 text-[10.5px] text-sky-700 border-sky-500/40 hover:bg-sky-500/10"
                                              onClick={() => { setCounterFor(r.id); setCounterText(r.new_body ?? ""); }}
                                            >
                                              <Repeat className="h-3 w-3 mr-1" /> Counter
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent align="end" className="w-[420px] p-3">
                                            <p className="text-xs font-semibold mb-1">Counter-propose</p>
                                            <p className="text-[11px] text-muted-foreground mb-2">
                                              Edit the proposed text below. Saving applies your version as the accepted change.
                                            </p>
                                            <Textarea
                                              rows={8}
                                              value={counterText}
                                              onChange={(e) => setCounterText(e.target.value)}
                                              className="font-mono text-xs"
                                            />
                                            <div className="flex justify-end gap-1 mt-2">
                                              <Button size="sm" variant="ghost" onClick={() => { setCounterFor(null); setCounterText(""); }}>Cancel</Button>
                                              <Button size="sm" disabled={!counterText.trim() || review.isPending} onClick={() => handleCounterSubmit(r.id)}>
                                                {review.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                                Apply counter
                                              </Button>
                                            </div>
                                          </PopoverContent>
                                        </Popover>

                                        <Popover open={rejectFor === r.id} onOpenChange={(o) => { if (!o) { setRejectFor(null); setRejectNote(""); } }}>
                                          <PopoverTrigger asChild>
                                            <Button
                                              size="sm" variant="outline"
                                              className="h-6 px-2 text-[10.5px] text-rose-700 border-rose-500/40 hover:bg-rose-500/10"
                                              onClick={() => setRejectFor(r.id)}
                                            >
                                              <XCircle className="h-3 w-3 mr-1" /> Reject
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent align="end" className="w-[320px] p-3">
                                            <p className="text-xs font-semibold mb-1">Reject this change</p>
                                            <p className="text-[11px] text-muted-foreground mb-2">
                                              The section reverts to the prior version. Add a reason for the audit log.
                                            </p>
                                            <Textarea
                                              rows={3}
                                              value={rejectNote}
                                              onChange={(e) => setRejectNote(e.target.value)}
                                              placeholder="Optional reason"
                                              className="text-xs"
                                            />
                                            <div className="flex justify-end gap-1 mt-2">
                                              <Button size="sm" variant="ghost" onClick={() => { setRejectFor(null); setRejectNote(""); }}>Cancel</Button>
                                              <Button size="sm" variant="destructive" disabled={review.isPending} onClick={() => handleRejectSubmit(r.id)}>
                                                {review.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                                Reject &amp; revert
                                              </Button>
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      </>
                                    )}

                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10.5px] text-muted-foreground">
                                          View diff
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent align="end" className="w-[480px] p-3">
                                        <p className="text-xs font-semibold mb-2">{sectionTitle} · proposed change</p>
                                        <div className="max-h-[320px] overflow-y-auto">
                                          <InlineDiff
                                            before={r.previous_body ?? sec?.body ?? ""}
                                            after={r.new_body ?? ""}
                                            showStats={false}
                                          />
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="mt-1">
                                <div className="inline-flex items-center gap-1 text-[10.5px] text-violet-700">
                                  <MessageSquare className="h-2.5 w-2.5" /> Note
                                </div>
                                <p className="text-[12px] mt-0.5 whitespace-pre-wrap text-foreground/90 line-clamp-3">
                                  {c?.body}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </TooltipProvider>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
