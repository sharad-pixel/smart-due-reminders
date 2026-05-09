import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { GitMerge, Send, Check, X, RotateCcw, Lock, FilePlus, History } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  useDocumentVersions, useOpenDraftVersion, useSubmitVersion, useReviewVersion,
  useRevertToVersion, useSealVersion, type ClmDocVersionStatus,
} from "@/hooks/useClmInstance";

interface Props {
  instanceId: string;
  myRole?: string | null;
}

const STATUS_META: Record<ClmDocVersionStatus, { label: string; tone: string }> = {
  draft:      { label: "Draft",      tone: "bg-slate-500/15 text-slate-700 border-slate-500/30" },
  pending:    { label: "Pending Review", tone: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  published:  { label: "Published",  tone: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  sealed:     { label: "Sealed",     tone: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30" },
  superseded: { label: "Superseded", tone: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
};

const APPROVER = new Set(["owner", "approver", "legal"]);
const EDITOR   = new Set(["owner", "editor", "approver", "legal"]);
const SEALER   = new Set(["owner", "legal", "signer"]);

const can = (role: string | null | undefined, set: Set<string>) =>
  set.has((role ?? "viewer").toLowerCase());

interface ActionBtnProps {
  disabled?: boolean;
  reason?: string;
  onClick?: () => void;
  children: React.ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost";
}
const ActionBtn = ({ disabled, reason, onClick, children, variant = "outline" }: ActionBtnProps) => {
  const btn = (
    <Button size="sm" variant={variant} disabled={disabled} onClick={onClick} className="h-7 text-xs gap-1">
      {children}
    </Button>
  );
  if (!disabled || !reason) return btn;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild><span>{btn}</span></TooltipTrigger>
        <TooltipContent><p className="text-xs max-w-[220px]">{reason}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const VersionTimelinePanel = ({ instanceId, myRole }: Props) => {
  const { data: versions = [], isLoading } = useDocumentVersions(instanceId);
  const openDraft = useOpenDraftVersion(instanceId);
  const submit = useSubmitVersion(instanceId);
  const review = useReviewVersion(instanceId);
  const revert = useRevertToVersion(instanceId);
  const seal = useSealVersion(instanceId);

  const [reviewModal, setReviewModal] = useState<{ versionId: string; decision: "approved" | "rejected" } | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const hasDraft = versions.some((v: any) => v.status === "draft");
  const hasPending = versions.some((v: any) => v.status === "pending");
  const hasSealed = versions.some((v: any) => v.status === "sealed");

  const submitReview = () => {
    if (!reviewModal) return;
    review.mutate(
      { versionId: reviewModal.versionId, decision: reviewModal.decision, note: reviewNote.trim() || undefined },
      { onSuccess: () => { setReviewModal(null); setReviewNote(""); } },
    );
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 flex-wrap">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Document Versions
          </CardTitle>
          <CardDescription>
            Each version captures the whole document. Lifecycle: Draft → Pending Review → Published → Sealed.
            Only invited collaborators with the right role can act.
          </CardDescription>
        </div>
        <ActionBtn
          disabled={!can(myRole, EDITOR) || hasDraft || hasPending || hasSealed}
          reason={
            hasSealed ? "Workspace is sealed" :
            hasPending ? "A version is pending review" :
            hasDraft ? "There is already an active draft" :
            !can(myRole, EDITOR) ? "Only Editor / Approver / Legal / Owner can open a new draft" : undefined
          }
          onClick={() => openDraft.mutate()}
          variant="default"
        >
          <FilePlus className="h-3.5 w-3.5" /> New draft
        </ActionBtn>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Loading…</p>
        ) : versions.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">No versions yet — start editing to open v1.</p>
        ) : (
          <ol className="relative border-l border-border ml-2 space-y-3">
            {versions.map((v: any) => {
              const status = v.status as ClmDocVersionStatus;
              const meta = STATUS_META[status];
              const isDraft = status === "draft";
              const isPending = status === "pending";
              const isPublished = status === "published";
              const isSuperseded = status === "superseded";

              return (
                <li key={v.id} className="ml-4">
                  <span className="absolute -left-2 mt-1 flex h-4 w-4 items-center justify-center rounded-full border bg-background">
                    <GitMerge className="h-2.5 w-2.5" />
                  </span>
                  <div className="rounded border bg-background p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm">v{v.version_number}</span>
                      {v.label && <span className="text-xs text-muted-foreground">· {v.label}</span>}
                      <Badge variant="outline" className={`${meta.tone} text-[10px] h-5`}>{meta.label}</Badge>
                      <span className="ml-auto text-[11px] text-muted-foreground" title={format(new Date(v.created_at), "PPpp")}>
                        {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Opened by <span className="font-medium text-foreground">{v.created_by_name ?? "—"}</span>
                      {v.created_by_role && <> · <span className="capitalize">{v.created_by_role}</span></>}
                      {" · "}{format(new Date(v.created_at), "MMM d, yyyy h:mm a")}
                    </p>
                    {v.submitted_at && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Submitted by <span className="font-medium text-foreground">{v.submitted_by_name ?? "—"}</span>
                        {" · "}{format(new Date(v.submitted_at), "MMM d, yyyy h:mm a")}
                      </p>
                    )}
                    {v.reviewed_at && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {isPublished || isSuperseded ? "Approved" : "Reviewed"} by{" "}
                        <span className="font-medium text-foreground">{v.reviewed_by_name ?? "—"}</span>
                        {v.reviewed_by_role && <> ({v.reviewed_by_role})</>}
                        {" · "}{format(new Date(v.reviewed_at), "MMM d, yyyy h:mm a")}
                        {v.review_note && <> — “{v.review_note}”</>}
                      </p>
                    )}
                    {v.sealed_at && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Sealed by <span className="font-medium text-foreground">{v.sealed_by_name ?? "—"}</span>
                        {" · "}{format(new Date(v.sealed_at), "MMM d, yyyy h:mm a")}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {isDraft && (
                        <ActionBtn
                          disabled={!can(myRole, EDITOR)}
                          reason="Only Editor / Approver / Legal / Owner can submit"
                          onClick={() => submit.mutate({ versionId: v.id })}
                          variant="default"
                        >
                          <Send className="h-3.5 w-3.5" /> Submit for review
                        </ActionBtn>
                      )}
                      {isPending && (
                        <>
                          <ActionBtn
                            disabled={!can(myRole, APPROVER)}
                            reason="Only Approver / Legal / Owner can approve"
                            onClick={() => { setReviewModal({ versionId: v.id, decision: "approved" }); setReviewNote(""); }}
                            variant="default"
                          >
                            <Check className="h-3.5 w-3.5" /> Approve & publish
                          </ActionBtn>
                          <ActionBtn
                            disabled={!can(myRole, APPROVER)}
                            reason="Only Approver / Legal / Owner can reject"
                            onClick={() => { setReviewModal({ versionId: v.id, decision: "rejected" }); setReviewNote(""); }}
                          >
                            <X className="h-3.5 w-3.5" /> Reject
                          </ActionBtn>
                        </>
                      )}
                      {(isPublished || isSuperseded) && (
                        <ActionBtn
                          disabled={!can(myRole, APPROVER) || hasSealed || hasPending}
                          reason={
                            hasSealed ? "Workspace is sealed" :
                            hasPending ? "Resolve the pending version first" :
                            "Only Approver / Legal / Owner can revert"
                          }
                          onClick={() => {
                            if (confirm(`Revert document to v${v.version_number}? A new draft will be opened.`)) {
                              revert.mutate({ versionId: v.id });
                            }
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Revert to this
                        </ActionBtn>
                      )}
                      {isPublished && (
                        <ActionBtn
                          disabled={!can(myRole, SEALER)}
                          reason="Only Owner / Legal / Signer can seal"
                          onClick={() => {
                            if (confirm(`Seal v${v.version_number}? This locks the workspace permanently.`)) {
                              seal.mutate({ versionId: v.id });
                            }
                          }}
                        >
                          <Lock className="h-3.5 w-3.5" /> Seal
                        </ActionBtn>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>

      <Dialog open={!!reviewModal} onOpenChange={(o) => !o && setReviewModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewModal?.decision === "approved" ? "Approve & publish version" : "Reject version"}</DialogTitle>
            <DialogDescription>
              {reviewModal?.decision === "approved"
                ? "This becomes the current published version. The previous published version will be marked superseded."
                : "The version will return to draft so editors can revise it."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Note (optional)</Label>
            <Textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Add context for the audit log…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewModal(null)}>Cancel</Button>
            <Button
              onClick={submitReview}
              variant={reviewModal?.decision === "approved" ? "default" : "destructive"}
              disabled={review.isPending}
            >
              {reviewModal?.decision === "approved" ? "Approve & publish" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
