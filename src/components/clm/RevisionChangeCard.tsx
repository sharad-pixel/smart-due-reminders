import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Check, X, RotateCcw, MessageSquare, Lock, Clock, Sparkles, GitBranch, ChevronDown, ChevronRight, UserPlus, ShieldCheck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { InlineDiff } from "./InlineDiff";
import { RevisionCommentThread } from "./RevisionCommentThread";
import {
  useReviewRevision,
  useRevertRevision,
  useRequestRevisionReview,
  useRevisionComments,
} from "@/hooks/useClmInstance";
import {
  canApproveRevisions, canMergeRevisions, canRevertRevision, canCommentOnRevisions,
} from "@/lib/clmRoles";

const APPROVER_ROLES = new Set(["owner", "approver", "legal"]);


interface Mentionable { email: string; name?: string | null; role?: string | null }

interface Props {
  instanceId: string;
  revision: any;
  myRole?: string | null;
  myUserId?: string | null;
  mentionables: Mentionable[];
  defaultOpen?: boolean;
}

const STATUS: Record<string, { tone: string; icon: any; label: string }> = {
  pending:  { tone: "bg-amber-500/15 text-amber-700 border-amber-500/30",       icon: Clock,    label: "Pending approval" },
  approved: { tone: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", icon: Check,    label: "Approved" },
  rejected: { tone: "bg-rose-500/15 text-rose-700 border-rose-500/30",          icon: X,        label: "Rejected" },
  auto:     { tone: "bg-slate-500/15 text-slate-600 border-slate-500/30",       icon: Sparkles, label: "Saved draft" },
};

export const RevisionChangeCard = ({
  instanceId, revision: rev, myRole, myUserId, mentionables, defaultOpen = false,
}: Props) => {
  const [open, setOpen] = useState(defaultOpen);
  const [note, setNote] = useState("");
  const [reviewerOpen, setReviewerOpen] = useState(false);
  const [pickedReviewer, setPickedReviewer] = useState<string>("");

  const review = useReviewRevision(instanceId);
  const revert = useRevertRevision(instanceId);
  const reqReview = useRequestRevisionReview(instanceId);
  const { data: comments = [] } = useRevisionComments(rev.id);

  const status = STATUS[rev.approval_status] ?? STATUS.auto;
  const StatusIcon = status.icon;
  const sealed = !!rev.sealed_at;
  const reverted = rev.merge_status === "reverted";

  const isAuthor = myUserId && rev.edited_by === myUserId;
  const canApprove = canApproveRevisions(myRole) && rev.approval_status === "pending";
  const canMergeAsAuto = canMergeRevisions(myRole) && rev.approval_status === "auto";
  const canRevert = canRevertRevision(rev, myRole, myUserId) && !reverted;
  const canComment = canCommentOnRevisions(myRole);

  const requested: string[] = rev.requested_reviewers ?? [];

  return (
    <div className={`rounded border ${sealed ? "bg-emerald-50/40 border-emerald-200" : "bg-background"}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 p-2 hover:bg-muted/40 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
          <StatusIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="text-sm font-medium truncate">
            {rev.section_title ?? rev.section_key ?? "Section"}
          </span>
          {rev.version_number && <Badge variant="outline" className="text-[9px] h-4">v{rev.version_number}</Badge>}
          {rev.change_summary && (
            <span className="text-xs text-muted-foreground truncate">— {rev.change_summary}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {reverted && <Badge variant="outline" className="text-[9px] h-4 bg-rose-500/10 border-rose-500/30 text-rose-700"><RotateCcw className="h-2.5 w-2.5 mr-0.5" />Reverted</Badge>}
          {sealed && <Badge variant="outline" className="text-[9px] h-4 bg-emerald-500/10 border-emerald-500/30"><Lock className="h-2.5 w-2.5 mr-0.5" />Sealed</Badge>}
          <Badge variant="outline" className={`${status.tone} text-[10px] h-5`}>{status.label}</Badge>
          {comments.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5">
              <MessageSquare className="h-2.5 w-2.5 mr-0.5" /> {comments.length}
            </Badge>
          )}
          <span className="text-[11px] text-muted-foreground">
            {rev.edited_by_name ?? "Someone"} · {formatDistanceToNow(new Date(rev.created_at), { addSuffix: true })}
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t p-3 space-y-3 bg-muted/20">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Change</p>
            <InlineDiff before={rev.previous_body ?? ""} after={rev.new_body ?? ""} />
          </div>

          {requested.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-[11px]">
              <span className="text-muted-foreground">Tagged for review:</span>
              {requested.map((e) => (
                <Badge key={e} variant="outline" className="text-[10px] h-4">@{e}</Badge>
              ))}
            </div>
          )}

          {rev.reviewed_by_name && (
            <p className="text-[11px] text-muted-foreground">
              Reviewed by {rev.reviewed_by_name}
              {rev.reviewed_at && ` · ${formatDistanceToNow(new Date(rev.reviewed_at), { addSuffix: true })}`}
              {rev.review_note && <> — “{rev.review_note}”</>}
            </p>
          )}

          {/* Action row */}
          <div className="flex flex-wrap items-center gap-2">
            {(canApprove || canMergeAsAuto || canRevert) && (
              <Input
                placeholder="Optional note…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="h-8 text-xs flex-1 min-w-[180px]"
              />
            )}
            <TooltipProvider>
              {canApprove && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="outline"
                        onClick={() => review.mutate({ revisionId: rev.id, decision: "rejected", note, revertOnReject: true })}>
                        <X className="h-3.5 w-3.5 mr-1" /> Reject & revert
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reject this change and roll the section back</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" onClick={() => review.mutate({ revisionId: rev.id, decision: "approved", note })}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Approve
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Sign off and lock this change</TooltipContent>
                  </Tooltip>
                </>
              )}
              {!canApprove && canMergeAsAuto && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" disabled>
                      <GitBranch className="h-3.5 w-3.5 mr-1" /> Merged
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Editor drafts apply immediately. Submit for approval via the bar above.</TooltipContent>
                </Tooltip>
              )}
              {canRevert && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline"
                      disabled={revert.isPending}
                      onClick={() => revert.mutate({ revisionId: rev.id, note: note || undefined })}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Revert
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Roll the section back; logs an inverse revision</TooltipContent>
                </Tooltip>
              )}

              {canComment && (
                <div className="ml-auto flex items-center gap-1">
                  {!reviewerOpen ? (
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setReviewerOpen(true)}>
                      <UserPlus className="h-3.5 w-3.5 mr-1" /> Request review
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <select
                        value={pickedReviewer}
                        onChange={(e) => setPickedReviewer(e.target.value)}
                        className="h-8 text-xs rounded border bg-background px-2"
                      >
                        <option value="">Pick reviewer…</option>
                        {mentionables.map((m) => (
                          <option key={m.email} value={m.email}>
                            {(m.name || m.email)}{m.role ? ` (${m.role})` : ""}
                          </option>
                        ))}
                      </select>
                      <Button size="sm" disabled={!pickedReviewer || reqReview.isPending}
                        onClick={async () => {
                          await reqReview.mutateAsync({ revisionId: rev.id, emails: [pickedReviewer], message: note || undefined });
                          setPickedReviewer(""); setReviewerOpen(false);
                        }}>
                        Send
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setReviewerOpen(false)}>Cancel</Button>
                    </div>
                  )}
                </div>
              )}
            </TooltipProvider>
          </div>

          <div className="border-t pt-3">
            <RevisionCommentThread
              instanceId={instanceId}
              revisionId={rev.id}
              mentionables={mentionables}
              canComment={canComment}
            />
          </div>
        </div>
      )}
    </div>
  );
};
