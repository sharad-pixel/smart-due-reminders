# Industry-Agnostic CLM Refactor

Today the CLM is tilted toward healthcare (BAA/HIPAA defaults, healthcare-style approval triggers, single-track section editing). This plan rebuilds the experience around a **controlled document model** that works for SaaS, goods, services, healthcare, AI, professional services, marketplaces, and usage-based companies — while keeping HIPAA/BAA as an *optional* template family and metadata profile.

---

## 1. Template library — broaden + categorize

Add an `industry_category` and `document_type` to `clm_templates.metadata` plus a curated seed catalog grouped by:

- **Commercial / SaaS:** MSA, Order Form, SOW, DPA, SLA, Amendment, Renewal, Change Order
- **Goods / Product:** Purchase, Supply, Sales, Distributor, Reseller, Product Terms, Warranty, Returns
- **Services:** Services Agreement, Engagement Letter, SOW, Change Order, SLA, Retainer, Project Agreement
- **Healthcare / Regulated:** BAA, HIPAA Addendum, Security Addendum, DPA
- **General Legal:** NDA, Mutual NDA, Vendor, Partner, Termination Notice, Custom

Template gallery (`UseTemplateDialog` / `AddTemplateToWorkspaceDialog`) gets a category filter + search; default view is **All industries**, not healthcare. New workspace flow asks "What kind of agreement?" first.

## 2. Workspace business profile + metadata

Add a `business_profile` jsonb to `clm_template_instances` capturing the workspace's commercial context. UI offers presets for **SaaS / Goods / Services / Healthcare / General**, each surfacing the relevant metadata fields (ARR/TCV/ACV/term for SaaS; SKUs/qty/delivery/warranty for Goods; scope/milestones/rates for Services; BAA/PHI/breach window for Healthcare). Healthcare fields only appear when that profile is selected or the template is tagged `healthcare`.

## 3. Controlled document model (3 states)

Introduce explicit document states so external users never touch the source of truth.

```text
                ┌──────────────────────┐
   Internal ───►│  Official Version    │◄─── only internal authorized users edit
                │  (clm_document_      │
                │   versions, locked)  │
                └─────────┬────────────┘
                          │ publish read-only snapshot
                          ▼
                ┌──────────────────────┐
   External ───►│ External Review Copy │  comment / suggest / approve / reject
                │ (read-only mirror)   │
                └─────────┬────────────┘
                          │ feedback flows back as
                          ▼
                ┌──────────────────────┐
                │ Suggested Changes    │  internal owner accept / reject / counter
                │ + Uploaded Redlines  │  → creates next Official Version
                └──────────────────────┘
```

External edits never auto-merge. Uploads land in a new `clm_uploaded_redlines` table as alternate paper.

## 4. Suggested Changes queue (replace inline redline confusion)

Repurpose `clm_section_revisions` into a single **Suggested Changes** feed with: document, section, contributor, current text, proposed text, reason, status (`open | accepted | rejected | countered | needs_discussion`), assigned reviewer, visibility (`internal_only | external_visible`), timestamp. Internal users get accept / reject / counter / assign / add internal note. External users get suggest / comment / upload redline / approve / reject. Removes the duplicate "Track Changes" + "Revisions" panels in favor of one queue surfaced in the **Review** tab.

## 5. Document-level versioning

Promote `clm_document_versions` to the primary versioning unit (sections roll up). Each version stores: number, created_by, created_at, reason, source_of_changes (`internal_edit | external_feedback | uploaded_redline | counter`), approval_status, shared_externally, signed_sealed. Add fixed lifecycle labels:

`v1 Internal Draft → v2 Internal Reviewed → v3 Shared Externally → v4 External Feedback Received → v5 Revised Draft → v6 Approved for Signature → v7 Signed/Sealed`

Once `signed_sealed = true`, the row is immutable (DB trigger blocks updates).

## 6. Configurable approval rules by business type

