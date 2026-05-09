import { Crown, Pencil, MessageSquare, CheckCircle2, PenLine, Eye, Scale, Mail } from "lucide-react";

export type ClmRole =
  | "owner"
  | "editor"
  | "approver"
  | "reviewer"
  | "signer"
  | "legal"
  | "cc"
  | "viewer";

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
  owner:    { label: "Owner",    icon: Crown,         tone: "bg-amber-500/15 text-amber-700 border-amber-500/30",
              caps: { edit: true,  comment: true,  approve: true,  sign: true,  view: true } },
  editor:   { label: "Editor",   icon: Pencil,        tone: "bg-sky-500/15 text-sky-700 border-sky-500/30",
              caps: { edit: true,  comment: true,  approve: false, sign: false, view: true } },
  approver: { label: "Approver", icon: CheckCircle2,  tone: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
              caps: { edit: false, comment: true,  approve: true,  sign: false, view: true } },
  reviewer: { label: "Reviewer", icon: MessageSquare, tone: "bg-violet-500/15 text-violet-700 border-violet-500/30",
              caps: { edit: false, comment: true,  approve: false, sign: false, view: true } },
  signer:   { label: "Signer",   icon: PenLine,       tone: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30",
              caps: { edit: false, comment: true,  approve: false, sign: true,  view: true } },
  legal:    { label: "Legal",    icon: Scale,         tone: "bg-rose-500/15 text-rose-700 border-rose-500/30",
              caps: { edit: false, comment: true,  approve: true,  sign: false, view: true } },
  cc:       { label: "CC",       icon: Mail,          tone: "bg-slate-500/15 text-slate-600 border-slate-500/30",
              caps: { edit: false, comment: true,  approve: false, sign: false, view: true } },
  viewer:   { label: "Viewer",   icon: Eye,           tone: "bg-slate-500/10 text-slate-600 border-slate-500/30",
              caps: { edit: false, comment: false, approve: false, sign: false, view: true } },
};

export const getRoleMeta = (role?: string | null) => {
  const key = (role ?? "viewer").toLowerCase() as ClmRole;
  return CLM_ROLE_META[key] ?? CLM_ROLE_META.viewer;
};

export const CAPABILITY_LABEL: Record<keyof ClmCapabilities, { label: string; short: string }> = {
  edit:    { label: "Can edit",    short: "Edit" },
  comment: { label: "Can comment", short: "Comment" },
  approve: { label: "Can approve", short: "Approve" },
  sign:    { label: "Can sign",    short: "Sign" },
  view:    { label: "Can view",    short: "View" },
};

// ─────────────────────────────────────────────────────────────────────────
// Per-revision capabilities — separates "merge" (apply text) from "approve"
// (sign off legally). Editors can merge; only Approver/Legal/Owner can approve.
// Anyone with merge or approve can revert any unsealed change. Authors can
// always revert their own pending drafts.
// ─────────────────────────────────────────────────────────────────────────

const APPROVER_ROLES: ClmRole[] = ["owner", "approver", "legal"];
const EDITOR_ROLES: ClmRole[]   = ["owner", "editor", "approver", "legal"];

export const canApproveRevisions  = (role?: string | null) =>
  APPROVER_ROLES.includes(((role ?? "viewer").toLowerCase() as ClmRole));

export const canMergeRevisions    = (role?: string | null) =>
  EDITOR_ROLES.includes(((role ?? "viewer").toLowerCase() as ClmRole));

export const canCommentOnRevisions = (role?: string | null) =>
  getRoleMeta(role).caps.comment;

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
  if (canMergeRevisions(role)) return true;
  if (myUserId && rev.edited_by === myUserId && rev.approval_status !== "approved") return true;
  return false;
};
