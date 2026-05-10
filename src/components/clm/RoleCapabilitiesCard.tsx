import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, ShieldCheck } from "lucide-react";
import { CLM_ROLE_META, normalizeRole, type ClmRole } from "@/lib/clmRoles";

type Cap = "view" | "comment" | "edit" | "submit" | "approve" | "revert" | "tagApprovers" | "manageAccess" | "sign";

const CAP_LABELS: Record<Cap, string> = {
  view: "View document",
  comment: "Comment & @mention",
  edit: "Edit sections (auto-saves draft)",
  submit: "Submit for approval",
  revert: "Revert pending / own drafts",
  approve: "Approve / reject changes",
  tagApprovers: "Tag collaborators for approval",
  manageAccess: "Add / remove collaborators",
  sign: "Sign final document",
};

const MATRIX: Record<ClmRole, Partial<Record<Cap, boolean>>> = {
  owner:           { view: true, comment: true,  edit: true,  submit: true,  revert: true,  approve: true,  tagApprovers: true,  manageAccess: true,  sign: true },
  editor_approver: { view: true, comment: true,  edit: true,  submit: true,  revert: true,  approve: true,  tagApprovers: true,  manageAccess: false, sign: false },
  signer:          { view: true, comment: true,  edit: false, submit: false, revert: false, approve: false, tagApprovers: false, manageAccess: false, sign: true },
  viewer:          { view: true, comment: false, edit: false, submit: false, revert: false, approve: false, tagApprovers: false, manageAccess: false, sign: false },
};

const ROLE_ORDER: ClmRole[] = ["owner", "editor_approver", "signer", "viewer"];
const CAP_ORDER: Cap[] = ["view", "comment", "edit", "submit", "revert", "approve", "tagApprovers", "manageAccess", "sign"];

interface Props {
  myRole?: string | null;
}

export const RoleCapabilitiesCard = ({ myRole }: Props) => {
  const me = normalizeRole(myRole);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> Role Permissions
        </CardTitle>
        <CardDescription>
          A single collaborator role keeps governance simple — the audit trail captures who did what.
          Your role:{" "}
          <Badge variant="outline" className={`${CLM_ROLE_META[me]?.tone ?? ""} text-[10px] h-4 ml-0.5`}>
            {CLM_ROLE_META[me]?.label ?? "Viewer"}
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground border-b">
              <th className="font-medium py-1.5 pr-2">Capability</th>
              {ROLE_ORDER.map((r) => (
                <th key={r} className="font-medium px-1.5 py-1.5 text-center">
                  <Badge variant="outline" className={`${CLM_ROLE_META[r].tone} text-[9px] h-4`}>
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
          Editor / Approvers can edit, tag others, and sign off on changes. Signers are added after the
          contract is finalized to execute the agreement.
        </p>
      </CardContent>
    </Card>
  );
};
