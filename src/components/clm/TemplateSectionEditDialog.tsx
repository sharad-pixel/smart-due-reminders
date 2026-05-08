import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Save, Loader2 } from "lucide-react";
import { useUpdateClmTemplateSection, type ClmTemplateSection } from "@/hooks/useClmTemplates";

/**
 * Edit a TEMPLATE section (title + body + AI summary).
 * Note: This edits the master template — existing workspaces keep their own snapshot.
 */
export const TemplateSectionEditDialog = ({
  templateId, section,
}: { templateId: string; section: ClmTemplateSection }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(section.title ?? "");
  const [body, setBody] = useState(section.body ?? "");
  const [summary, setSummary] = useState(section.ai_summary ?? "");
  const update = useUpdateClmTemplateSection(templateId);

  const dirty =
    title !== (section.title ?? "") ||
    body !== (section.body ?? "") ||
    summary !== (section.ai_summary ?? "");

  const save = async () => {
    if (!dirty) { setOpen(false); return; }
    await update.mutateAsync({
      id: section.id,
      title: title.trim() || section.title,
      body,
      ai_summary: summary.trim() ? summary : null,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (v) {
        setTitle(section.title ?? "");
        setBody(section.body ?? "");
        setSummary(section.ai_summary ?? "");
      }
    }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" onClick={(e) => e.stopPropagation()}>
          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit section
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit template section</DialogTitle>
          <DialogDescription>
            Edits the master template only. Active workspaces keep their existing snapshot — only future workspaces use the new content.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Section title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>AI summary (optional)</Label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Section body</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={16} className="font-mono text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!dirty || update.isPending} onClick={save}>
            {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Save className="h-4 w-4 mr-1" /> Save changes</>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
