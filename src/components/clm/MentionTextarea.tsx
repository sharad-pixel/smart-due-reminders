import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { AtSign } from "lucide-react";

export type MentionPerson = { name?: string | null; email?: string | null; role?: string | null };

interface Props {
  value: string;
  onChange: (v: string) => void;
  people: MentionPerson[];
  placeholder?: string;
  rows?: number;
  className?: string;
  autoFocus?: boolean;
}

/**
 * Reusable @-mention textarea.
 * Pulls suggestions from the provided `people` list (collaborators + portal access).
 */
export const MentionTextarea = forwardRef<HTMLTextAreaElement, Props>(function MentionTextarea(
  { value, onChange, people, placeholder, rows = 3, className, autoFocus },
  ref,
) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => localRef.current as HTMLTextAreaElement);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [caretAt, setCaretAt] = useState(0);

  const dedupedPeople = useMemo(() => {
    const seen = new Set<string>();
    const out: MentionPerson[] = [];
    people.forEach((p) => {
      const email = (p?.email ?? "").toLowerCase();
      const key = email || p?.name || "";
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(p);
    });
    return out;
  }, [people]);

  const suggestions = useMemo(() => {
    const q = query.toLowerCase();
    return dedupedPeople
      .filter((p) => !q || p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [dedupedPeople, query]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);
    const pos = e.target.selectionStart ?? val.length;
    const upto = val.slice(0, pos);
    const m = upto.match(/(?:^|\s)@([\w.\-+]*)$/);
    if (m) {
      setOpen(true);
      setQuery(m[1] ?? "");
      setCaretAt(pos);
    } else {
      setOpen(false);
    }
  };

  const insert = (p: MentionPerson) => {
    const label = (p.name || p.email || "").replace(/\s+/g, " ").trim();
    if (!label) return;
    const before = value.slice(0, caretAt).replace(/@([\w.\-+]*)$/, `@${label} `);
    const after = value.slice(caretAt);
    const next = before + after;
    onChange(next);
    setOpen(false);
    setTimeout(() => {
      localRef.current?.focus();
      const cursor = before.length;
      localRef.current?.setSelectionRange(cursor, cursor);
    }, 0);
  };

  return (
    <div className="relative">
      <Textarea
        ref={localRef}
        rows={rows}
        value={value}
        onChange={handleChange}
        placeholder={placeholder ?? "Add a comment… use @ to tag a collaborator"}
        className={className}
        autoFocus={autoFocus}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-30 bottom-full mb-1 left-0 w-72 rounded-md border bg-popover shadow-md p-1 max-h-60 overflow-y-auto">
          <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Tag a collaborator
          </p>
          {suggestions.map((p, i) => (
            <button
              key={(p.email ?? p.name ?? "") + i}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insert(p); }}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-accent flex items-center gap-2 text-sm"
            >
              <AtSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.name || p.email}</div>
                {p.name && p.email && (
                  <div className="text-[11px] text-muted-foreground truncate">{p.email}</div>
                )}
              </div>
              {p.role && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">{p.role}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export const renderMentionedBody = (text: string) => {
  const parts = text.split(/(@[\w.\-+ ]+?(?=\s|[,.!?;:]|$))/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="text-primary font-medium">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
};
