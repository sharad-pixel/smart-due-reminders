import { useEffect, useMemo, useRef, useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AtSign, Check, MessageSquare, Loader2, Reply, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  useRevisionComments,
  usePostRevisionComment,
  useResolveRevisionComment,
} from "@/hooks/useClmInstance";

interface Mentionable { email: string; name?: string | null; role?: string | null }

interface Props {
  instanceId: string;
  revisionId: string;
  mentionables: Mentionable[];
  canComment: boolean;
}

const initialsFor = (name?: string | null, email?: string | null) => {
  const src = (name || email || "?").trim();
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
};

const MENTION_TOKEN = /@([\w.+-]+(?:@[\w.-]+\.[a-zA-Z]{2,})?)/g;

const extractMentions = (body: string, mentionables: Mentionable[]): string[] => {
  const out = new Set<string>();
  const lookup = new Map<string, string>();
  mentionables.forEach((m) => {
    const e = m.email.toLowerCase();
    lookup.set(e, e);
    if (m.name) lookup.set(m.name.toLowerCase().replace(/\s+/g, "-"), e);
    lookup.set(e.split("@")[0], e);
  });
  for (const match of body.matchAll(MENTION_TOKEN)) {
    const raw = match[1].toLowerCase();
    if (lookup.has(raw)) out.add(lookup.get(raw)!);
    else if (raw.includes("@")) out.add(raw);
  }
  return Array.from(out);
};

