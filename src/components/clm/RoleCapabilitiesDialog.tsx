import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, ShieldCheck } from "lucide-react";
import { CLM_ROLE_META, type ClmRole } from "@/lib/clmRoles";

type Cap = "view" | "comment" | "edit" | "submit" | "approve" | "revert" | "tagReviewers" | "manageAccess" | "sign";

const CAP_LABELS: Record<Cap, string> = {
  view: "View document",
  comment: "Comment & @mention",
  edit: "Edit sections (auto-saves draft)",
  submit: "Submit for approval",
  revert: "Revert pending / own drafts",
  approve: "Approve / reject changes",
  tagReviewers: "Tag reviewers on a change",
  manageAccess: "Add / remove collaborators",
  sign: "Sign final document",
};

const MATRIX: Record<ClmRole, Partial<Record<Cap, boolean>>> = {
  owner:    { view: true, comment: true, edit: true, submit: true, revert: true, approve: true, tagReviewers: true, manageAccess: true, sign: true },
  legal:    { view: true, comment: true, edit: true, submit: true, revert: true, approve: true, tagReviewers: true, manageAccess: false, sign: false },
  approver: { view: true, comment: true, edit: true, submit: true, revert: true, approve: true, tagReviewers: true, manageAccess: false, sign: false },
  editor:   { view: true, comment: true, edit: true, submit: true, revert: true, approve: false, tagReviewers: true, manageAccess: false, sign: false },
  reviewer: { view: true, comment: true, edit: false, submit: false, revert: false, approve: false, tagReviewers: true, manageAccess: false, sign: false },
  signer:   { view: true, comment: true, edit: false, submit: false, revert: false, approve: false, tagReviewers: false, manageAccess: false, sign: true },
  cc:       { view: true, comment: true, edit: false, submit: false, revert: false, approve: false, tagReviewers: false, manageAccess: false, sign: false },
  viewer:   { view: true, comment: false, edit: false, submit: false, revert: false, approve: false, tagReviewers: false, manageAccess: false, sign: false },
};

const ROLE_ORDER: ClmRole[] = ["owner", "legal", "approver", "editor", "reviewer", "signer", "cc", "viewer"];
const CAP_ORDER: Cap[] = ["view", "comment", "edit", "submit", "revert", "approve", "tagReviewers", "manageAccess", "sign"];

interface Props {
  myRole?: string | null;
  trigger?: React.ReactNode;
}

export const RoleCapabilitiesDialog = ({ myRole, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const me = (myRole ?? "viewer").toLowerCase() as ClmRole;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Role Matrix
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Role Permissions
          </DialogTitle>
          <DialogDescription>
            Who can do what on this contract workspace. Your role:{" "}
            <Badge variant="outline" className={`${CLM_ROLE_META[me]?.tone ?? ""} text-[10px] h-4 ml-0.5`}>
              {CLM_ROLE_META[me]?.label ?? "Viewer"}
            </Badge>
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="font-medium py-1.5 pr-2">Capability</th>
                {ROLE_ORDER.map((r) => (
                  <th key={r} className="font-medium px-1.5 py-1.5 text-center">
                    <Badge variant="outline" className={`${CLM_ROLE_META[r].tone} text-[9px] h-4 capitalize`}>
                      {CLM_ROLE_META[r].label}
                    </Badge>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAP_ORDER.map((c) => (
                <tr key={c} className="border-b last:border-b-0">
                  <td className="py-1.5 pr-2 text-foreground/80">{CAP_LABELS[c]}</td>
                  {ROLE_ORDER.map((r) => {
                    const allowed = !!MATRIX[r]?.[c];
                    const isMe = r === me;
                    return (
                      <td key={r} className={`text-center py-1.5 ${isMe ? "bg-muted/40" : ""}`}>
                        {allowed ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600 mx-auto" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-muted-foreground/40 mx-auto" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-muted-foreground mt-2">
            Editor drafts auto-save and apply immediately, but only Approver, Legal, or Owner can sign off (Approve)
            changes. Sealed approvals on a finalized workspace cannot be reverted.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
