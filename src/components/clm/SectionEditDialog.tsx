import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Pencil, Send, Save, Loader2 } from "lucide-react";
import { useUpdateInstanceSection } from "@/hooks/useClmInstance";

export const SectionEditDialog = ({
  instanceId, section,
}: { instanceId: string; section: any }) => {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(section.body ?? "");
  const [summary, setSummary] = useState("");
  const update = useUpdateInstanceSection(instanceId);

  const dirty = body !== (section.body ?? "");

  const submit = async (forApproval: boolean) => {
    if (!dirty) { setOpen(false); return; }
    await update.mutateAsync({
      id: section.id, body, change_summary: summary || undefined, submitForApproval: forApproval,
    });
    setOpen(false);
    setSummary("");
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit section: {section.title}</DialogTitle>
            <DialogDescription>
              Changes are tracked as revisions. Submit for approval to require attorney sign‑off, or save directly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Section body</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} className="font-mono text-sm" />
            </div>
            <div>
              <Label>Change summary (optional)</Label>
              <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="e.g. Tightened liability cap to 12 months fees" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="secondary" disabled={!dirty || update.isPending} onClick={() => submit(false)}>
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Save className="h-4 w-4 mr-1" /> Save</>)}
            </Button>
            <Button disabled={!dirty || update.isPending} onClick={() => submit(true)}>
              <Send className="h-4 w-4 mr-1" /> Submit for Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
