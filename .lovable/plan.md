
# CLM Amendment Approval Workflow

Today the pieces exist (revisions, assignee field, portal, comments) but the lifecycle is loose: anyone with edit rights can save changes, no one is notified, and approvals only happen if someone manually opens the panel. This plan ties it together into a proper amendment → review → approval cycle that mirrors enterprise CLM patterns (DocuSign CLM, Ironclad, Juro).

## Workflow

```text
Owner invites users → User edits a section → Amendment saved (pending) →
Assignee notified by email → Reviewer opens portal/app → Approve / Request changes →
All workspace contributors notified of decision → Audit log entry
```

### Roles (workspace-scoped)
- **Owner** — full control, manages contributors, can override approvals.
- **Editor** — can amend sections; amendments require approval before becoming the live version.
- **Approver** — can approve/reject pending amendments assigned to them.
- **Reviewer** — read + comment only.
- **Viewer** — read only.

Internal users get roles via `clm_workspace_contributors`; external users via `clm_external_access` (already exists). Same role enum used for both.

## Amendment lifecycle (per section)

1. **Draft saved** — editor submits change → row in `clm_section_revisions` with `approval_status='pending'`, `version_number` auto-incremented (already in place), `assigned_approver_email` required (picker in editor, defaults to workspace owner).
2. **Live body unchanged until approved** — section's `body` only updates when revision is approved. (Today the editor writes to body immediately; we'll switch to write-on-approve so pending changes are truly proposed amendments.)
3. **Notification fan-out** — DB trigger enqueues a notification job; edge function `clm-notify-revision` sends:
   - Email to the assigned approver (with deep link: in-app for internal, portal token URL for external).
   - In-app notification (`user_alerts`) for internal assignees.
4. **Decision** — Approve writes new body + marks revision approved. Reject reverts (keeps body as-is) and notifies the editor with the reviewer's note.
5. **Audit** — every state change logged in `audit_logs` (action_type `clm_amendment_*`).

## What this changes vs today

| Today | After |
|---|---|
| Section body updated on save | Body updated only on approval |
| Assignee optional, free-text | Required dropdown (workspace contributors + portal users), defaults to owner |
| No notifications | Email + in-app on assign, approve, reject |
| Approvals panel only shows in-app | Same panel + portal page mirrors it for externals |
| No "request changes" loop | Reject with note → editor sees alert + can resubmit (creates new revision linked via `parent_revision_id`) |

## Technical Plan

**DB migration:**
- `ALTER TABLE clm_section_revisions ADD COLUMN parent_revision_id uuid REFERENCES clm_section_revisions(id), ADD COLUMN notified_at timestamptz`.
- Make `assigned_approver_email` NOT NULL going forward (backfill existing pending rows to workspace owner email).
- New trigger `notify_clm_revision_assigned`: on INSERT or assignee change with status='pending', call `pg_net` to invoke `clm-notify-revision` (or insert a row in a lightweight `clm_notification_queue` polled by the function — safer than pg_net dependency).
- Trigger on UPDATE of `approval_status`: if `approved`, copy `new_body` into `clm_instance_sections.body`; if `rejected`, no-op on body but enqueue rejection notification.

**Edge functions:**
- `clm-notify-revision` — drains `clm_notification_queue`, sends email via existing `send-email` infra. Builds the right link (internal `/contracts/{id}` vs portal `/clm-portal?token=...`), looks up portal token from `clm_external_access` (creates one if external assignee has no active token, with default 30-day expiry).
- Tiny scheduled cron (every 1 min) to drain the queue, plus immediate trigger after insert.

**Frontend:**
- `SectionEditDialog` — assignee picker becomes required, with helper text "Changes go live after approval."
- `ApprovalsPanel` — already in place; add a "Resubmit" action on rejected revisions (opens edit dialog pre-filled).
- `ContributorsPanel` — surface role per contributor with an inline role dropdown (owner-only).
- Section list — visual cue when a section has a pending amendment ("Amendment pending review by X").
- `ClmPortal` — add same "Resubmit" affordance for external editors; already shows pending tasks.

**Out of scope this round:**
- Multi-step approval chains (one approver per amendment for now).
- Conditional routing rules (e.g. by clause type or value threshold).
- E-signature integration on final approval.

Confirm and I'll implement.
