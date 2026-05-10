import { Crown, ShieldCheck, PenLine, Eye } from "lucide-react";

// Simplified CLM role matrix:
// - owner            → full control (workspace owner / creator)
// - editor_approver  → can edit, comment, approve, tag others (single collaborator role)
// - signer           → added AFTER finalization to execute the contract
// - viewer           → read-only
//
// Legacy values (editor / approver / reviewer / legal / cc) are mapped to
// "editor_approver" so existing data keeps working without a migration.
export type ClmRole = "owner" | "editor_approver" | "signer" | "viewer";

export interface ClmCapabilities {
  edit: boolean;
  comment: boolean;
  approve: boolean;
  sign: boolean;
  view: boolean;
}

export const CLM_ROLE_META: Record<ClmRole, {
  label: string;
  icon: any;
  caps: ClmCapabilities;
  tone: string;
}> = {
  owner: {
    label: "Owner",
    icon: Crown,
    tone: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    caps: { edit: true, comment: true, approve: true, sign: true, view: true },
  },
  editor_approver: {
    label: "Editor / Approver",
    icon: ShieldCheck,
    tone: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    caps: { edit: true, comment: true, approve: true, sign: false, view: true },
  },
  signer: {
    label: "Signer",
    icon: PenLine,
    tone: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30",
    caps: { edit: false, comment: true, approve: false, sign: true, view: true },
  },
  viewer: {
    label: "Viewer",
    icon: Eye,
    tone: "bg-slate-500/10 text-slate-600 border-slate-500/30",
    caps: { edit: false, comment: false, approve: false, sign: false, view: true },
  },
};

// Map any legacy or raw role string → canonical ClmRole
export const normalizeRole = (role?: string | null): ClmRole => {
  const k = (role ?? "viewer").toLowerCase().trim();
  if (k === "owner") return "owner";
  if (k === "signer") return "signer";
  if (k === "viewer") return "viewer";
  // Everything that used to imply edit/comment/approve collapses into the
  // single collaborator role.
  if (["editor_approver", "editor", "approver", "reviewer", "legal", "cc"].includes(k)) {
    return "editor_approver";
  }
  return "viewer";
};

export const getRoleMeta = (role?: string | null) => CLM_ROLE_META[normalizeRole(role)];

export const CAPABILITY_LABEL: Record<keyof ClmCapabilities, { label: string; short: string }> = {
  edit:    { label: "Can edit",    short: "Edit" },
  comment: { label: "Can comment", short: "Comment" },
  approve: { label: "Can approve", short: "Approve" },
  sign:    { label: "Can sign",    short: "Sign" },
  view:    { label: "Can view",    short: "View" },
};

// ─────────────────────────────────────────────────────────────────────────
// Capability helpers — drive UI gating across the workspace.
// Editor/Approver merges the old "merge" + "approve" capabilities into one.
// ─────────────────────────────────────────────────────────────────────────
export const canApproveRevisions = (role?: string | null) => {
  const r = normalizeRole(role);
  return r === "owner" || r === "editor_approver";
};

export const canMergeRevisions = (role?: string | null) => canApproveRevisions(role);

export const canCommentOnRevisions = (role?: string | null) => getRoleMeta(role).caps.comment;

export interface RevisionForCaps {
  edited_by?: string | null;
  approval_status?: string | null;
  sealed_at?: string | null;
}

export const canRevertRevision = (
  rev: RevisionForCaps | undefined | null,
  role?: string | null,
  myUserId?: string | null,
) => {
  if (!rev) return false;
  if (rev.sealed_at) return false;
  if (canApproveRevisions(role)) return true;
  if (myUserId && rev.edited_by === myUserId && rev.approval_status !== "approved") return true;
  return false;
};

// Selectable role options surfaced in collaborator pickers.
// Signers are intentionally collected only after a contract is finalized.
export const COLLABORATOR_ROLE_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: "editor_approver", label: "Editor / Approver", description: "Edit, comment, tag others, and approve changes" },
  { value: "viewer",          label: "Viewer",            description: "Read-only access — no edits or comments" },
];

export const SIGNER_ROLE_OPTION = { value: "signer", label: "Signer", description: "Executes the final contract" };
