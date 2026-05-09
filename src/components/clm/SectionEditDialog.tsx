import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Pencil, Send, Save, Loader2, FileDiff, Eye, FilePen } from "lucide-react";
import { useUpdateInstanceSection } from "@/hooks/useClmInstance";
import { InlineDiff } from "./InlineDiff";
import { wordDiff, diffStats } from "@/lib/textDiff";

export const SectionEditDialog = ({
  instanceId, section, currentVersion,
}: { instanceId: string; section: any; currentVersion?: number }) => {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(section.body ?? "");
  const [summary, setSummary] = useState("");
  const [tab, setTab] = useState("edit");
  const update = useUpdateInstanceSection(instanceId);

  const dirty = body !== (section.body ?? "");
  const stats = useMemo(() => diffStats(wordDiff(section.body ?? "", body)), [section.body, body]);

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
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setBody(section.body ?? ""); setTab("edit"); } }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span>Edit section: {section.title}</span>
              {currentVersion ? (
                <Badge variant="outline" className="font-mono text-[10px]">Editing from v{currentVersion}</Badge>
              ) : null}
              {dirty && (
                <>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px]">
                    +{stats.added}
                  </Badge>
                  <Badge variant="outline" className="bg-rose-500/10 text-rose-700 border-rose-500/30 text-[10px]">
                    −{stats.removed}
                  </Badge>
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Changes are tracked as new revisions. Submit for approval to require sign-off, or save directly as the latest version.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="edit"><FilePen className="h-3.5 w-3.5 mr-1.5" />Edit</TabsTrigger>
              <TabsTrigger value="diff" disabled={!dirty}>
                <FileDiff className="h-3.5 w-3.5 mr-1.5" />Diff
              </TabsTrigger>
              <TabsTrigger value="preview"><Eye className="h-3.5 w-3.5 mr-1.5" />Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="space-y-3 mt-3">
              <div>
                <Label>Section body</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={16}
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label>Change summary (optional)</Label>
                <Input
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="e.g. Tightened liability cap to 12 months fees"
                />
              </div>
            </TabsContent>

            <TabsContent value="diff" className="mt-3">
              <p className="text-xs text-muted-foreground mb-2">
                Live diff between the current saved version and your edits.
              </p>
              <InlineDiff before={section.body ?? ""} after={body} />
            </TabsContent>

            <TabsContent value="preview" className="mt-3">
              <div className="rounded border bg-muted/20 p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-[460px] overflow-y-auto">
                {body || <em className="text-muted-foreground">Empty</em>}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="secondary" disabled={!dirty || update.isPending} onClick={() => submit(false)}>
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Save className="h-4 w-4 mr-1" /> Save as new version</>)}
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