const renderBody = (body: string, mentionables: Mentionable[]) => {
  const knownEmails = new Set(mentionables.map((m) => m.email.toLowerCase()));
  const nodes: any[] = [];
  let last = 0;
  let i = 0;
  for (const match of body.matchAll(MENTION_TOKEN)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(body.slice(last, start));
    const handle = match[1];
    const isKnown = knownEmails.has(handle.toLowerCase()) ||
      mentionables.some((m) => m.email.toLowerCase().split("@")[0] === handle.toLowerCase());
    nodes.push(
      <span
        key={`m-${i++}`}
        className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] font-medium ${
          isKnown ? "bg-sky-500/15 text-sky-700" : "bg-muted text-muted-foreground"
        }`}
      >
        <AtSign className="h-2.5 w-2.5" />{handle}
      </span>,
    );
    last = start + match[0].length;
  }
  if (last < body.length) nodes.push(body.slice(last));
  return nodes;
};

interface ComposerProps {
  mentionables: Mentionable[];
  onPost: (body: string, mentions: string[]) => Promise<void> | void;
  onCancel?: () => void;
  isPending: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  compact?: boolean;
}

const Composer = ({ mentionables, onPost, onCancel, isPending, placeholder, autoFocus, compact }: ComposerProps) => {
  const [body, setBody] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const filtered = useMemo(() => {
    if (query === null) return [] as Mentionable[];
    const q = query.toLowerCase();
    return mentionables
      .filter((m) =>
        !q ||
        m.email.toLowerCase().includes(q) ||
        (m.name ?? "").toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [query, mentionables]);

  const updateQueryFromCaret = (val: string, caret: number) => {
    const upto = val.slice(0, caret);
    const m = upto.match(/(?:^|\s)@([\w.+-]*)$/);
    if (m) {
      setQuery(m[1] ?? "");
      setHighlight(0);
    } else {
      setQuery(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBody(val);
    updateQueryFromCaret(val, e.target.selectionStart ?? val.length);
  };

  const insertMention = (m: Mentionable) => {
    const el = ref.current;
    const caret = el?.selectionStart ?? body.length;
    const upto = body.slice(0, caret);
    const after = body.slice(caret);
    const replaced = upto.replace(/@([\w.+-]*)$/, `@${m.email} `);
    const next = replaced + after;
    setBody(next);
    setQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = replaced.length;
      el?.setSelectionRange(pos, pos);
    });
  };

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    const mentions = extractMentions(trimmed, mentionables);
    await onPost(trimmed, mentions);
    setBody("");
    setQuery(null);
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (query !== null && filtered.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % filtered.length); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setHighlight((h) => (h - 1 + filtered.length) % filtered.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(filtered[highlight]); return; }
      if (e.key === "Escape")    { e.preventDefault(); setQuery(null); return; }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const livePreview = extractMentions(body, mentionables);

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Textarea
          ref={ref}
          value={body}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder={placeholder ?? "Comment, or type @ to mention someone…"}
          className={`text-xs ${compact ? "min-h-[52px]" : "min-h-[64px]"}`}
        />
        {query !== null && (
          <div className="absolute z-30 bottom-full mb-1 left-0 w-full max-w-sm rounded border bg-popover shadow-lg overflow-hidden">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">No matches for “{query}”.</p>
            ) : (
              filtered.map((m, idx) => (
                <button
                  key={m.email}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
                  className={`w-full text-left px-2 py-1.5 flex items-center gap-2 ${
                    idx === highlight ? "bg-muted" : "hover:bg-muted/60"
                  }`}
                >
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[9px]">{initialsFor(m.name, m.email)}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs flex-1 min-w-0 truncate">
                    <span className="font-medium">{m.name || m.email}</span>
                    {m.name && <span className="text-muted-foreground"> · {m.email}</span>}
                  </span>
                  {m.role && <Badge variant="outline" className="text-[9px] h-4 capitalize">{m.role}</Badge>}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <AtSign className="h-3 w-3" /> Type @ to mention
          {livePreview.length > 0 && (
            <span className="ml-1">
              · Will notify <span className="text-foreground font-medium">{livePreview.length}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onCancel && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onCancel}>
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
          )}
          <Button size="sm" disabled={!body.trim() || isPending} onClick={submit} className="h-7">
            {isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Post
          </Button>
        </div>
      </div>
    </div>
  );
};

export const RevisionCommentThread = ({ instanceId, revisionId, mentionables, canComment }: Props) => {
  const { data: comments = [], isLoading } = useRevisionComments(revisionId);
  const post = usePostRevisionComment(instanceId);
  const resolve = useResolveRevisionComment(instanceId, revisionId);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const { roots, repliesByParent } = useMemo(() => {
    const all = comments as any[];
    const map: Record<string, any[]> = {};
    const roots: any[] = [];
    all.forEach((c) => {
      if (c.parent_comment_id) {
        (map[c.parent_comment_id] = map[c.parent_comment_id] || []).push(c);
      } else {
        roots.push(c);
      }
    });
    return { roots, repliesByParent: map };
  }, [comments]);

  const handlePost = async (body: string, mentions: string[], parentCommentId?: string | null) => {
    await post.mutateAsync({ revisionId, body, mentions, parentCommentId: parentCommentId ?? null });
    setReplyTo(null);
  };

  const renderComment = (c: any, depth = 0) => {
    const replies = repliesByParent[c.id] ?? [];
    return (
      <li key={c.id} className={depth > 0 ? "ml-6 border-l pl-3" : ""}>
        <div className={`rounded border p-2.5 ${c.resolved_at ? "opacity-60 bg-muted/40" : "bg-background"}`}>
          <div className="flex items-start gap-2">
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarFallback className="text-[10px]">{initialsFor(c.author_name, c.author_email)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-medium truncate">{c.author_name || c.author_email || "Someone"}</span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                </span>
                {c.resolved_at && <Badge variant="outline" className="text-[9px] h-4">Resolved</Badge>}
                <div className="ml-auto flex items-center gap-0.5">
                  {!c.resolved_at && (
                    <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]"
                      onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>
                      <Reply className="h-3 w-3 mr-0.5" /> Reply
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]"
                    onClick={() => resolve.mutate({ commentId: c.id, resolved: !c.resolved_at })}>
                    <Check className="h-3 w-3 mr-0.5" />
                    {c.resolved_at ? "Reopen" : "Resolve"}
                  </Button>
                </div>
              </div>
              <p className="text-xs whitespace-pre-wrap mt-1 leading-relaxed">
                {renderBody(c.body, mentionables)}
              </p>
              {(c.mentions ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {c.mentions.map((m: string) => (
                    <Badge key={m} variant="outline" className="text-[9px] h-4 bg-sky-500/10 border-sky-500/30 text-sky-700">
                      <AtSign className="h-2.5 w-2.5 mr-0.5" />{m} · notified
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {replyTo === c.id && canComment && (
          <div className="ml-8 mt-1.5">
            <Composer
              mentionables={mentionables}
              isPending={post.isPending}
              autoFocus compact
              placeholder={`Reply to ${c.author_name || c.author_email || "this comment"}…`}
              onPost={(b, mentions) => handlePost(b, mentions, c.id)}
              onCancel={() => setReplyTo(null)}
            />
          </div>
        )}
        {replies.length > 0 && (
          <ul className="space-y-2 mt-2">
            {replies.map((r) => renderComment(r, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <MessageSquare className="h-3 w-3" /> Discussion
        {(comments as any[]).length > 0 && (
          <Badge variant="secondary" className="text-[9px] h-4">{(comments as any[]).length}</Badge>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : roots.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No comments yet. @mention a teammate to pull them in.</p>
      ) : (
        <ul className="space-y-2">
          {roots.map((c) => renderComment(c))}
        </ul>
      )}

      {canComment && (
        <Composer
          mentionables={mentionables}
          isPending={post.isPending}
          onPost={(b, m) => handlePost(b, m)}
        />
      )}
    </div>
  );
};
