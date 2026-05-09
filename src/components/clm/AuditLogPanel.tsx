import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ScrollText, Pencil, Send, Check, X, RotateCcw, Lock, MessageSquare, UserPlus, FilePlus, GitMerge, Mail, Clock as ClockIcon,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useClmAuditLog } from "@/hooks/useClmInstance";

const initials = (s: string) => s.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

interface Props {
  instanceId: string;
}

const META: Record<string, { label: string; tone: string; icon: any }> = {
  edited:           { label: "Edit saved",        tone: "bg-slate-500/15 text-slate-700 border-slate-500/30",     icon: Pencil },
  submitted:        { label: "Submitted",         tone: "bg-amber-500/15 text-amber-700 border-amber-500/30",     icon: Send },
  batch_submitted:  { label: "Batch submitted",   tone: "bg-amber-500/15 text-amber-700 border-amber-500/30",     icon: Send },
  approved:         { label: "Approved",          tone: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", icon: Check },
  rejected:         { label: "Rejected",          tone: "bg-rose-500/15 text-rose-700 border-rose-500/30",        icon: X },
  reverted:         { label: "Reverted",          tone: "bg-rose-500/15 text-rose-700 border-rose-500/30",        icon: RotateCcw },
  marked_reverted:  { label: "Marked reverted",   tone: "bg-rose-500/10 text-rose-600 border-rose-500/20",        icon: RotateCcw },
  sealed:           { label: "Sealed",            tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30", icon: Lock },
  commented:        { label: "Comment",           tone: "bg-violet-500/15 text-violet-700 border-violet-500/30",  icon: MessageSquare },
  review_requested: { label: "Review requested",  tone: "bg-sky-500/15 text-sky-700 border-sky-500/30",           icon: UserPlus },
  version_opened:   { label: "Version opened",    tone: "bg-slate-500/15 text-slate-700 border-slate-500/30",     icon: GitMerge },
  version_submitted:{ label: "Version submitted", tone: "bg-amber-500/15 text-amber-700 border-amber-500/30",     icon: Send },
  version_approved: { label: "Version published", tone: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", icon: Check },
  version_rejected: { label: "Version rejected",  tone: "bg-rose-500/15 text-rose-700 border-rose-500/30",        icon: X },
  version_reverted: { label: "Version reverted",  tone: "bg-rose-500/15 text-rose-700 border-rose-500/30",        icon: RotateCcw },
  version_sealed:   { label: "Version sealed",    tone: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30",  icon: Lock },
};

const FALLBACK = { label: "Event", tone: "bg-slate-500/15 text-slate-600 border-slate-500/30", icon: FilePlus };

const FILTERS: { id: string; label: string; types: string[] }[] = [
  { id: "all",       label: "All",       types: [] },
  { id: "versions",  label: "Versions",  types: ["version_opened","version_submitted","version_approved","version_rejected","version_reverted","version_sealed"] },
  { id: "approvals", label: "Approvals", types: ["approved", "rejected", "sealed"] },
  { id: "edits",     label: "Edits",     types: ["edited", "submitted", "batch_submitted"] },
  { id: "reverts",   label: "Reverts",   types: ["reverted", "marked_reverted"] },
  { id: "comments",  label: "Discussion", types: ["commented", "review_requested"] },
];

export const AuditLogPanel = ({ instanceId }: Props) => {
  const { data: events = [], isLoading } = useClmAuditLog(instanceId);
  const [filter, setFilter] = useState("all");

  const list = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter);
    if (!f || f.types.length === 0) return events as any[];
    return (events as any[]).filter((e) => f.types.includes(e.event_type));
  }, [events, filter]);

  const exportCsv = () => {
    const rows = [
      ["timestamp", "event", "actor", "actor_email", "section", "details"],
      ...(events as any[]).map((e) => [
        e.created_at,
        e.event_type,
        e.actor_name ?? "",
        e.actor_email ?? "",
        e.section_title ?? "",
        JSON.stringify(e.payload ?? {}),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit-log-${instanceId}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 flex-wrap">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="h-4 w-4" /> Audit Log
          </CardTitle>
          <CardDescription>
            Every change, approval, rejection, revert, comment, and reviewer tag — with actor and timestamp.
          </CardDescription>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <Button key={f.id} size="sm" variant={filter === f.id ? "default" : "outline"} onClick={() => setFilter(f.id)}>
              {f.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={exportCsv} disabled={!events.length}>Export CSV</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">No events recorded yet.</p>
        ) : (
          <ol className="relative border-l border-border ml-2 space-y-3">
            {list.map((e: any) => {
              const meta = META[e.event_type] ?? FALLBACK;
              const Icon = meta.icon;
              const detail =
                e.event_type === "commented" ? (e.payload?.preview ?? "") :
                e.event_type === "review_requested" ? `→ ${(e.payload?.reviewers ?? []).join(", ")}` :
                e.event_type === "batch_submitted" ? `${e.payload?.revision_count ?? "?"} change(s) → ${e.payload?.approver_email ?? ""}` :
                e.event_type === "reverted" ? (e.payload?.change_summary ?? "") :
                e.event_type?.startsWith("version_") ? (
                  e.event_type === "version_reverted"
                    ? `Reverted to v${e.payload?.reverted_to_version} → new draft v${e.payload?.new_draft_version}`
                    : e.payload?.note ?? ""
                ) :
                e.payload?.review_note ?? e.payload?.change_summary ?? "";

              return (
                <li key={e.id} className="ml-4">
                  <span className="absolute -left-2 mt-1 flex h-4 w-4 items-center justify-center rounded-full border bg-background">
                    <Icon className="h-2.5 w-2.5" />
                  </span>
                  <HoverCard openDelay={120} closeDelay={80}>
                    <HoverCardTrigger asChild>
                      <div className="rounded border bg-background p-2.5 cursor-default transition-colors hover:bg-muted/30 hover:border-primary/40">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={`${meta.tone} text-[10px] h-5`}>{meta.label}</Badge>
                          {e.section_title && (
                            <span className="text-xs font-medium truncate">{e.section_title}</span>
                          )}
                          {e.payload?.version_number && (
                            <Badge variant="outline" className="text-[9px] h-4">v{e.payload.version_number}</Badge>
                          )}
                          <span className="ml-auto text-[11px] text-muted-foreground" title={format(new Date(e.created_at), "PPpp")}>
                            {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          <span className="font-medium text-foreground">{e.actor_name ?? e.actor_email ?? "System"}</span>
                          {e.actor_email && e.actor_name ? <> · {e.actor_email}</> : null}
                          {" · "}
                          {format(new Date(e.created_at), "MMM d, yyyy h:mm a")}
                        </p>
                        {detail && (
                          <p className="text-xs mt-1 text-foreground/80 break-words">{detail}</p>
                        )}
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent side="left" align="start" className="w-80 p-3">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-[11px] bg-primary/10 text-primary">
                            {initials(e.actor_name || e.actor_email || "S")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{e.actor_name ?? e.actor_email ?? "System"}</p>
                          {e.actor_email && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3" /> {e.actor_email}
                            </p>
                          )}
                          {e.actor_role && (
                            <Badge variant="outline" className="mt-1 text-[10px] h-4 capitalize">{e.actor_role}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 space-y-1.5 text-[11px]">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Badge variant="outline" className={`${meta.tone} text-[10px] h-4`}>{meta.label}</Badge>
                          {e.section_title && <span className="truncate">on {e.section_title}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <ClockIcon className="h-3 w-3" />
                          <span>{format(new Date(e.created_at), "PPpp")}</span>
                        </div>
                        {detail && (
                          <p className="text-foreground/80 mt-2 border-t pt-2 break-words">{detail}</p>
                        )}
                        {e.payload?.change_summary && e.payload.change_summary !== detail && (
                          <p className="text-foreground/70 italic">"{e.payload.change_summary}"</p>
                        )}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
};
