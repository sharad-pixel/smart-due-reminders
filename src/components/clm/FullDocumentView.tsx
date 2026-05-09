import { useMemo, useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { Clock, CheckCircle2, MessageSquare, History, Pencil, GitBranch, X, User, StickyNote, Loader2, FileEdit } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { InlineDiff } from "./InlineDiff";
import { useInstanceRevisions, useAddSectionComment } from "@/hooks/useClmInstance";
import { SectionEditDialog } from "./SectionEditDialog";
import { SectionVersionHistoryDialog } from "./SectionVersionHistoryDialog";
import { canCommentOnRevisions } from "@/lib/clmRoles";
import { MentionTextarea, renderMentionedBody, type MentionPerson } from "./MentionTextarea";

interface Props {
  instanceId?: string;
  sections: any[];
  title?: string;
  description?: string;
  contacts?: any[];
  externalAccess?: any[];
  comments?: any[];
  canEdit?: boolean;
  myRole?: string | null;
}

const initials = (s: string) => s.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

export const FullDocumentView = ({
  instanceId, sections, title, description, contacts = [], externalAccess = [], comments = [], canEdit = false, myRole,
}: Props) => {
  const { data: revisions = [] } = useInstanceRevisions(instanceId ?? "");
  const addComment = useAddSectionComment(instanceId ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [noteOpenFor, setNoteOpenFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const trackedBySection = useMemo(() => {
    const m = new Map<string, any[]>();
    if (!instanceId) return m;
    (revisions as any[])
      .filter((r) => r.approval_status === "pending" || r.approval_status === "auto")
      .forEach((r) => {
        const arr = m.get(r.section_id) ?? [];
        arr.push(r);
        m.set(r.section_id, arr);
      });
    m.forEach((arr) => arr.sort((a, b) => (b.version_number ?? 0) - (a.version_number ?? 0)));
    return m;
  }, [revisions, instanceId]);

  const currentVersionBySection = useMemo(() => {
    const m = new Map<string, number>();
    (revisions as any[]).forEach((r) => {
      const v = r.version_number ?? 0;
      if (v > (m.get(r.section_id) ?? 0)) m.set(r.section_id, v);
    });
    return m;
  }, [revisions]);

  const mentionPeople = useMemo<MentionPerson[]>(() => {
    const out: MentionPerson[] = [];
    contacts.forEach((c: any) => out.push({ name: c.name ?? c.full_name ?? null, email: c.email ?? null, role: c.role ?? null }));
    externalAccess.forEach((a: any) => {
      if (a.revoked_at) return;
      out.push({ name: a.name ?? a.full_name ?? null, email: a.email ?? null, role: a.role ?? null });
    });
    return out;
  }, [contacts, externalAccess]);

  const commentsBySection = useMemo(() => {
    const m = new Map<string, any[]>();
    comments.forEach((c: any) => {
      const arr = m.get(c.section_key) ?? [];
      arr.push(c);
      m.set(c.section_key, arr);
    });
    return m;
  }, [comments]);

  // All revisions (drafts + pending + approved + reverted) per section, for change-log
  const changeLogBySection = useMemo(() => {
    const m = new Map<string, any[]>();
    (revisions as any[]).forEach((r) => {
      const arr = m.get(r.section_id) ?? [];
      arr.push(r);
      m.set(r.section_id, arr);
    });
    m.forEach((arr) => arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    return m;
  }, [revisions]);

  const scrollToSection = (id: string) => {
    setSelectedId(id);
    setFlashId(id);
    const el = sectionRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setFlashId((f) => (f === id ? null : f)), 2200);
  };

  // Listen for cross-component jump events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.sectionId) scrollToSection(detail.sectionId);
    };
    window.addEventListener("clm-jump-to-section", handler as EventListener);
    return () => window.removeEventListener("clm-jump-to-section", handler as EventListener);
  }, []);

  // Click-away to deselect
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-clm-section]") && !target.closest("[role='dialog']") && !target.closest("[data-radix-popper-content-wrapper]")) {
        setSelectedId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const canComment = canCommentOnRevisions(myRole) || canEdit;

  const submitNote = (sectionKey: string) => {
    if (!noteText.trim()) return;
    addComment.mutate(
      { section_key: sectionKey, body: noteText.trim() },
      { onSuccess: () => { setNoteOpenFor(null); setNoteText(""); } }
    );
  };

  if (sections.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No sections to display.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {title ?? "Full document"}
          <Badge variant="outline" className="text-[10px] font-normal">
            <GitBranch className="h-2.5 w-2.5 mr-1" /> Track changes
          </Badge>
        </CardTitle>
        <CardDescription>
          {description ?? "Click a section to reveal its action menu — edit, view versions, or add a note. Pending changes appear inline as redlines."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="rounded border bg-background max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-8 sm:px-12 sm:py-12 space-y-6 max-w-[920px] mx-auto">
              {sections.map((s: any, idx: number) => {
                const tracked = trackedBySection.get(s.id) ?? [];
                const pendingCount = tracked.filter((r) => r.approval_status === "pending").length;
                const draftCount = tracked.filter((r) => r.approval_status === "auto").length;
                const latestTracked = tracked[0];
                const isLatestDraft = latestTracked?.approval_status === "auto";
                const version = currentVersionBySection.get(s.id) ?? 1;
                const sectionComments = commentsBySection.get(s.section_key) ?? [];
                const isSelected = selectedId === s.id;
                const isFlashing = flashId === s.id;

                return (
                  <section
                    key={s.id}
                    data-clm-section={s.id}
                    ref={(el) => { sectionRefs.current[s.id] = el; }}
                    onClick={() => setSelectedId(s.id)}
                    className={`relative space-y-2 rounded-md p-4 -mx-3 cursor-pointer transition-all ${
                      isSelected
                        ? "bg-primary/5 ring-2 ring-primary/40 shadow-sm"
                        : isFlashing
                          ? "bg-amber-500/10 ring-2 ring-amber-500/50"
                          : "hover:bg-muted/30"
                    }`}
                  >
                    {/* Floating action toolbar shown when section is selected */}
                    {isSelected && (
                      <div
                        className="absolute -top-4 right-2 z-10 flex items-center gap-0.5 rounded-md border bg-popover shadow-md px-1 py-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canEdit && instanceId && (
                          <SectionEditDialog
                            instanceId={instanceId}
                            section={s}
                            currentVersion={version}
                            contacts={contacts}
                            trigger={
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                <Pencil className="h-3 w-3 mr-1" /> Edit
                              </Button>
                            }
                          />
                        )}
                        {instanceId && (
                          <SectionVersionHistoryDialog
                            instanceId={instanceId}
                            section={s}
                            trigger={
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                <History className="h-3 w-3 mr-1" /> Versions
                              </Button>
                            }
                          />
                        )}
                        {canComment && instanceId && (
                          <Popover
                            open={noteOpenFor === s.id}
                            onOpenChange={(o) => { if (o) { setNoteOpenFor(s.id); setNoteText(""); } else { setNoteOpenFor(null); setNoteText(""); } }}
                          >
                            <PopoverTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                <StickyNote className="h-3 w-3 mr-1" /> Add note
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-[340px] p-3" onClick={(e) => e.stopPropagation()}>
                              <p className="text-xs font-semibold mb-1">Add a note to this section</p>
                              <p className="text-[11px] text-muted-foreground mb-2">
                                Notes appear in the top "Track changes & comments" panel and the audit log.
                              </p>
                              <MentionTextarea
                                rows={4}
                                value={noteText}
                                onChange={setNoteText}
                                people={mentionPeople}
                                placeholder='e.g. "@Kurt finance flagged the payment terms — needs review"'
                                className="text-sm"
                                autoFocus
                              />
                              <div className="flex justify-end gap-1 mt-2">
                                <Button size="sm" variant="ghost" onClick={() => { setNoteOpenFor(null); setNoteText(""); }}>Cancel</Button>
                                <Button size="sm" disabled={!noteText.trim() || addComment.isPending} onClick={() => submitNote(s.section_key)}>
                                  {addComment.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                  Post note
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                        <span className="text-xs text-muted-foreground inline-flex items-center px-1">
                          <MessageSquare className="h-3 w-3 mr-1" /> {sectionComments.length}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedId(null); }}
                          className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-muted"
                          aria-label="Close"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{idx + 1}.</span>
                      <h3 className="text-sm font-semibold uppercase tracking-wide">{s.title}</h3>
                      <Badge variant="outline" className="font-mono text-[10px] h-5">v{version}</Badge>
                      {pendingCount > 0 && (
                        <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px] h-5">
                          <Clock className="h-2.5 w-2.5 mr-1" />{pendingCount} pending
                        </Badge>
                      )}
                      {draftCount > 0 && (
                        <Badge variant="outline" className="bg-sky-500/15 text-sky-700 border-sky-500/30 text-[10px] h-5">
                          <Clock className="h-2.5 w-2.5 mr-1" />{draftCount} draft
                        </Badge>
                      )}
                      {pendingCount === 0 && draftCount === 0 && (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px] h-5">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-1" />Clean
                        </Badge>
                      )}
                      {sectionComments.length > 0 && (
                        <Badge variant="outline" className="bg-violet-500/10 text-violet-700 border-violet-500/30 text-[10px] h-5">
                          <MessageSquare className="h-2.5 w-2.5 mr-1" />{sectionComments.length} note{sectionComments.length === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </div>

                    {latestTracked ? (
                      <div className="space-y-2">
                        <HoverCard openDelay={150}>
                          <HoverCardTrigger asChild>
                            <p className="text-[11px] italic text-muted-foreground cursor-help inline-flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {isLatestDraft
                                ? <>Draft by <span className="font-medium not-italic text-foreground">{latestTracked.edited_by_name || "you"}</span> · not yet submitted</>
                                : <>Proposed by <span className="font-medium not-italic text-foreground">{latestTracked.edited_by_name || "collaborator"}</span> · awaiting approval</>}
                            </p>
                          </HoverCardTrigger>
                          <HoverCardContent side="top" align="start" className="w-72 p-3">
                            <div className="flex items-start gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                  {initials(latestTracked.edited_by_name || latestTracked.edited_by_email || "?")}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">{latestTracked.edited_by_name || "Collaborator"}</p>
                                {latestTracked.edited_by_email && (
                                  <p className="text-[11px] text-muted-foreground truncate">{latestTracked.edited_by_email}</p>
                                )}
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  {format(new Date(latestTracked.created_at), "PPpp")}
                                </p>
                              </div>
                            </div>
                            {latestTracked.change_summary && (
                              <p className="text-xs mt-2 pt-2 border-t italic text-foreground/80">"{latestTracked.change_summary}"</p>
                            )}
                          </HoverCardContent>
                        </HoverCard>
                        <InlineDiff
                          before={latestTracked.previous_body ?? s.body ?? ""}
                          after={latestTracked.new_body ?? ""}
                          showStats={false}
                        />
                        {tracked.length > 1 && (
                          <p className="text-[11px] text-muted-foreground">
                            + {tracked.length - 1} earlier tracked change{tracked.length - 1 === 1 ? "" : "s"} on this section.
                          </p>
                        )}
                      </div>
                    ) : s.body ? (
                      <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{s.body}</p>
                    ) : (
                      <p className="text-[12px] text-muted-foreground italic">[empty section]</p>
                    )}

                    {sectionComments.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-dashed space-y-1">
                        {sectionComments.slice(-2).map((c: any) => (
                          <div key={c.id} className="text-[11px] flex items-start gap-1.5">
                            <MessageSquare className="h-3 w-3 text-violet-600 shrink-0 mt-0.5" />
                            <span className="text-foreground/80">
                              <span className="font-medium">{c.author_name || c.author_email || "Note"}:</span>{" "}
                              <span className="italic">{renderMentionedBody(c.body || "")}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Per-section change log — drafts/edits with user + timestamp */}
                    {(() => {
                      const log = changeLogBySection.get(s.id) ?? [];
                      if (log.length === 0) return null;
                      const visible = log.slice(0, 5);
                      return (
                        <div className="mt-2 pt-2 border-t border-dashed">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 inline-flex items-center gap-1">
                            <FileEdit className="h-3 w-3" /> Change log ({log.length})
                          </p>
                          <div className="space-y-1">
                            {visible.map((r: any) => {
                              const status = r.approval_status as string | undefined;
                              const tone =
                                status === "approved" ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                                : status === "pending" ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
                                : status === "auto" ? "bg-sky-500/15 text-sky-700 border-sky-500/30"
                                : status === "rejected" ? "bg-rose-500/15 text-rose-700 border-rose-500/30"
                                : status === "reverted" ? "bg-slate-500/15 text-slate-600 border-slate-500/30"
                                : "bg-slate-500/10 text-slate-600 border-slate-500/30";
                              const statusLabel =
                                status === "auto" ? "draft" : (status ?? "edit");
                              return (
                                <HoverCard key={r.id} openDelay={150}>
                                  <HoverCardTrigger asChild>
                                    <div className="text-[11px] flex items-center gap-1.5 cursor-help">
                                      <FileEdit className="h-3 w-3 text-muted-foreground shrink-0" />
                                      <span className="font-medium">{r.edited_by_name || r.edited_by_email || "Collaborator"}</span>
                                      <Badge variant="outline" className={`text-[9px] h-4 px-1 ${tone}`}>
                                        v{r.version_number ?? "?"} · {statusLabel}
                                      </Badge>
                                      <span className="text-muted-foreground">
                                        · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                                      </span>
                                      {r.change_summary && (
                                        <span className="italic text-foreground/70 truncate max-w-[260px]">— {r.change_summary}</span>
                                      )}
                                    </div>
                                  </HoverCardTrigger>
                                  <HoverCardContent side="top" align="start" className="w-80 p-3">
                                    <div className="flex items-start gap-2">
                                      <Avatar className="h-8 w-8">
                                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                          {initials(r.edited_by_name || r.edited_by_email || "?")}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold truncate">{r.edited_by_name || "Collaborator"}</p>
                                        {r.edited_by_email && (
                                          <p className="text-[11px] text-muted-foreground truncate">{r.edited_by_email}</p>
                                        )}
                                        <p className="text-[11px] text-muted-foreground mt-1">
                                          {format(new Date(r.created_at), "PPpp")}
                                        </p>
                                        <p className="text-[11px] mt-1">
                                          Status: <span className="font-medium">{statusLabel}</span> · v{r.version_number ?? "?"}
                                        </p>
                                      </div>
                                    </div>
                                    {r.change_summary && (
                                      <p className="text-xs mt-2 pt-2 border-t italic text-foreground/80">"{r.change_summary}"</p>
                                    )}
                                  </HoverCardContent>
                                </HoverCard>
                              );
                            })}
                            {log.length > visible.length && (
                              <p className="text-[10px] text-muted-foreground pl-4">
                                + {log.length - visible.length} earlier change{log.length - visible.length === 1 ? "" : "s"} — see Versions
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </section>
                );
              })}
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
};
