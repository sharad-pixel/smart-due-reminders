## Goal
Bring CLM section editing closer to Google Docs: a true track-changes experience (suggestions overlaid on the live text, accept/reject inline) and a one-click "Push to Google Docs" that creates a real Google Doc from the workspace using the existing Google OAuth (already used for Sheets / Smart Ingestion).

---

## Part 1 — Google Docs-style Track Changes

### What changes for the user
- **Suggesting mode**: when an editor opens a section, they can switch between *Editing* (publishes immediately, current behavior) and *Suggesting* (default for non-owners). In Suggesting mode every change becomes a tracked proposal — insertions show green-underlined, deletions show red strike-through, exactly like Google Docs.
- **Inline review**: approvers see the suggestions rendered over the live body with hover chips ("Accept" / "Reject") on each change, plus a side rail listing every suggestion with author, timestamp, and a one-click jump.
- **Granular approval**: instead of approving an entire revision blob, the approver can accept/reject *individual suggestions*. Once all are resolved, the section is auto-promoted to a new published version with a clean audit trail.
- **Comments on suggestions**: short threaded reply on each suggestion (uses existing `clm_section_comments` with a new `revision_id` link).
- **Authorship colors**: each contributor gets a stable color (consistent with Kurt's persona color system) so multiple editors are visually distinguishable.

### Technical approach
- New table `clm_section_suggestions` (per-change rows): `revision_id`, `section_id`, `change_index`, `op` (`insert`|`delete`), `anchor_start`, `anchor_end`, `text`, `status` (`pending`|`accepted`|`rejected`), `resolved_by`, `resolved_at`, `author_email`, `author_color`.
- A diff utility (extends `src/lib/textDiff.ts`) splits a proposed `new_body` against `previous_body` into a list of atomic ops, written when a "Suggesting" save fires.
- New component `TrackChangesEditor.tsx` — a contenteditable surface that renders the live body interleaved with `<ins>`/`<del>` spans bound to suggestion rows, with a floating accept/reject popover.
- New component `SuggestionsRail.tsx` — vertical list of pending suggestions for the section, mirrors Google Docs' right-hand rail.
- Database trigger: when **all** suggestions for a revision become `accepted`/`rejected`, the trigger replays the accepted ops against `clm_instance_sections.body` and stamps the revision `approved`. This preserves the existing "write-on-approve" model.
- Kurt integration: his recommendation card now also shows per-suggestion verdicts ("Kurt suggests rejecting change #3 — broadens indemnity").

### Files
- new: `src/components/clm/TrackChangesEditor.tsx`, `src/components/clm/SuggestionsRail.tsx`, `src/hooks/useSectionSuggestions.ts`
- edit: `src/components/clm/SectionEditDialog.tsx` (add Editing/Suggesting toggle, route writes to suggestion engine), `src/components/clm/ApprovalsPanel.tsx` (replace blob approve with per-suggestion review), `src/components/clm/KurtRecommendationCard.tsx` (per-suggestion verdicts), `src/lib/textDiff.ts` (export atomic-op diff)
- new migration: `clm_section_suggestions` table + RLS + trigger that promotes the section once everything is resolved

---

## Part 2 — Push to Google Docs

### What changes for the user
- New **"Push to Google Docs"** button in the workspace header (next to Kurt) and on the Approvals panel.
- First push from a workspace runs a one-time consent step that adds the `documents` scope to the existing Google OAuth (Drive/Sheets is already in place — this is a scope upgrade, not a new connection).
- The button creates a Google Doc named after the workspace, writes each section as a Heading-1 block followed by its body text, and stores the resulting `document_id` + share URL on the workspace so subsequent pushes update the same document instead of creating a new one.
- A "Open in Google Docs" link appears once a doc exists; status pill shows "Synced · 2m ago".

### Technical approach
- Reuse the existing `google_oauth_tokens` table populated by Sheets / Smart Ingestion. Add helper `requireGoogleDocsScope()` that checks the stored scope set and triggers a re-consent (`prompt=consent`, scopes = existing + `https://www.googleapis.com/auth/documents`) when missing — this matches the platform's existing OAuth flow rules in memory.
- New edge function `clm-push-to-gdocs`:
  1. Loads the workspace + sections.
  2. Refreshes the Google access token if needed.
  3. If `instance.gdoc_document_id` is null → `POST https://docs.googleapis.com/v1/documents` to create. Else → `batchUpdate` with `deleteContentRange` then re-insert.
  4. Builds `requests[]` from sections (heading + paragraph). Uses our existing TipTap-style mapping pattern.
  5. Persists `gdoc_document_id`, `gdoc_url`, `gdoc_synced_at` on `clm_contract_instances`.
- New small migration: add those three columns to `clm_contract_instances`.
- Audit log entry per push (`action_type='clm_gdoc_push'`).
- Rate-limited to 1 push every 30s per workspace.

### Files
- new: `supabase/functions/clm-push-to-gdocs/index.ts`, `src/components/clm/PushToGoogleDocsButton.tsx`
- edit: `src/pages/ClmInstanceDetail.tsx` (mount the button), `src/integrations/supabase/types.ts` (auto-regenerated), `supabase/config.toml` (register function)
- new migration: add `gdoc_document_id`, `gdoc_url`, `gdoc_synced_at` to `clm_contract_instances`

---

## Out of scope
- Real-time multi-cursor co-editing (Google Docs OT/CRDT-level). Suggesting mode is async, not live presence.
- Pulling edits **back** from Google Docs (one-way push for now — can be added later as a "Pull from Docs" once people validate the workflow).
- Embedded comments syncing both ways with Google Docs comments.
- Per-section push (always pushes the whole workspace document).

---

## Risks / Notes
- Re-consent UX: users who already authorized Sheets will see the Google consent screen once more to grant Docs scope. This is unavoidable and matches platform memory's OAuth rules.
- Track-changes editor on a contenteditable surface needs careful selection handling; we will keep it textual (no rich formatting marks yet) so suggestion anchors remain stable.
