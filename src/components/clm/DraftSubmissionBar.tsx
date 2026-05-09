import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Send, GitBranch, Loader2, ShieldCheck, FileDiff } from "lucide-react";
import { useMyUnsubmittedDrafts, useSubmitDraftsForReview } from "@/hooks/useClmInstance";
import { formatDistanceToNow } from "date-fns";

interface Approver { value: string; label: string; sub: string }

export const DraftSubmissionBar = ({
  instanceId, contacts = [], externalAccess = [],
}: { instanceId: string; contacts?: any[]; externalAccess?: any[] }) => {
  const { data: drafts = [] } = useMyUnsubmittedDrafts(instanceId);
  const submit = useSubmitDraftsForReview(instanceId);
  const [open, setOpen] = useState(false);
  const [approver, setApprover] = useState("");
  const [message, setMessage] = useState("");

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

  if (!drafts.length) return null;

  const onSubmit = async () => {
    if (!approver) return;
    const sel = approvers.find((a) => a.value === approver);
    await submit.mutateAsync({
      revisionIds: (drafts as any[]).map((d) => d.id),
      approverEmail: approver,
      approverName: sel?.label,
      message,
    });
    setOpen(false);
    setMessage("");
  };

  return (
    <>
      <Card className="border-amber-500/30 bg-amber-500/5 p-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-amber-700" />
            <p className="text-sm font-medium">
              You have {drafts.length} draft change{drafts.length === 1 ? "" : "s"} in this session
            </p>
            <Badge variant="outline" className="bg-background text-[10px]">unsent</Badge>
          </div>
          <p className="text-xs text-muted-foreground flex-1 min-w-[200px]">
            Drafts stay private until you submit them. The approver gets <strong>one</strong> alert
            with all your edits — not one per change.
          </p>
          <Button size="sm" onClick={() => setOpen(true)} className="gap-1">
            <Send className="h-3.5 w-3.5" /> Submit {drafts.length} for review
          </Button>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4" /> Submit drafts for review
            </DialogTitle>
            <DialogDescription>
              Bundles your {drafts.length} unsent change{drafts.length === 1 ? "" : "s"} into a
              single review request. The approver receives one digest email.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded border bg-muted/30 max-h-56 overflow-y-auto p-2 space-y-1">
              {(drafts as any[]).map((d) => (
                <div key={d.id} className="flex items-center gap-2 text-xs py-1 px-1.5 rounded hover:bg-background">
                  <FileDiff className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{d.section_title || d.section_key}</span>
                  <Badge variant="outline" className="font-mono text-[9px] h-4">v{d.version_number}</Badge>
                  {d.change_summary && <span className="text-muted-foreground truncate">— {d.change_summary}</span>}
                  <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>

            <div>
              <Label className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Send to approver
              </Label>
              <Select value={approver} onValueChange={setApprover}>
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
            </div>

            <div>
              <Label>Message (optional)</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Summary of what you changed in this session…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!approver || submit.isPending} onClick={onSubmit}>
              {submit.isPending
                ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Submitting…</>
                : <><Send className="h-4 w-4 mr-1" />Submit {drafts.length} change{drafts.length === 1 ? "" : "s"}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
