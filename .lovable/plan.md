
# Contract OCR at the Account Level — Staging, Reconciliation & Actionable Invoice Tasks

## Goal

Make Contract OCR a first-class, account-centric workflow that:
1. Lets users upload to an existing Account or create a new one inline
2. Lands the contract in a **Staging area** for review before publishing
3. **Reconciles the contract's billing schedule against invoices already in Recouply.ai** and flags gaps
4. Auto-derives Revenue Intelligence (MRR / ARR / ACV / TCV / cadence)
5. Creates closeable tasks for renewal / opt-out / invoicing — **including reconciliation tasks** for missing or unclear invoices
6. Stays separate from CLM Workspaces

## Reuses (no rebuild)

- OCR pipeline: `live-contract-upload` → `live-contract-extract` → `live_contract_imports`, `contract_critical_dates`, `contract_invoice_schedules`
- Existing `live_contract_imports.staging_status` + `staged_fields` (already in `.lovable/plan.md`)
- `live-contract-actions.generateInvoices`, `extract-invoice-pdf` (already meters $0.75/page)
- `useCollectionTasks` + `/tasks` Kanban
- `live_contract_imports.debtor_id` link

## What's new

### 1. Staging Area (default landing after upload)

After `live-contract-extract` completes, the contract opens in a **Staging tab** at `/contracts/live/:importId` (status `extracted` → `staging`). The user must review before "Publish":

- Inline edit of every extracted field (term start/end, MRR/ARR/ACV/TCV, cadence, line items, opt-out, renewal terms)
- Confidence chips per field; low-confidence fields highlighted amber
- **Reconciliation panel** (see §3) shown alongside
- Bottom bar: **Discard** / **Save staging draft** / **Publish to account**
- Only after Publish does the contract feed Revenue Intelligence, generate alerts, and create non-staging tasks
- Status flow: `extracted → staging → published` (existing column reused)

### 2. Account-level Contracts tab on the Debtor page

- New "Contracts" tab in `DebtorDetail.tsx` with an **Upload Contract** CTA (debtor pre-filled)
- Lists `live_contract_imports` for the debtor with mini term gauge, MRR/ARR/ACV/TCV chips, next critical date badge, and a **Staging** badge when not yet published
- Segmented control: **OCR Contracts** (default) | **CLM Workspaces** (only if CLM enabled)

### 3. Invoice Reconciliation against Recouply.ai

A new **`ContractReconciliationPanel`** runs server-side as part of `live-contract-extract` (and re-runnable from the Staging tab):

For each row in `contract_invoice_schedules`, match against existing `invoices` for the same `debtor_id` using:
1. Exact match on amount + due-date window (±7 days)
2. Soft match on amount only within the term window
3. Period/description fuzzy match (Gemini-2.5-Flash) when amount/date drift

Each schedule row gets a `reconciliation_status`:
- `matched` — high-confidence invoice found, `invoice_id` linked
- `partial` — possible match found, needs human confirmation (shows side-by-side comparison)
- `missing` — no invoice exists for this scheduled period
- `unclear` — multiple candidates or ambiguous (e.g. amount matches but period off)
- `extra` — invoices exist for this contract's debtor with no matching schedule row (surfaced separately)

The panel displays a concise summary: *"6 of 9 scheduled invoices reconciled • 2 missing • 1 unclear"*.

### 4. Tasks created from reconciliation + key dates

When the contract is **published**, `live-contract-extract` upserts (idempotent on `(import_id, source_ref)`) into `collection_tasks`:

- One per `missing` schedule row → **"Create invoice for {{period}} — ${{amount}}"** (priority high if past due)
- One per `unclear` schedule row → **"Confirm invoice match for {{period}}"** (links to side-by-side reconciliation view)
- One per `extra` invoice → **"Review invoice {{number}} — not on contract schedule"**
- One per key date (term start, opt-out notice, opt-out date, renewal at 60/30/7d, term end)

Tasks carry `task_source='contract'`, `source_ref={import_id, schedule_id?, key_date_type?}`, `debtor_id`, deep-link to `/contracts/live/:importId#schedule-{rowId}`.

### 5. Per-row actions on the schedule (post-publish)

