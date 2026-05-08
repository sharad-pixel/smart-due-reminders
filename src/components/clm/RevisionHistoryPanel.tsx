import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GitBranch, Check, X, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { useInstanceRevisions, useReviewRevision } from "@/hooks/useClmInstance";
import { formatDistanceToNow } from "date-fns";

const RevisionItem = ({ rev, instanceId }: { rev: any; instanceId: string }) => {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const review = useReviewRevision(instanceId);

  const statusColor =
    rev.approval_status === "approved" ? "default" :
    rev.approval_status === "rejected" ? "destructive" :
    rev.approval_status === "pending" ? "secondary" : "outline";

  const StatusIcon =
    rev.approval_status === "approved" ? Check :
    rev.approval_status === "rejected" ? X :
    rev.approval_status === "pending" ? Clock : GitBranch;

  return (
    <div className="rounded border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 p-2 hover:bg-muted/40"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
          <StatusIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="text-sm font-medium truncate">{rev.section_title ?? rev.section_key ?? "Section"}</span>
          {rev.change_summary && <span className="text-xs text-muted-foreground truncate">— {rev.change_summary}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={statusColor as any} className="text-[10px]">{rev.approval_status}</Badge>
          <span className="text-[11px] text-muted-foreground">
            {rev.edited_by_name ?? "Someone"} · {formatDistanceToNow(new Date(rev.created_at), { addSuffix: true })}
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t p-3 space-y-3 bg-muted/20">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded border bg-background p-2">
              <p className="font-semibold text-destructive mb-1">Before</p>
              <pre className="whitespace-pre-wrap font-sans text-[12px] max-h-48 overflow-y-auto">{rev.previous_body || <em className="text-muted-foreground">empty</em>}</pre>
            </div>
            <div className="rounded border bg-background p-2">
              <p className="font-semibold text-primary mb-1">After</p>
              <pre className="whitespace-pre-wrap font-sans text-[12px] max-h-48 overflow-y-auto">{rev.new_body || <em className="text-muted-foreground">empty</em>}</pre>
            </div>
          </div>

          {rev.approval_status === "pending" && (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Optional note for the editor…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="h-8 text-xs"
              />
              <Button
                size="sm" variant="outline"
                onClick={() => review.mutate({ revisionId: rev.id, decision: "rejected", note, revertOnReject: true })}
              >
                <X className="h-3.5 w-3.5 mr-1" /> Reject & revert
              </Button>
              <Button
                size="sm"
                onClick={() => review.mutate({ revisionId: rev.id, decision: "approved", note })}
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Approve
              </Button>
            </div>
          )}

          {rev.reviewed_by_name && (
            <p className="text-[11px] text-muted-foreground">
              Reviewed by {rev.reviewed_by_name} {rev.reviewed_at && `· ${formatDistanceToNow(new Date(rev.reviewed_at), { addSuffix: true })}`}
              {rev.review_note && <> — “{rev.review_note}”</>}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export const RevisionHistoryPanel = ({ instanceId }: { instanceId: string }) => {
  const { data: revisions = [] } = useInstanceRevisions(instanceId);
  const [filter, setFilter] = useState<"all" | "pending">("all");

  const filtered = filter === "pending" ? revisions.filter((r: any) => r.approval_status === "pending") : revisions;
  const pendingCount = revisions.filter((r: any) => r.approval_status === "pending").length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4" /> Change Tracking & Approvals
          </CardTitle>
          <CardDescription>
            Every edit is logged. Pending changes need attorney approval.
          </CardDescription>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
          <Button size="sm" variant={filter === "pending" ? "default" : "outline"} onClick={() => setFilter("pending")}>
            Pending {pendingCount > 0 && <Badge variant="secondary" className="ml-1">{pendingCount}</Badge>}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No changes yet.</p>
        ) : (
          filtered.map((r: any) => <RevisionItem key={r.id} rev={r} instanceId={instanceId} />)
        )}
      </CardContent>
    </Card>
  );
};