New `clm_approval_rules` table keyed by `account_id` + `business_profile`, storing trigger conditions (discount %, payment terms, warranty deviation, BAA required, liability cap change, customer paper uploaded, etc.) and required approver roles (`Legal | Deal Desk | Finance | Security | Operations | Executive`). Replace the current healthcare-only approval logic with a rules engine that evaluates the workspace profile + suggested changes and produces a dynamic checklist on the **Approvals** tab. Ship sensible defaults per profile.

## 7. Workspace UI — collapse to 4 tabs

Refactor `WorkspaceTemplateTabs` into:

1. **Documents** — selected templates, official versions, external review copies, uploaded customer paper, status, owner, last updated
2. **Review** — comments, suggested changes, uploaded redlines, open issues, assigned reviewers (single unified queue)
3. **Approvals** — required approvals, status, blockers, history (driven by rules engine)
4. **Audit Trail** — `clm_audit_log` filtered by user / version / action / internal-vs-external

Retire/merge: `TrackChangesAndCollaborators`, `TrackChangesReviewer`, `RevisionHistoryPanel`, `VersionTimelinePanel`, separate `SectionCommentsPanel` — their content moves into Review/Audit. Status chips ("Official", "External Feedback", "Pending Review", "Pending Approval", "Signed/Sealed") become consistent across tabs.

## 8. External CLM Hub hardening

`ClmPortal` already handles magic link + countdown. Tighten so external users only see assigned workspaces + the External Review Copy — never internal notes, risk/strategy, pricing notes, or other customers' workspaces. Extend `clm-external-portal` to filter sections/comments by `visibility = external_visible` and to expose only published read-only snapshots, never the live official version.

---

## Technical changes

**DB migrations**
- `clm_templates.metadata`: add `industry_category`, `document_type` (seed catalog rows)
- `clm_template_instances`: add `business_profile jsonb`, `document_state text` (`official | external_review | uploaded_redline`)
- `clm_document_versions`: add `lifecycle_label`, `source_of_changes`, `shared_externally bool`, `signed_sealed bool`; immutability trigger
- `clm_section_revisions`: add `visibility text`, `assigned_reviewer_id`, `counter_proposed_text` (rename status enum)
- New `clm_uploaded_redlines` (file storage path, uploader, status, linked version)
- New `clm_approval_rules` (account_id, business_profile, trigger jsonb, required_roles text[])
- New `clm_approval_requests` (instance_id, version_id, role, status, decided_by, decided_at)

**Edge functions**
- New `clm-evaluate-approvals` — runs rules engine against a version + business_profile → returns required approvals
- Update `clm-external-portal` to enforce `visibility` filter and serve external review snapshot only
- Update `clm-invite-external` to record workspace-level token TTL preset (already in place from previous turn)
- `clm-sectionalize-template` keeps current behavior; tag new templates with `industry_category`

**Frontend**
- New `BusinessProfilePicker` in `NewWorkspaceDialog` (SaaS / Goods / Services / Healthcare / General)
- New `MetadataPanel` rendering profile-specific fields
- New `SuggestedChangesQueue` (replaces TrackChanges* components)
- New `ApprovalsRulesPanel` and `ApprovalRequestsList`
- Refactor `WorkspaceTemplateTabs` to 4 tabs
- Template gallery: industry filter, search, "All industries" default
- Status chip component for the 5 lifecycle states
- External portal: hide internal-only suggested changes, audit, approval rules

**Out of scope (explicit)**
- E-signature provider swap (keep current `clm-send-for-signature`)
- Kurt AI behavior changes (already scoped industry-agnostic via prompts)
- Pricing/billing changes

---

## Rollout order
1. DB migrations + seed industry-tagged template catalog
2. Business profile picker + metadata panel
3. Document-state model + version lifecycle labels
4. Suggested Changes queue (retire duplicate panels)
5. Approval rules engine + Approvals tab
6. 4-tab UI refactor + external portal visibility filter
7. QA pass per profile (SaaS, Goods, Services, Healthcare, General)
