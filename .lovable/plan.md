# CLM: Friendlier Approvals UI + Secure External Collaborator Portal

Two related improvements to the CLM workspace:

## 1. Friendlier Change Tracking & Approval Assignment

Today the `RevisionHistoryPanel` is a dense audit log with inline accept/reject. Hard to scan, and you can't assign a specific approver.

**New UX (in-app, for internal users):**
- Split the right-rail panel into two tabs:
  - **Pending Approvals** (default) — card per pending revision: section title, who edited, time, change summary, before/after diff toggle, **Assign approver** dropdown (account collaborators + internal team), Approve / Request Changes buttons, optional note.
  - **History** — chronological feed of all approved/rejected/auto-saved changes with status pills and reviewer name.
- Add a top summary strip: "X pending · Y approved this week · Z rejected".
- New `assigned_approver_id` column on `clm_instance_revisions`; assigning sends an in-app notification + email to that person.
- Section editor: when submitting for approval, pick an assignee from the same dropdown.

## 2. Secure-Token External Collaborator Portal

Mirror the payment portal pattern: external party enters their email, receives a magic link, lands on a scoped CLM portal that lists every workspace they're invited to plus their pending tasks (sections to review, approvals requested, comments mentioning them).

**Flow:**
1. From `ContributorsPanel` → "Invite external collaborator" → email + role (Reviewer / Approver / Viewer) + optional expiry.
2. Backend creates a `clm_external_access` row (token uuid, email, instance_id, role, expires_at, last_used_at, revoked_at) and emails a `https://recouply.ai/clm-portal?token=...` link.
3. Edge function `clm-portal-access` validates token by email, returns scoped data: workspaces, sections, pending approvals/tasks assigned to that email, comments threaded with them.
4. Public portal page `/clm-portal` (no auth) — email entry → magic link → token-authenticated session (sessionStorage). Lists workspaces, opens read/comment/approve view per their role.
5. Owner can **renew** (rotate token + new expiry, resend email) or **revoke** from the workspace contributors panel — same affordance as payment portal token rotation.

**Security:**
- Tokens are random uuids, single-purpose, expire (default 30 days, renewable).
- All portal data fetched server-side via SECURITY DEFINER edge function — base tables stay locked behind RLS; no anon SELECT policies added.
- Rate-limit magic-link requests via existing `check_action_rate_limit`.
- Audit log entry on issue / renew / revoke / portal access.

## Technical Plan

**DB migration:**
- `ALTER TABLE clm_instance_revisions ADD COLUMN assigned_approver_id uuid, assigned_approver_email text, assigned_at timestamptz`.
- New table `clm_external_access` (id, instance_id, debtor_id nullable, email, role, token uuid unique, expires_at, last_used_at, revoked_at, created_by, created_at).
- New table `clm_external_tasks` is unnecessary — derive tasks from existing revisions + comments + assigned_approver_email match.
- RLS: account members can manage rows for their workspaces; no anon SELECT (portal goes through edge function only).

**Edge functions:**
- `clm-invite-external` — creates access row, sends magic-link email via existing email infra.
- `clm-portal-request-link` — email lookup, rate-limited, sends magic link.
- `clm-portal-access` — `{ token }` → returns workspaces + tasks assigned to that email; updates `last_used_at`.
- `clm-portal-action` — `{ token, action: approve|reject|comment, payload }` — performs scoped writes server-side.

**Frontend:**
- Rewrite `RevisionHistoryPanel` → `ApprovalsPanel` with tabs (Pending / History) + summary chips + per-card assignee dropdown.
- Update `SectionEditDialog` to add optional approver picker on Submit.
- Replace "Add external" form in `ContributorsPanel` with "Invite external collaborator" dialog (email + role + expiry); list issued tokens with status (active/expired/revoked) + Renew / Revoke / Copy link actions.
- New page `src/pages/ClmPortal.tsx` (route `/clm-portal`) with two states: email entry → workspace list → workspace detail (sections read, comment, approve if role=Approver).
- Add route in `App.tsx`, exclude from sitemap.

**Out of scope this round:**
- Realtime presence in portal.
- Bulk approver assignment.
- Custom email template branding (uses default transactional template).

Confirm and I'll implement.