`ContractInvoiceScheduleTable` actions per row:
- **Mark complete** — flips `completion_status='completed'` and closes the matching task
- **Link existing invoice** — searchable picker (pre-seeded with reconciliation candidates)
- **Generate in Recouply** — calls `live-contract-actions.generateInvoices`
- **Upload & OCR** — drag-drop PDF → `extract-invoice-pdf` (meters $0.75/page) → invoice draft attached to schedule row

Bulk: **Mark selected complete**, **Generate selected**, **Bulk upload & OCR**.

Two-way sync: completing a task on `/tasks` flips the schedule row, and any of the row actions auto-completes the matching task with a note (e.g. "Invoice INV-1042 linked").

### 6. Upload modal that can create an Account inline

`AccountContractUploadDialog`, opened from debtor page, `/debtors`, `/contracts/live`, dashboard CLM card:
1. Drop PDF/DOCX (validation + OCR pricing notice)
2. Pick existing debtor **or** create new account inline (company, primary email, currency)
3. Create debtor if needed → `live-contract-upload` with `debtor_id` → `live-contract-extract` → land on **Staging** tab

### 7. Revenue Intelligence panel (post-publish)

`ContractRevenueIntelligencePanel` shows MRR, ARR, ACV (current term), TCV (full incl. renewals), cadence, next invoice date, recognized vs remaining revenue. Computed client-side from staged/published fields. "Recompute with AI" re-invokes `live-contract-extract`.

## Files

**New**
- `src/components/contracts/AccountContractUploadDialog.tsx`
- `src/components/contracts/ContractStagingTab.tsx` — editable fields + Publish bar
- `src/components/contracts/ContractReconciliationPanel.tsx` — match summary + per-row drill-down
- `src/components/contracts/ContractInvoiceScheduleTable.tsx`
- `src/components/contracts/ScheduleInvoiceLinkPicker.tsx`
- `src/components/contracts/ScheduleOcrUploader.tsx`
- `src/components/contracts/ContractRevenueIntelligencePanel.tsx`
- `src/components/contracts/AccountContractsTab.tsx`
- `src/lib/contracts/revenueMetrics.ts`
- `src/lib/contracts/scheduleTasks.ts` — bidirectional schedule ↔ task sync
- `supabase/functions/contract-reconcile/index.ts` — runs the matcher, can be re-invoked from UI

**Edited**
- `src/pages/DebtorDetail.tsx` — Contracts tab
- `src/pages/LiveContractDetail.tsx` — Staging tab default, Reconciliation + Revenue Intelligence + Schedule Table after publish
- `src/pages/LiveContracts.tsx` — header CTA opens `AccountContractUploadDialog`; staging badge in row list
- `src/pages/Debtors.tsx` — Upload Contract quick action
- `src/pages/CollectionTasks.tsx` — task completion calls schedule sync helper
- `supabase/functions/live-contract-extract/index.ts` — calls `contract-reconcile` after extract; only writes published-side tasks when `staging_status='published'`
- `supabase/functions/live-contract-actions/index.ts` — invoice generate also flips schedule + completes linked task

## Database migrations

```text
live_contract_imports add (if not present from prior plan):
  staging_status text default 'draft'  -- draft | staging | published
  staged_fields jsonb
  staging_completed_at timestamptz
  published_at timestamptz

contract_invoice_schedules add:
  completion_status text default 'pending'    -- pending | completed | skipped
  completed_at timestamptz
  completed_by uuid
  completion_note text
  invoice_id uuid references invoices(id) on delete set null
  attachment_source text                       -- generated | linked | ocr | manual
  reconciliation_status text default 'pending' -- pending | matched | partial | missing | unclear
  reconciliation_candidates jsonb              -- [{invoice_id, score, reason}]
  reconciled_at timestamptz

collection_tasks add:
  task_source text default 'manual'   -- manual | contract | email | system
  source_ref jsonb                    -- { import_id, schedule_id?, key_date_type?, kind: 'missing'|'unclear'|'extra'|'date' }
  unique index on (source_ref->>'import_id', source_ref->>'schedule_id', source_ref->>'key_date_type', source_ref->>'kind')
    where task_source = 'contract'
```

RLS inherits existing account-scoped policies on all touched tables.

## Out of scope (this pass)

- Email notifications (in-app alerts only)
- Bulk multi-account upload
- Editing CLM workspace flow

Reply "go" to build, or tell me what to adjust.
