
## CLM Template Library + AI Sectionalization + Account Collaboration

Extend Contract Intelligence with a 3-stage workflow:

1. **Upload** an MSA / contract template (PDF, DOCX, TXT)
2. **AI sectionalizes** it (parties, term, payment terms, IP, indemnity, termination, confidentiality, governing law, etc.) using GPT-5 via Lovable AI Gateway
3. **Use template** → spin up a contract instance, attach one or many accounts from the existing debtors list, and collaborate (comments per section, status tracking)

### Data model (new tables, all RLS-scoped to `account_id`)

- `clm_templates` — uploaded master templates
  - `id`, `account_id`, `created_by`, `name`, `description`, `source_file_url`, `source_file_name`, `mime_type`, `raw_text`, `status` ('uploading'|'parsing'|'ready'|'failed'), `parse_error`, `metadata` jsonb
- `clm_template_sections` — AI-extracted sections per template
  - `id`, `template_id`, `section_key` (e.g. `payment_terms`), `title`, `body`, `order_index`, `ai_summary`, `risk_flags` jsonb
- `clm_template_instances` — a template "in use" for collaboration
  - `id`, `template_id`, `account_id`, `created_by`, `name`, `status` ('draft'|'in_review'|'approved'|'executed'|'archived'), `notes`
- `clm_instance_debtors` — links instances to debtor accounts (many-to-many)
  - `id`, `instance_id`, `debtor_id`, `added_by`, `role` ('counterparty'|'cc'|'reviewer')
- `clm_section_comments` — per-section collaboration threads
  - `id`, `instance_id`, `section_key`, `author_id`, `body`, `resolved_at`

Storage bucket: `clm-templates` (private), with RLS allowing account members to upload/read their own files.

### Edge function

- `clm-sectionalize-template` — takes `template_id`, downloads the source file from storage, extracts text (PDF.js for PDF, mammoth-style for docx via simple text fallback initially), calls `google/gemini-2.5-flash` (per project memory — overriding the GPT-5 spec from earlier since memory mandates Gemini for AI features) with a structured-output schema, writes rows to `clm_template_sections`, updates template `status` to `ready`.

> Note: project memory says "Gemini-2.5-Flash for all AI features" — I will use that and call it out. If you want GPT-5 specifically for CLM extraction, say so and I'll switch.

### UI changes

- **`/contracts`** — gains a tab layout:
  - **Contracts** (existing list) — unchanged
  - **Templates** (new) — grid of templates with status badge; "Upload Template" button opens drag-drop modal (reuses upload pattern from `DocumentUpload`)
  - Clicking a template → **Template Detail** (new route `/contracts/templates/:id`) showing sectionalized breakdown (accordion of sections, each with title / body / AI summary / risk flags), plus "Use Template" button
  - **Use Template** → modal to name the instance, then redirects to instance detail
- **`/contracts/instances/:id`** (new route) — instance workspace:
  - Header: instance name, status dropdown, parent template link
  - Left: section list (synced from template, editable per instance)
  - Right: comments panel per selected section
  - Bottom: **Collaborating Accounts** — searchable picker pulling from `debtors` table, add/remove with role selector

### Files to create

- migration with 5 tables + RLS + storage bucket + policies
- `supabase/functions/clm-sectionalize-template/index.ts`
- `src/pages/ClmTemplateDetail.tsx`
- `src/pages/ClmInstanceDetail.tsx`
- `src/components/clm/TemplateUploadDialog.tsx`
- `src/components/clm/TemplateSectionAccordion.tsx`
- `src/components/clm/InstanceAccountPicker.tsx`
- `src/components/clm/SectionCommentsPanel.tsx`
- `src/hooks/useClmTemplates.ts`
- `src/hooks/useClmInstance.ts`

### Files to edit

- `src/pages/Contracts.tsx` — wrap content in Tabs (Contracts / Templates)
- `src/App.tsx` — add `/contracts/templates/:id` and `/contracts/instances/:id` routes (gated by `RequireClmAccess`)

### Out of scope (v1.x follow-ups)
- DocuSign send (still planned per earlier scope, layered on top of instances)
- Diff view between template and instance edits
- Real-time presence on the section editor
- Clause library / clause-level AI suggestions

