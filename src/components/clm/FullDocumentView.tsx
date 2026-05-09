import { useMemo, useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, CheckCircle2, MessageSquare, History, Pencil, GitBranch, X, User } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { InlineDiff } from "./InlineDiff";
import { useInstanceRevisions } from "@/hooks/useClmInstance";
import { SectionEditDialog } from "./SectionEditDialog";
import { SectionVersionHistoryDialog } from "./SectionVersionHistoryDialog";

interface Props {
  instanceId?: string;
  sections: any[];
  title?: string;
  description?: string;
  contacts?: any[];
  comments?: any[];
  canEdit?: boolean;
}

const initials = (s: string) => s.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

export const FullDocumentView = ({
  instanceId, sections, title, description, contacts = [], comments = [], canEdit = false,
}: Props) => {
  const { data: revisions = [] } = useInstanceRevisions(instanceId ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredMarginId, setHoveredMarginId] = useState<string | null>(null);
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

  const commentsBySection = useMemo(() => {
    const m = new Map<string, any[]>();
    comments.forEach((c: any) => {
      const arr = m.get(c.section_key) ?? [];
      arr.push(c);
      m.set(c.section_key, arr);
    });
    return m;
  }, [comments]);

  const scrollToSection = (id: string) => {
    setSelectedId(id);
    const el = sectionRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Click-away to deselect
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-clm-section]") && !target.closest("[data-clm-margin]") && !target.closest("[role='dialog']")) {
        setSelectedId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
          {description ?? "Click a section to reveal the edit menu. Pending changes and discussion appear in the right margin, like Google Docs."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="rounded border bg-background">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-0 max-h-[78vh] overflow-y-auto">
              {/* Document column */}
              <div className="px-6 py-8 sm:px-10 sm:py-10 space-y-6 lg:border-r">
                {sections.map((s: any, idx: number) => {
                  const tracked = trackedBySection.get(s.id) ?? [];
                  const pendingCount = tracked.filter((r) => r.approval_status === "pending").length;
                  const draftCount = tracked.filter((r) => r.approval_status === "auto").length;
                  const latestTracked = tracked[0];
                  const isLatestDraft = latestTracked?.approval_status === "auto";
                  const version = currentVersionBySection.get(s.id) ?? 1;
                  const sectionComments = commentsBySection.get(s.section_key) ?? [];
                  const isSelected = selectedId === s.id;
                  const isHighlighted = hoveredMarginId === s.id;

                  return (
                    <section
                      key={s.id}
                      data-clm-section={s.id}
                      ref={(el) => { sectionRefs.current[s.id] = el; }}
                      onClick={() => setSelectedId(s.id)}
                      className={`relative space-y-2 rounded-md p-3 -mx-3 cursor-pointer transition-all ${
                        isSelected
                          ? "bg-primary/5 ring-2 ring-primary/40 shadow-sm"
                          : isHighlighted
                            ? "bg-amber-500/5 ring-1 ring-amber-500/30"
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
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              const el = document.querySelector(`[data-clm-margin="${s.id}"]`);
                              el?.scrollIntoView({ behavior: "smooth", block: "center" });
                            }}
                          >
                            <MessageSquare className="h-3 w-3 mr-1" /> {sectionComments.length}
                          </Button>
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
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{s.body}</p>
                      ) : (
                        <p className="text-[12px] text-muted-foreground italic">[empty section]</p>
                      )}
                    </section>
                  );
                })}
              </div>

              {/* Margin column — Google Docs style */}
              <aside className="hidden lg:block bg-muted/20 px-3 py-6 space-y-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-1">
                  Track changes & comments
                </p>
                {sections.map((s: any) => {
                  const tracked = trackedBySection.get(s.id) ?? [];
                  const sectionComments = commentsBySection.get(s.section_key) ?? [];
                  const hasContent = tracked.length > 0 || sectionComments.length > 0;
                  if (!hasContent) return null;
                  const isSelected = selectedId === s.id;

                  return (
                    <div
                      key={s.id}
                      data-clm-margin={s.id}
                      onMouseEnter={() => setHoveredMarginId(s.id)}
                      onMouseLeave={() => setHoveredMarginId(null)}
                      onClick={() => scrollToSection(s.id)}
                      className={`rounded-md border bg-background p-2.5 cursor-pointer transition-all space-y-2 ${
                        isSelected ? "ring-2 ring-primary/40 shadow-sm" : "hover:border-primary/40 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/80 truncate flex-1">
                          {s.title}
                        </span>
                      </div>

                      {tracked.slice(0, 2).map((r: any) => (
                        <div key={r.id} className={`rounded border-l-2 pl-2 py-1 text-[11px] ${
                          r.approval_status === "pending"
                            ? "border-amber-500 bg-amber-500/5"
                            : "border-sky-500 bg-sky-500/5"
                        }`}>
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-4 w-4">
                              <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                                {initials(r.edited_by_name || r.edited_by_email || "?")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium truncate">{r.edited_by_name || r.edited_by_email || "—"}</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="ml-auto text-muted-foreground text-[10px]">
                                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: false })}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{format(new Date(r.created_at), "PPpp")}</TooltipContent>
                            </Tooltip>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {r.approval_status === "pending" ? "Pending review" : "Private draft"}
                            {r.change_summary ? ` · ${r.change_summary}` : ""}
                          </p>
                        </div>
                      ))}
                      {tracked.length > 2 && (
                        <p className="text-[10px] text-muted-foreground px-1">+ {tracked.length - 2} more change(s)</p>
                      )}

                      {sectionComments.slice(0, 2).map((c: any) => (
                        <div key={c.id} className="rounded border-l-2 border-violet-500 bg-violet-500/5 pl-2 py-1 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <MessageSquare className="h-2.5 w-2.5 text-violet-600" />
                            <span className="font-medium truncate">{c.author_name || c.author_email || "Comment"}</span>
                            <span className="ml-auto text-muted-foreground text-[10px]">
                              {formatDistanceToNow(new Date(c.created_at), { addSuffix: false })}
                            </span>
                          </div>
                          <p className="text-[11px] mt-0.5 line-clamp-2 text-foreground/80">{c.body}</p>
                        </div>
                      ))}
                      {sectionComments.length > 2 && (
                        <p className="text-[10px] text-muted-foreground px-1">+ {sectionComments.length - 2} more comment(s)</p>
                      )}
                    </div>
                  );
                })}

                {sections.every((s: any) => {
                  const t = trackedBySection.get(s.id) ?? [];
                  const c = commentsBySection.get(s.section_key) ?? [];
                  return t.length === 0 && c.length === 0;
                }) && (
                  <div className="rounded border border-dashed bg-background/60 p-3 text-center">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
                    <p className="text-[11px] text-muted-foreground">
                      No pending changes or comments. Document is clean.
                    </p>
                  </div>
                )}
              </aside>
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
};
