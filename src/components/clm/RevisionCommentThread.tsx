import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AtSign, Check, MessageSquare, Loader2, CornerDownRight } from "lucide-react";
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

const extractMentions = (body: string): string[] => {
  const matches = body.match(/@[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g) ?? [];
  return matches.map((m) => m.slice(1).toLowerCase());
};

export const RevisionCommentThread = ({ instanceId, revisionId, mentionables, canComment }: Props) => {
  const { data: comments = [], isLoading } = useRevisionComments(revisionId);
  const post = usePostRevisionComment(instanceId);
  const resolve = useResolveRevisionComment(instanceId, revisionId);
  const [body, setBody] = useState("");
  const [picker, setPicker] = useState(false);

  const mentions = useMemo(() => extractMentions(body), [body]);

  const handlePost = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    await post.mutateAsync({ revisionId, body: trimmed, mentions });
    setBody("");
  };

  const insertMention = (email: string) => {
    setBody((b) => `${b}${b && !b.endsWith(" ") ? " " : ""}@${email} `);
    setPicker(false);
  };

  const threaded = comments as any[];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <MessageSquare className="h-3 w-3" /> Discussion
        {threaded.length > 0 && <Badge variant="secondary" className="text-[9px] h-4">{threaded.length}</Badge>}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : threaded.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No comments yet.</p>
      ) : (
        <ul className="space-y-2">
          {threaded.map((c) => (
            <li key={c.id} className={`rounded border p-2 text-xs ${c.resolved_at ? "opacity-60" : "bg-background"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {c.parent_comment_id && <CornerDownRight className="h-3 w-3 text-muted-foreground" />}
                  <span className="font-medium truncate">{c.author_name || c.author_email || "Someone"}</span>
                  <span className="text-[10px] text-muted-foreground">
                    · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                  </span>
                </div>
                <Button
                  size="sm" variant="ghost" className="h-6 px-1 text-[10px]"
                  onClick={() => resolve.mutate({ commentId: c.id, resolved: !c.resolved_at })}
                >
                  <Check className="h-3 w-3 mr-0.5" />
                  {c.resolved_at ? "Reopen" : "Resolve"}
                </Button>
              </div>
              <p className="whitespace-pre-wrap mt-1">{c.body}</p>
              {(c.mentions ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {c.mentions.map((m: string) => (
                    <Badge key={m} variant="outline" className="text-[9px] h-4">
                      <AtSign className="h-2.5 w-2.5 mr-0.5" />{m}
                    </Badge>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canComment && (
        <div className="space-y-1.5">
          <div className="relative">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Comment, or @mention someone to pull them in for review…"
              className="min-h-[60px] text-xs"
            />
            {picker && (
              <div className="absolute z-20 bottom-full mb-1 left-0 right-0 max-h-44 overflow-y-auto rounded border bg-popover shadow-lg">
                {mentionables.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2">No collaborators to mention.</p>
                ) : (
                  mentionables.map((m) => (
                    <button
                      key={m.email}
                      type="button"
                      onClick={() => insertMention(m.email)}
                      className="w-full text-left text-xs px-2 py-1.5 hover:bg-muted/60 flex items-center justify-between"
                    >
                      <span><span className="font-medium">{m.name || m.email}</span> <span className="text-muted-foreground">{m.email}</span></span>
                      {m.role && <Badge variant="outline" className="text-[9px] h-4 capitalize">{m.role}</Badge>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setPicker((p) => !p)}>
              <AtSign className="h-3 w-3 mr-1" /> Mention
            </Button>
            <div className="flex items-center gap-2">
              {mentions.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  Will notify {mentions.length} {mentions.length === 1 ? "person" : "people"}
                </span>
              )}
              <Button size="sm" disabled={!body.trim() || post.isPending} onClick={handlePost}>
                {post.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Post
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
