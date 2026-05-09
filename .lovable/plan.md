# Granular Edit Review, Tagging & Revert

Today, edits are saved as drafts and submitted in batches to **one** approver, with revert only available from the version-history dialog. You're asking for a richer, Google-Docs / GitHub-PR-style flow:

- Every individual edit can be reviewed in place
- Editors **and** Approvers can accept changes (Editors merge their own peers' minor edits; Approvers are required for legal/material ones)
- Users can `@mention` collaborators on a specific change to pull them in
- Threaded comments live on the change itself
- One-click revert on any change (live or historical)

## Proposed Logic (the "best" model)

### 1. Two-tier acceptance — separate "merge" from "approve"
Each `clm_section_revisions` row gains:

- `merge_status`  — `pending | merged | reverted` (who applied the text change)
- `approval_status` — keep existing (`auto | pending | approved | rejected`)

Rules:
| Actor | Can merge? | Can approve? | Can revert? |
|---|---|---|---|
| **Owner** | Yes | Yes | Yes (any) |
| **Approver / Legal** | Yes | **Yes** | Yes (any unsealed) |
| **Editor** | Yes (own + peer Editor edits) | No (still needs Approver sign-off) | Own edits, or any pending peer edit |
| **Reviewer / Viewer** | No | No | No |

A revision is **"sealed"** (locked from revert) once `approval_status = approved` AND the workspace status ≥ `approved`. Before that, anyone with merge/approve rights can revert it.

### 2. Tagging & threaded comments per revision
New table `clm_revision_comments`:
- `revision_id`, `author_user_id`/`author_email`, `body`, `mentions[]`, `parent_comment_id`, `resolved_at`

Mentions (`@email` or `@name`) trigger a single notification to that collaborator with deep-link to the revision card. Mentioning someone with Approver/Editor role flags the revision with `requested_reviewers[]` so it appears in their queue.

### 3. Revert as a first-class action (not just "restore old version")
A revert produces a **new revision** (`change_summary = "Reverted v4 by Jane"`, `previous_body = current`, `new_body = target version's previous_body`). This:
- Preserves the audit trail (no destructive deletes)
- Lets the revert itself be reviewed/approved like any change
- Works identically for "undo my own draft" and "roll back an approved clause"

### 4. UI surfaces
- **Inline change card** in `FullDocumentView` and `SectionsList`: shows diff, author, status chips, Merge / Approve / Revert / Comment buttons gated by capability
- **Comment thread** expands under each change card with `@mention` autocomplete pulled from `contacts + externalAccess`
- **Revisions panel** (`RevisionHistoryPanel`) gets per-row Revert + "Request review from…" picker
- **DraftSubmissionBar** keeps batch submit, but auto-includes any revisions a user was `@mentioned` to review

### 5. Notifications (respecting your batching rule)
- `@mention` → 1 immediate email to the tagged person (these are intentional pings, not noise)
- Merge / Approve / Revert → no email; surfaces in the in-app activity feed only
- Batch submit for review → unchanged digest behavior

## Technical Changes

**Migration**
- `ALTER clm_section_revisions ADD COLUMN merge_status text DEFAULT 'merged'`, `requested_reviewers text[]`, `sealed_at timestamptz`
- New table `clm_revision_comments` with RLS mirroring `clm_section_comments`
- RPC `revert_clm_revision(revision_id, note)` → inserts a new inverse revision and re-applies body
- RPC `request_clm_revision_review(revision_id, emails[], message)` → updates `requested_reviewers`, enqueues mention notifications
- Trigger to set `sealed_at` when approval_status flips to `approved` and instance status ≥ `approved`

**Frontend**
- New `RevisionChangeCard.tsx` (merge / approve / revert / comment / mention)
- New `RevisionCommentThread.tsx` with `@mention` autocomplete
- Update `FullDocumentView`, `SectionsList`, `RevisionHistoryPanel` to render the new card
- Extend `useClmInstance.ts` with `useRevertRevision`, `useRequestRevisionReview`, `useRevisionComments`, `usePostRevisionComment`
- Capability helpers in `clmRoles.ts`: `canMerge`, `canApprove`, `canRevert(revision, role, isAuthor)`

**Edge function**
- Extend `clm-notify-revision` with `mention` and `review_requested` event types (single-recipient, immediate)

## Out of scope (ask if you want them)
- Character-level suggestions à la Google Docs "Suggesting" mode (current model is whole-section diffs)
- Branching / parallel edit conflict resolution beyond last-write-wins on merge
