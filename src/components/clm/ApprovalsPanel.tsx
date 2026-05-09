import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  GitBranch, Check, X, Clock, ChevronDown, UserCheck, FileDiff, Sparkles,
} from "lucide-react";
import { useInstanceRevisions, useReviewRevision } from "@/hooks/useClmInstance";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Props {
  instanceId: string;
  contacts: any[]; // both internal + external collaborators on this workspace
  externalAccess?: any[]; // portal tokens issued
}

const statusMeta: Record<string, { label: string; tone: string; icon: any }> = {
  pending: { label: "Pending", tone: "bg-amber-500/15 text-amber-700 border-amber-500/30", icon: Clock },
  approved: { label: "Approved", tone: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", icon: Check },
  rejected: { label: "Rejected", tone: "bg-rose-500/15 text-rose-700 border-rose-500/30", icon: X },
  auto: { label: "Saved", tone: "bg-slate-500/15 text-slate-600 border-slate-500/30", icon: Sparkles },
};

export const ApprovalsPanel = ({ instanceId, contacts, externalAccess = [] }: Props) => {
  const { data: revisions = [] } = useInstanceRevisions(instanceId);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400_000;
    return {
      pending: revisions.filter((r: any) => r.approval_status === "pending").length,
      approvedWeek: revisions.filter((r: any) => r.approval_status === "approved" && new Date(r.reviewed_at || 0).getTime() > weekAgo).length,
      rejectedWeek: revisions.filter((r: any) => r.approval_status === "rejected" && new Date(r.reviewed_at || 0).getTime() > weekAgo).length,
    };
  }, [revisions]);

  const pending = revisions.filter((r: any) => r.approval_status === "pending");
  const history = revisions.filter((r: any) => r.approval_status !== "pending");

  // build assignee dropdown options from contacts + portal tokens
  const assignees = useMemo(() => {
    const list: { value: string; label: string; sub: string }[] = [];
    const seen = new Set<string>();
    contacts.forEach((c) => {
      const email = (c.is_internal ? c.email : c.debtor_contacts?.email ?? c.email) || "";
      const name = (c.is_internal ? c.name : c.debtor_contacts?.name ?? c.name) || email;
      if (!email || seen.has(email.toLowerCase())) return;
      seen.add(email.toLowerCase());
      list.push({
        value: email,
        label: name,
        sub: c.is_internal ? "Internal" : "External · account",
      });
    });
    externalAccess.forEach((a) => {
      if (!a.email || seen.has(a.email.toLowerCase()) || a.revoked_at) return;
      seen.add(a.email.toLowerCase());
      list.push({ value: a.email, label: a.name || a.email, sub: `Portal · ${a.role}` });
    });
    return list;
  }, [contacts, externalAccess]);

  return (
    <Card>
      <CardHeader className="space-y-3 pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4" /> Change Tracking & Approvals
          </CardTitle>
          <CardDescription>Route each change to a specific approver. Every action is auditable.</CardDescription>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md border bg-amber-500/5 px-2 py-1.5">
            <div className="text-lg font-semibold text-amber-700">{stats.pending}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Pending</div>
          </div>
          <div className="rounded-md border bg-emerald-500/5 px-2 py-1.5">
            <div className="text-lg font-semibold text-emerald-700">{stats.approvedWeek}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Approved 7d</div>
          </div>
          <div className="rounded-md border bg-rose-500/5 px-2 py-1.5">
            <div className="text-lg font-semibold text-rose-700">{stats.rejectedWeek}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Rejected 7d</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pending">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="history">History ({history.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="space-y-2 mt-3">
            {pending.length === 0 ? (
              <EmptyState text="Nothing pending. All changes are reviewed." />
            ) : (
              pending.map((r: any) => (
                <PendingCard key={r.id} rev={r} instanceId={instanceId} assignees={assignees} />
              ))
            )}
          </TabsContent>
          <TabsContent value="history" className="space-y-2 mt-3">
            {history.length === 0 ? (
              <EmptyState text="No reviewed changes yet." />
            ) : (
              history.map((r: any) => <HistoryRow key={r.id} rev={r} />)
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <p className="text-xs text-muted-foreground text-center py-8">{text}</p>
);

const PendingCard = ({
  rev, instanceId, assignees,
}: { rev: any; instanceId: string; assignees: { value: string; label: string; sub: string }[] }) => {
  const review = useReviewRevision(instanceId);
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const [assignee, setAssignee] = useState<string>(rev.assigned_approver_email || "");
  const [savingAssignee, setSavingAssignee] = useState(false);

  const updateAssignee = async (email: string) => {
    setSavingAssignee(true);
    const sel = assignees.find((a) => a.value === email);
    const { error } = await (supabase.from("clm_section_revisions" as any) as any)
      .update({
        assigned_approver_email: email || null,
        assigned_approver_name: sel?.label || null,
        assigned_at: email ? new Date().toISOString() : null,
      })
      .eq("id", rev.id);
    setSavingAssignee(false);
    if (error) return toast.error(error.message);
    setAssignee(email);
    qc.invalidateQueries({ queryKey: ["clm-revisions", instanceId] });
    toast.success(email ? `Assigned to ${sel?.label || email}` : "Assignment cleared");
  };

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{rev.section_title || rev.section_key || "Section"}</p>
          <p className="text-[11px] text-muted-foreground">
            {rev.edited_by_name || "Someone"} · {formatDistanceToNow(new Date(rev.created_at), { addSuffix: true })}
          </p>
          {rev.change_summary && (
            <p className="text-xs text-foreground/80 mt-1 italic">"{rev.change_summary}"</p>
          )}
        </div>
        <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30 shrink-0">
          <Clock className="h-3 w-3 mr-1" /> Pending
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={assignee || "__none"} onValueChange={(v) => updateAssignee(v === "__none" ? "" : v)} disabled={savingAssignee}>
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue placeholder="Assign approver…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Unassigned</SelectItem>
            {assignees.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                <span className="font-medium">{a.label}</span>
                <span className="text-muted-foreground ml-1.5 text-[11px]">· {a.sub}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Collapsible open={showDiff} onOpenChange={setShowDiff}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 text-xs w-full justify-between">
            <span className="flex items-center gap-1.5"><FileDiff className="h-3 w-3" /> Compare changes</span>
            <ChevronDown className={`h-3 w-3 transition-transform ${showDiff ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded border bg-muted/30 p-2">
            <p className="font-semibold text-rose-600 mb-1">Before</p>
            <pre className="whitespace-pre-wrap font-sans text-[12px] max-h-40 overflow-y-auto">
              {rev.previous_body || <em className="text-muted-foreground">empty</em>}
            </pre>
          </div>
          <div className="rounded border bg-emerald-500/5 p-2">
            <p className="font-semibold text-emerald-700 mb-1">After</p>
            <pre className="whitespace-pre-wrap font-sans text-[12px] max-h-40 overflow-y-auto">
              {rev.new_body || <em className="text-muted-foreground">empty</em>}
            </pre>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Input
        placeholder="Optional note for the editor…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="h-8 text-xs"
      />
      <div className="flex gap-2">
        <Button
          size="sm" variant="outline" className="flex-1"
          onClick={() => review.mutate({ revisionId: rev.id, decision: "rejected", note, revertOnReject: true })}
        >
          <X className="h-3.5 w-3.5 mr-1" /> Request changes
        </Button>
        <Button
          size="sm" className="flex-1"
          onClick={() => review.mutate({ revisionId: rev.id, decision: "approved", note })}
        >
          <Check className="h-3.5 w-3.5 mr-1" /> Approve
        </Button>
      </div>
    </div>
  );
};

const HistoryRow = ({ rev }: { rev: any }) => {
  const meta = statusMeta[rev.approval_status] || statusMeta.auto;
  const Icon = meta.icon;
  return (
    <div className="flex items-start justify-between gap-2 rounded border p-2">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{rev.section_title || rev.section_key || "Section"}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {rev.edited_by_name || "Someone"}
          {rev.reviewed_by_name && <> · reviewed by {rev.reviewed_by_name}</>}
          {" · "}
          {formatDistanceToNow(new Date(rev.reviewed_at || rev.created_at), { addSuffix: true })}
        </p>
        {rev.review_note && <p className="text-[11px] text-foreground/70 italic mt-0.5">"{rev.review_note}"</p>}
      </div>
      <Badge variant="outline" className={`${meta.tone} shrink-0`}>
        <Icon className="h-3 w-3 mr-1" /> {meta.label}
      </Badge>
    </div>
  );
};
