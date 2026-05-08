import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAddSectionComment } from "@/hooks/useClmInstance";
import { MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const SectionCommentsPanel = ({
  instanceId, sectionKey, comments,
}: { instanceId: string; sectionKey: string; comments: any[] }) => {
  const [body, setBody] = useState("");
  const add = useAddSectionComment(instanceId);
  const filtered = comments.filter((c) => c.section_key === sectionKey);

  const submit = async () => {
    if (!body.trim()) return;
    await add.mutateAsync({ section_key: sectionKey, body: body.trim() });
    setBody("");
  };

  return (
    <div className="border-t pt-3 mt-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <MessageSquare className="h-4 w-4" /> Discussion ({filtered.length})
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {filtered.map((c) => (
          <div key={c.id} className="rounded bg-muted/40 p-2 text-sm">
            <p className="whitespace-pre-wrap">{c.body}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</p>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
      </div>
      <div className="flex gap-2">
        <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a comment…" />
        <Button onClick={submit} disabled={!body.trim() || add.isPending}>Post</Button>
      </div>
    </div>
  );
};
