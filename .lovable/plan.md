## Goal

Today every save in a CLM workspace creates a `clm_section_revisions` row. There is no concept of a labeled "version" of the document, anyone with the workspace can save, and reverting / approval logic is per-revision rather than per-version. We need a clearer versioning model where:

- Only **invited collaborators with a defined role** can edit, snapshot, approve, or revert versions.
- The team can produce **named versions** (v1, v2…) of the whole contract, not just per-section diffs.
- Each version has a clear lifecycle: **Draft → Pending Review → Published → Sealed**.
- All transitions are tracked in the audit log with user + timestamp + role.

---

## Versioning model

Two layers, working together:

```text
Document Version (whole workspace)        clm_document_versions
   ├── label  (v1, v2, "Final for signature")
   ├── status (draft | pending | published | sealed | superseded)
   ├── created_by + role_at_time
   ├── snapshot of every section body
   └── linked revisions that fed into it
        │
        ▼
Section Revisions (per edit, existing)    clm_section_revisions
   └── now stamped with current_version_id
```

- **Draft**: editable. Editors keep saving — each save bumps revisions inside the current draft version.
- **Pending Review**: snapshot is frozen; only Approver / Legal / Owner can approve or send back.
- **Published**: becomes the new "current" version. Previous published version is marked `superseded`. A new Draft version is auto-opened for further edits.
- **Sealed**: locked after signature. No reverts, no edits, ever.

Reverts always create a **new revision** in the active Draft version (never mutate history).

---

## Role gating (who can do what)

Reuses existing roles in `src/lib/clmRoles.ts`. Versioning actions are exposed only to invited collaborators (`clm_instance_contacts` + `clm_external_access`); account-owner fallback kept.

| Action                              | Owner | Legal | Approver | Editor | Reviewer | Signer | CC | Viewer |
|------------------------------------|:-----:|:-----:|:--------:|:------:|:--------:|:------:|:--:|:------:|
| Edit current draft (auto-save)     |  ✓    |  ✓    |   ✓      |  ✓     |          |        |    |        |
| Open new Draft after publish       |  ✓    |  ✓    |   ✓      |  ✓     |          |        |    |        |
| Submit Draft → Pending Review      |  ✓    |  ✓    |   ✓      |  ✓     |          |        |    |        |
| Approve (Pending → Published)      |  ✓    |  ✓    |   ✓      |        |          |        |    |        |
| Reject Pending → back to Draft     |  ✓    |  ✓    |   ✓      |        |          |        |    |        |
| Revert to a prior Published ver.   |  ✓    |  ✓    |   ✓      |        |          |        |    |        |
| Seal a Published version           |  ✓    |  ✓    |          |        |          |   ✓    |    |        |
| Comment / @mention                 |  ✓    |  ✓    |   ✓      |  ✓     |   ✓      |   ✓    | ✓  |        |
| View version history               |  ✓    |  ✓    |   ✓      |  ✓     |   ✓      |   ✓    | ✓  |   ✓    |

Anyone not in `clm_instance_contacts` / `clm_external_access` (and not the account owner) cannot view or act — enforced server-side via the existing `can_edit_clm_instance` / `can_approve_clm_instance` helpers extended with `can_seal_clm_instance` and `can_revert_clm_instance`.

---

## Database changes

New table `clm_document_versions`:
- `id`, `instance_id`
- `version_number` (auto-increment per instance)
- `label` (optional human label)
- `status` enum (`draft | pending | published | sealed | superseded`)
- `snapshot_sections jsonb` (array of `{section_id, key, title, body}` at snapshot time)
- `created_by`, `created_by_role`, `created_at`
- `submitted_by`, `submitted_at`
- `reviewed_by`, `reviewed_by_role`, `reviewed_at`, `review_note`
- `sealed_by`, `sealed_at`
- `supersedes_version_id`

Add `current_version_id` to `clm_template_instances` (the active Draft).
Add `version_id` to `clm_section_revisions` (which version this revision belongs to).
RLS: read for any contact / external-access / owner; writes via SECURITY DEFINER RPCs only.

New RPCs (all enforce role server-side):
- `clm_open_new_draft_version(instance_id)` — Editor+
- `clm_submit_version_for_review(version_id)` — Editor+
- `clm_review_version(version_id, decision, note)` — Approver/Legal/Owner
- `clm_revert_to_version(instance_id, target_version_id)` — Approver/Legal/Owner; copies snapshot back into sections inside a fresh Draft version, never deletes history
- `clm_seal_version(version_id)` — Owner/Legal/Signer (only when `published`)

Backfill: create one `published` version per existing instance from current section bodies, then open a fresh `draft` version on top.

---

## UI changes

1. **Header**: replace ad-hoc status select with a **Version pill** ("v3 · Draft") + dropdown showing the version timeline. Existing status select moves into the version's review menu.
2. **New `VersionTimelinePanel`** (replaces parts of `RevisionHistoryPanel`):
   - Vertical timeline of versions with badges (Draft / Pending / Published / Sealed / Superseded), author, timestamp, role.
   - Expand a version to see the section-level revisions that rolled into it.
   - Per-row actions gated by the matrix above: `Submit for review`, `Approve`, `Reject`, `Revert to this version`, `Seal`, `Open new draft`.
3. **`RevisionHistoryPanel`** stays for in-version revisions but is nested under the active version.
4. **`AuditLogPanel`** adds `version.opened`, `version.submitted`, `version.approved`, `version.rejected`, `version.reverted`, `version.sealed` event types.
5. **Save bar** shows "Editing Draft v4 — 3 unsaved revisions since v3 (Published)".
6. **`RoleCapabilitiesDialog`** matrix updated to reflect new versioning rows.

If a user without the right role tries an action, the button is disabled with a tooltip explaining who can perform it.

---

## Out of scope

- Branching (parallel drafts) — keep linear for v1.
- Per-section approvals — still supported via existing revision flow inside a Draft.
- Diff visualization between two arbitrary versions — can be a follow-up; this plan covers the data so it's a UI-only addition later.

---

## Rollout

1. Migration: new table, columns, RPCs, RLS, backfill.
2. Hooks: `useDocumentVersions`, `useOpenDraftVersion`, `useSubmitVersion`, `useReviewVersion`, `useRevertToVersion`, `useSealVersion`.
3. UI: `VersionTimelinePanel`, header version pill, updated save bar, capabilities matrix.
4. Audit log event types + backfill of synthetic "v1 published" event.
