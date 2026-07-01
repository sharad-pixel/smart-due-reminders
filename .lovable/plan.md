
# Contract Intelligence Engine v2 — Phased Plan

This is a large scope (8 processing stages + workspace + score). I'll deliver it in 5 phases so each ships something usable rather than a 3-week silent build. Every phase extends what's already in the codebase (`live_contract_*` tables, `ContractIntelligenceDashboard`, `LiveContractDetail`, `live-contract-extract` edge function).

## What already exists (baseline)
- Upload + OCR + AI extraction (`live-contract-extract`) → `live_contract_extractions`, `live_contract_extracted_fields`
- Schedule + risk flags + critical dates (`contract_invoice_schedules`, `contract_risk_flags`, `contract_critical_dates`)
- Editable fields UI, re-scan, ASC 606 assessment, invoice backlog, reconciliation panel
- Dashboard summary card + Active Contracts page + Contract Intelligence dashboard page

The plan below layers the missing 8 stages on top of this, without duplicating what works.

---

## Phase 1 — Document Classification + Agreement Hierarchy (Stage 1)
Turn every upload into a typed document that knows its parent.

- Add `document_type` (MSA, Order Form, Amendment, Renewal, Expansion, Reduction, SOW, Pricing Exhibit, PO, Invoice, Credit Memo, Usage Report, Change Order, PSA, BAA, DPA) and `parent_import_id` to `live_contract_imports`.
- New classification pass in `live-contract-extract` (first AI call, cheap Flash model) → returns type + confidence + candidate parent (matched by customer + agreement number).
- UI: document-type badge on contract rows; "Parent MSA" picker on detail page; agreement-family tree view on the customer workspace.

## Phase 2 — Validation + Completeness Score (Stages 3 + 6)
Every extracted field gets a Pass / Warning / Failed status and rolls up into a score.

- New table `contract_field_validations` (field_key, status, message, confidence, category).
- Validation runner (edge function `contract-validate`) triggered post-extract: rule-based checks (dates present, MSA link, pricing present, PO present, currency, billing frequency, invoice schedule, renewal terms) + AI confidence for soft fields.
- New table `contract_completeness_scores` with 13 category scores + overall.
- UI: replace the current "extracted fields" tab with a **Commercial Completeness** panel — 13 categories, each Complete / Needs Review / Missing / Conflict, click-through to fix the underlying field. Prominent overall Contract Intelligence Score on the detail header and customer workspace.

## Phase 3 — Treatment Engine + AI Action Center (Stages 4 + 8)
Every extracted term produces business actions (tasks, forecasts, notifications).

- New table `contract_treatments` (field_key → treatment_kind → generated_artifact_ref).
- Treatment router (edge function `contract-treatments`) maps: Renewal Date→notice tasks + timeline entry; Billing Frequency→invoice schedule + collection workflow; Payment Terms→DSO forecast; Products→ARR/ACV/TCV/MRR + revenue schedule; Prof Services→delivery schedule + billing milestones; Usage→consumption tracking + overage prediction; Discount→leakage flag + approval check; Notice Period→non-renewal date + CS/AE/Finance tasks; Termination Rights→risk flag; PO→invoice-gate.
- All generated tasks land in existing `collection_tasks` (Task Center) with contract_id + treatment_kind.
- UI: "AI Actions" tab on the contract and workspace listing every auto-generated task with owner, due date, and one-click Resolve/Snooze/Reassign.

## Phase 4 — Invoice Intelligence (Stage 5)
Contract obligations ↔ actual invoices, with lifecycle status.

- Extend `contract_invoice_schedules` with `obligation_state` (scheduled / generated / uploaded / paid / outstanding / missing / draft) and `matched_invoice_id`.
- New matcher edge function `contract-invoice-match`: compares scheduled obligations against `invoices` by customer+amount+date+PO; flags amount mismatches, missing recurring, duplicate invoices, tax miscalc, wrong Order Form link.
- Actions: Generate Invoice (existing), Upload Invoice, Auto-Match, Manual Match, Override.
- UI: **Invoice Intelligence** tab per contract and per customer — obligations vs actuals table, mismatch alerts, one-click resolve.

## Phase 5 — AI Risk + Customer Intelligence Workspace + Score Trend (Stages 7 + Workspace + Score)
Consolidate everything under a per-customer workspace.

- Expand `contract_risk_flags` with `severity`, `commercial_impact`, `financial_impact_cents`, `revenue_exposure_cents`, `recommended_action`, `owner_user_id`, `due_date`, `confidence`.
- New risk detector `contract-risk-scan` running the 17 checks (missing renewal notice, expired agreement, overlapping order forms, missing MSA, duplicate products, missing invoice, invoice mismatch, revenue leakage, wrong billing freq, PS remaining, missing PO, conflicting amendment, missing pricing, missing currency, unsupported payment terms, rev-rec risk, collection risk).
- New page `/customers/:debtorId/intelligence` — 15 sections (Overview, Commercial Timeline, Contract Intelligence, Revenue Intelligence, Invoice Intelligence, Collection Intelligence, Renewals, Commercial Risks, AI Tasks, Historical Documents, Amendments, Invoices, Executive Dashboard, Audit History) hydrated from existing data.
- Score history table `contract_score_history` (daily snapshot) → trend sparkline on the score card.

---

## Technical Notes

**Extraction pipeline** stays the current shape (OCR → AI extraction) but grows two new pre/post stages:
```text
Upload → OCR → [Classify] → Extract → [Validate] → [Treatments] → [Invoice Match] → [Risk Scan] → Score
```

**Model choice:** classification + validation on `google/gemini-2.5-flash` (cheap, high volume); commercial extraction stays on `google/gemini-2.5-pro` (already the case from the last change); risk narrative + recommendations on `google/gemini-2.5-flash`.

**New tables (all under existing RLS pattern — account-scoped, GRANTs in same migration):**
`contract_field_validations`, `contract_completeness_scores`, `contract_treatments`, `contract_score_history`, plus columns added to `live_contract_imports`, `contract_invoice_schedules`, `contract_risk_flags`.

**No breaking changes:** existing `LiveContractDetail`, `ContractIntelligenceDashboard`, and `ContractExtractedFieldsEditor` keep working; new tabs/panels appear alongside.

---

## Two questions before I start

1. **Order** — build Phases 1→5 in order (default), or do you want a specific phase first (e.g. jump to Phase 4 Invoice Intelligence because that's the most visible commercial value)?
2. **Scope of the Customer Intelligence Workspace (Phase 5)** — new dedicated page at `/customers/:debtorId/intelligence`, or fold the 15 sections into the existing debtor detail page as tabs?

Say "go" to accept defaults (Phase 1 first, new workspace page) and I'll start with Phase 1.
