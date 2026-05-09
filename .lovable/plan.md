# Collaborative Approval Flow — CLM

Build a fast, GitHub-PR-style approval workspace on top of existing CLM revisions. Additive only — reuses `clm_revisions`, `clm_approvals`, `clm_audit_logs`, and the existing Review/Approvals tabs. No changes to Collections, Stripe, QuickBooks, or Live Contracts.

## Layered approval model

1. **Suggested Change Approval** — per-revision approve/reject/counter (already partially exists via `RevisionChangeCard`; extend with Counter + Request Clarification + Assign).
2. **Document Version Approval** — sign off on a sealed version snapshot (extend existing `clm_versions`).
3. **Final Executable Approval** — gate that unlocks "Send for Signature" (new flag on instance + check in `PrepareSignaturePackageDialog`).

## Database (additive migration)

New columns / tables:
- `clm_revisions`: add `risk_level` (low/medium/high), `category` (legal/commercial/security/pricing/compliance/other), `counter_text`, `clarification_requested_at`.
- `clm_approval_routing_rules` — account-scoped rules: `category`, `risk_level`, `required_role`, `required_reviewers[]`.
- `clm_approval_requests` — workspace-level approval tasks: `instance_id`, `version_id`, `category`, `assignee_email`, `status` (pending/approved/rejected/changes_requested/delegated/expired), `due_at`, `decided_at`, `note`, `delegated_to`.
- `clm_instance_finalization` — per-instance: `final_approved_at`, `final_approved_by`, `locked_version_id`, `ready_for_signature` bool.
- All RLS via existing `has_account_access(account_id)` patterns.

## Backend logic

- **Auto-categorize + risk-score** on revision insert: trigger function inspects `section_key` keywords (liability/indemnity/HIPAA/BAA → legal+high; payment_terms/discount → pricing+medium; formatting → low). Stored in revision row.
- **Auto-route**: when revision becomes `pending`, insert matching `clm_approval_requests` rows based on `clm_approval_routing_rules`.
- **Readiness check** RPC `clm_compute_readiness(instance_id)` returns `{ score, blockers[], approvals_by_category }`.
- **Finalization** RPC `clm_finalize_instance(instance_id)` — only callable when readiness=100; seals all unsealed revisions, snapshots a version marked `ready_for_signature`, sets instance status `approved_for_signature`, writes audit row.

## Frontend

New / updated components in `src/components/clm/approvals/`:
- `ApprovalSidebar.tsx` — right-side panel: readiness % ring, checklist by category (Legal/Finance/Security/Pricing/Compliance), open suggestion counts, blockers list, assigned-to-me badge.
- `ApprovalCard.tsx` — replaces inline actions in `RevisionChangeCard`: shows section / before / after / contributor / int-ext badge / version / risk chip / category chip / inline actions (Approve, Reject, Counter, Clarify, Assign, Resolve) + comment thread.
- `ApprovalGroupAccordion.tsx` — groups revisions by category with bulk-select header (Approve all low-risk, Mark all resolved).
- `ApprovalTimeline.tsx` — vertical 8-stage timeline (Draft → Internal Review → External Review → Suggestions Resolved → Approvals Complete → Final Version → Sent → Signed).
- `ApprovalRoutingRulesEditor.tsx` — admin table for category/risk → reviewer mapping.
- `FinalizationPanel.tsx` — appears in Approvals tab when readiness=100; "Generate Final Executable Version" button → calls `clm_finalize_instance`.
- `BatchApproveBar.tsx` — sticky action bar shown when ≥1 row selected.

Hooks (`src/hooks/`):
- `useApprovalRequests.ts`, `useApprovalReadiness.ts`, `useApprovalRoutingRules.ts`, `useFinalizeInstance.ts`.

Page integration (`ClmInstanceDetail.tsx`):
- Approvals tab restructured: left = grouped approval cards, right = `ApprovalSidebar`, top = readiness bar, bottom = `ApprovalTimeline` + `FinalizationPanel`.
- `PrepareSignaturePackageDialog` gated on `ready_for_signature`.

Notifications: reuse existing `useNotifications` to fire on approval requested/granted/rejected/finalized.

## Out of scope
- Slack integration (placeholder UI only).
- E-signature provider integration (existing `PrepareSignaturePackageDialog` unchanged beyond gating).
- Cross-workspace approval analytics.

## Files (estimated)
~14 new files, ~3 edited (`ClmInstanceDetail.tsx`, `RevisionChangeCard.tsx`, `PrepareSignaturePackageDialog.tsx`), 1 migration.
