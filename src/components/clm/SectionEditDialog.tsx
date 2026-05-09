import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Pencil, Send, Save, Loader2, FileDiff, Eye, FilePen, ShieldCheck, GitBranch } from "lucide-react";
import { useUpdateInstanceSection } from "@/hooks/useClmInstance";
import { InlineDiff } from "./InlineDiff";
import { wordDiff, diffStats } from "@/lib/textDiff";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface Approver { value: string; label: string; sub: string }

export const SectionEditDialog = ({
  instanceId, section, currentVersion, contacts = [], trigger,
}: { instanceId: string; section: any; currentVersion?: number; contacts?: any[]; trigger?: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(section.body ?? "");
  const [summary, setSummary] = useState("");
  const [tab, setTab] = useState("edit");
  const [assignee, setAssignee] = useState<string>("");
  const update = useUpdateInstanceSection(instanceId);

  // Pull portal collaborators for this workspace
  const { data: externalAccess = [] } = useQuery({
    queryKey: ["clm-external-access", instanceId],
    enabled: open,
    queryFn: async () => {
      const { data } = await (supabase.from("clm_external_access" as any) as any)
        .select("email, name, role, revoked_at, expires_at")
        .eq("instance_id", instanceId);
      return data ?? [];
    },
  });

  const approvers: Approver[] = useMemo(() => {
    const list: Approver[] = [];
    const seen = new Set<string>();
    contacts.forEach((c: any) => {
      const email = (c.is_internal ? c.email : c.debtor_contacts?.email ?? c.email) || "";
      const name = (c.is_internal ? c.name : c.debtor_contacts?.name ?? c.name) || email;
      if (!email || seen.has(email.toLowerCase())) return;
      seen.add(email.toLowerCase());
      list.push({ value: email, label: name, sub: c.is_internal ? "Internal" : "External · account" });
    });
    (externalAccess as any[]).forEach((a: any) => {
      if (!a.email || a.revoked_at || seen.has(a.email.toLowerCase())) return;
      seen.add(a.email.toLowerCase());
      list.push({ value: a.email, label: a.name || a.email, sub: `Portal · ${a.role}` });
    });
    return list;
  }, [contacts, externalAccess]);

  // Default assignee to first internal contact when dialog opens
  useEffect(() => {
    if (open && !assignee && approvers.length) setAssignee(approvers[0].value);
  }, [open, approvers, assignee]);

  const dirty = body !== (section.body ?? "");
  const stats = useMemo(() => diffStats(wordDiff(section.body ?? "", body)), [section.body, body]);

  const submit = async (forApproval: boolean) => {
    if (!dirty) { setOpen(false); return; }
    const sel = approvers.find((a) => a.value === assignee);
    await update.mutateAsync({
      id: section.id, body, change_summary: summary || undefined, submitForApproval: forApproval,
      assigned_approver_email: forApproval ? assignee || undefined : undefined,
      assigned_approver_name: forApproval ? sel?.label : undefined,
    });
    setOpen(false);
    setSummary("");
  };

  const canSubmitForApproval = dirty && !!assignee;

  return (
    <>
      {trigger ? (
        <span onClick={(e) => { e.stopPropagation(); setOpen(true); }}>{trigger}</span>
      ) : (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
        </Button>
      )}
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
              <span className="inline-flex items-center gap-1.5 mr-2 rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[11px] font-medium">
                <GitBranch className="h-3 w-3" /> Suggesting mode
              </span>
              Save as many edits as you like — each one is logged and versioned. They stay
              private as drafts until you submit them all together for review from the
              workspace bar (the approver gets one alert, not one per edit).
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
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Change summary (optional)</Label>
                  <Input
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="e.g. Tightened liability cap"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> Approver (required to submit)
                  </Label>
                  <Select value={assignee} onValueChange={setAssignee}>
                    <SelectTrigger>
                      <SelectValue placeholder={approvers.length ? "Select approver…" : "Invite collaborators first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {approvers.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          <span className="font-medium">{a.label}</span>
                          <span className="text-muted-foreground ml-1.5 text-[11px]">· {a.sub}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    They'll be emailed a link to review and approve.
                  </p>
                </div>
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

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <p className="text-[11px] text-muted-foreground sm:mr-auto">
              Drafts are batched — submit them all from the workspace bar when you're done.
            </p>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!dirty || update.isPending} onClick={() => submit(false)}>
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Save className="h-4 w-4 mr-1" /> Save draft (v+1)</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
