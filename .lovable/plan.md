# Simplified CLM Workspace — Legal & Deal Desk Best Practices

## Best practice we're modeling on
Modern legal/deal-desk tooling (Ironclad, Juro, LinkSquares, DocuSign CLM) converges on a few patterns:

1. **Workspace = a deal**, not a document. It bundles 1-N templates (MSA, Order Form, DPA, NDA…), each negotiated independently with its own redline history.
2. **Each template instance is independently versioned** — accept/reject changes per section, with a clean version timeline (v1, v2, v3 …).
3. **Roles drive UI** — Owner, Editor, Reviewer/Approver, Signer, Viewer. The sidebar always shows "who's in the room and what they can do."
4. **Package step at the end** — owner selects which template versions form the final bundle, freezes them, and pushes to e-sign as a single envelope.

## What changes

### 1. Remove "Associated Documents"
Drop the `DocumentsList` block from `WorkspaceOverviewCard`. Workspace artifacts = the templates attached to it. Nothing else.

### 2. Templates panel becomes the work surface
Replace the small "templates list" card with a **Template tabs** layout:

```text
[ MSA v3 (in review) ] [ Order Form v1 ] [ DPA v2 (approved) ]  [+ Add template]
─────────────────────────────────────────────────────────────────
Section editor | Track-changes reviewer | Version history (per template)
```

- Each tab is one template-instance with its **own** sections, revisions, approvals, and version timeline.
- Switching tabs swaps the editor + approvals + history — they're already template-scoped in the data model; we just need to filter UI by `source_template_id`.
- "Push to Google Docs" and "Track changes" become per-template (each template gets its own Google Doc).

### 3. Fix change tracking on attached templates
Today, sections from extra templates are copied in but the section editor / approvals panel show *all* sections mixed together. We'll:
- Filter `sections`, `revisions`, and `approvals` by the active template tab (`source_template_id`).
- Stamp every revision and approval with `source_template_id` so the version timeline is per-template.
- Add a per-template **Version** chip (auto-increments when a batch of approvals is finalized via "Snapshot version").

### 4. Access & Capabilities sidebar
Replace the current Contributors card with an **Access sidebar** on the right:

```text
ACCESS (5)
─────────────
👑 Owner          Sara Kim          (you)            ✏️ Edit · ✅ Approve · ✍️ Sign
✏️ Editor         alex@acme.com     External         ✏️ Edit · 💬 Comment
👁  Reviewer      legal@acme.com    External         💬 Comment · ✅ Approve
✍️ Signer         cfo@acme.com      External         ✍️ Sign
👁  Viewer        ops@us            Internal         👁  View

[+ Invite]
```

Capability matrix (rendered as small chips next to each person):

| Role      | Edit | Comment | Approve | Sign | View |
|-----------|------|---------|---------|------|------|
| Owner     | ✓    | ✓       | ✓       | ✓    | ✓    |
| Editor    | ✓    | ✓       |         |      | ✓    |
| Approver  |      | ✓       | ✓       |      | ✓    |
| Reviewer  |      | ✓       |         |      | ✓    |
| Signer    |      | ✓       |         | ✓    | ✓    |
| Legal/CC  |      | ✓       |         |      | ✓    |
| Viewer    |      |         |         |      | ✓    |

Defined once in `src/lib/clmRoles.ts` so portal + app share the same source of truth.

### 5. Simpler edit flow
- Section card → single "Edit" button → opens dialog in **Suggesting mode** by default.
- Owners get a "Edit directly (no review)" toggle inside the dialog (skip approval for typo fixes).
- Track-changes reviewer collapses to "X open suggestions" with an Accept all / Reject all and per-change chips (already built — just consolidating).

### 6. E-sign package flow
New **"Prepare for signature"** button in workspace header. Opens a dialog:

```text
Step 1 — Select versions for the package
  [✓] MSA            current v3 (no open suggestions)
  [✓] Order Form     current v1 (no open suggestions)
  [ ] DPA            ⚠️ 2 open suggestions — resolve first

Step 2 — Choose signers   (auto-filled from contributors with role = Signer)
  • cfo@acme.com   — Customer signer
  • sara@us        — Internal signer

Step 3 — Send via
  ( ) DocuSign     ( ) Adobe Sign     (•) Google Docs (manual download)
```

On confirm:
- Freezes the selected template-instances (status = `packaged`, no further edits).
- Renders a single combined PDF (concat in section order, simple header per template).
- Stores the package row in a new `clm_signature_packages` table with `status` (`draft`, `sent`, `signed`, `void`).
- For DocuSign/Adobe: stub a `clm-send-for-signature` edge function with provider switch — wired but provider integration only enabled when corresponding secret exists. Google Docs path uses the existing push function.

## Technical changes

**DB migration**
- `clm_section_revisions`: add `source_template_id uuid` (nullable, backfilled from section).
- `clm_template_instances`: add `version_label text` per attached template (computed via `clm_instance_extra_templates` row + primary).
- `clm_signature_packages` (new): `id, instance_id, status, included_templates jsonb, signers jsonb, sent_at, completed_at, provider text, external_envelope_id text`. RLS scoped through instance ownership.

**Frontend**
- New `clmRoles.ts` (capability matrix).
- New `WorkspaceTemplateTabs.tsx` — manages active template + filters sections.
- New `AccessSidebar.tsx` — replaces ContributorsPanel block on the right rail; reuses existing add/remove mutations.
- New `PrepareSignaturePackageDialog.tsx`.
- New edge function `clm-send-for-signature` (provider-agnostic stub: Google Docs path works today, DocuSign/Adobe return 501 + clear message until secret added).
- Edit `WorkspaceOverviewCard.tsx` — drop documents section.
- Edit `ClmInstanceDetail.tsx` — new layout: header (status + Push to Google Docs + Prepare for signature) · main (tabbed templates) · right rail (Access sidebar + Approvals).
- Edit `useClmInstance.ts` — add `useFinalizeVersion(templateId)`, `useCreateSignaturePackage`, filter helpers by `source_template_id`.

**Out of scope (call out, don't build now)**
- Real-time multi-user cursors.
- Native DocuSign/Adobe envelope creation (we add the hook + UI; actual provider call ships when you add the API key).
- Clause library / playbook compliance scoring.

## Suggested order
1. DB migration + role capability matrix.
2. Drop documents section, switch right rail to Access sidebar.
3. Template tabs + per-template filtering of sections/revisions/approvals/version timeline.
4. Prepare-for-signature dialog + package table + stub edge function.

Approve and I'll implement in that order.
