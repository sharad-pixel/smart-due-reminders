import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAddSectionComment } from "@/hooks/useClmInstance";
import { MessageSquare, AtSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Person = { name?: string | null; email?: string | null };

export const SectionCommentsPanel = ({
  instanceId,
  sectionKey,
  comments,
  contacts = [],
  externalAccess = [],
}: {
  instanceId: string;
  sectionKey: string;
  comments: any[];
  contacts?: any[];
  externalAccess?: any[];
}) => {
  const [body, setBody] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [caretAt, setCaretAt] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const add = useAddSectionComment(instanceId);
  const filtered = comments.filter((c) => c.section_key === sectionKey);

  const people: Person[] = useMemo(() => {
    const seen = new Set<string>();
    const out: Person[] = [];
    [...contacts, ...externalAccess].forEach((p: any) => {
      const name = p?.name ?? p?.full_name ?? null;
      const email = (p?.email ?? "").toLowerCase();
      const key = email || name || "";
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push({ name, email });
    });
    return out;
  }, [contacts, externalAccess]);

  const suggestions = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    return people
      .filter((p) => !q || p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q))
      .slice(0, 6);
  }, [people, mentionQuery]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBody(val);
    const pos = e.target.selectionStart ?? val.length;
    const upto = val.slice(0, pos);
    const m = upto.match(/(?:^|\s)@([\w.\-+]*)$/);
    if (m) {
      setMentionOpen(true);
      setMentionQuery(m[1] ?? "");
      setCaretAt(pos);
    } else {
      setMentionOpen(false);
    }
  };

  const insertMention = (p: Person) => {
    const label = (p.name || p.email || "").replace(/\s+/g, " ").trim();
    if (!label) return;
    const before = body.slice(0, caretAt).replace(/@([\w.\-+]*)$/, `@${label} `);
    const after = body.slice(caretAt);
    const next = before + after;
    setBody(next);
    setMentionOpen(false);
    setTimeout(() => {
      textareaRef.current?.focus();
      const cursor = before.length;
      textareaRef.current?.setSelectionRange(cursor, cursor);
    }, 0);
  };

  const submit = async () => {
    if (!body.trim()) return;
    await add.mutateAsync({ section_key: sectionKey, body: body.trim() });
    setBody("");
  };

  const renderBody = (text: string) => {
    const parts = text.split(/(@[\w.\-+ ]+?(?=\s|[,.!?;:]|$))/g);
    return parts.map((part, i) =>
      part.startsWith("@") ? (
        <span key={i} className="text-primary font-medium">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div className="border-t pt-3 mt-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <MessageSquare className="h-4 w-4" /> Discussion ({filtered.length})
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {filtered.map((c) => (
          <div key={c.id} className="rounded bg-muted/40 p-2 text-sm">
            <p className="whitespace-pre-wrap">{renderBody(c.body)}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</p>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
      </div>
      <div className="space-y-2">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            rows={2}
            value={body}
            onChange={handleChange}
            placeholder="Add a comment… use @ to tag a collaborator"
          />
          {mentionOpen && suggestions.length > 0 && (
            <div className="absolute z-20 bottom-full mb-1 left-0 w-64 rounded-md border bg-popover shadow-md p-1">
              {suggestions.map((p, i) => (
                <button
                  key={(p.email ?? p.name ?? "") + i}
                  type="button"
                  onClick={() => insertMention(p)}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-accent flex items-center gap-2 text-sm"
                >
                  <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{p.name || p.email}</span>
                  {p.name && p.email && <span className="text-xs text-muted-foreground truncate">{p.email}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} disabled={!body.trim() || add.isPending}>Post</Button>
        </div>
      </div>
    </div>
  );
};
