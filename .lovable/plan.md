# Live Contract Ingestion — Implementation Plan

Additive feature inside the CLM module. Reuses existing Google Drive OAuth/connection infrastructure (`drive_connections`, `google-drive-scan` edge function pattern). Does NOT touch Collections, Risk, Stripe, QuickBooks, existing CLM workspaces, templates, or RLS on existing tables.

## Scope

A new "Live Contracts" section under CLM that lets users:
1. Connect/select a Drive folder (reuse existing OAuth + Picker)
2. Scan & queue contract files (PDF/DOCX/Google Doc), upload manually
3. Run OCR + AI extraction (Gemini 2.5 Flash)
4. Review extracted fields in a review queue before commit
5. Match/create customer (debtor), generate critical dates, invoice schedules, risk flags, renewal reminders
6. View dashboard widgets

## Database (additive migration only)

New tables, all with `account_id`, RLS scoped via `has_account_access(account_id)`:

- `live_contract_drive_folders` — folder_id, folder_name, connection_id, last_scanned_at, is_active
- `live_contract_scan_jobs` — folder_id, status, files_found, files_new, started_at, completed_at, error
- `live_contract_imports` — source ('drive'|'upload'), file_id, file_name, mime_type, file_size, storage_path, status (found/queued/scanning/ocr/extracting/needs_review/approved/imported/duplicate/failed), confidence, debtor_id (nullable until matched), error
- `live_contract_extractions` — import_id, raw_text, ai_response (jsonb), model, tokens, extracted_at
- `live_contract_extracted_fields` — extraction_id, field_key, field_value, confidence, source_snippet, page_ref, edited_by_user, approved
- `live_contract_review_queue` — import_id, status, assigned_to, reviewed_by, reviewed_at, notes
- `contract_customer_matches` — import_id, candidate_debtor_id, match_score, match_reasons (jsonb), is_selected
- `contract_critical_dates` — import_id, debtor_id, date_type (renewal/opt_out/non_renewal/term_end/poc_end/etc), due_date, notice_days, status
- `contract_invoice_schedules` — import_id, debtor_id, scheduled_date, service_period_start, service_period_end, amount, currency, billing_type, payment_terms, expected_due_date, description
- `contract_risk_flags` — import_id, debtor_id, flag_type, severity, description, source_field
- `contract_poc_details` — import_id, debtor_id, poc_start, poc_end, conversion_terms, pilot_fee, success_criteria
- `contract_source_documents` — import_id, storage_path, signed_url_expires_at, page_count
- `live_contract_audit_log` — import_id, account_id, user_id, event_type, event_details (jsonb)

Storage bucket: `live-contracts` (private), RLS-scoped by account folder prefix.

## Edge Functions

1. `live-contract-scan` — list PDFs/DOCX/Google Docs in selected folder, dedupe, insert `live_contract_imports` rows as `found`. Reuses `drive_connections` token refresh pattern from `google-drive-scan`.
2. `live-contract-extract` — fetches file content (Drive download or storage), OCR if needed (PDF→text via pdf parsing, scanned via Lovable AI vision), runs Gemini 2.5 Flash with structured tool-call schema for all metadata fields (customer, commercial, dates, invoice schedule, legal/risk, POC). Writes extraction + fields + risk flags + suggested customer matches + suggested invoice schedules + critical dates. Sets status `needs_review`.
3. `live-contract-approve` — on user approve: confirms/creates debtor (matching by legal name/DBA/email domain/tax ID), commits critical_dates + invoice_schedules + risk_flags as `approved`, marks import `imported`, writes audit entries. Idempotent on re-approve.
4. `live-contract-upload` — signed-upload flow for manual file uploads → creates import row → enqueues extraction.

All functions: service role, validate JWT in code, CORS via `corsHeaders`, no module caching, treat 23505 as success.

## Frontend

New route `/clm/live-contracts` (add to existing CLM nav).

Components (in `src/components/clm/live-contracts/`):
- `LiveContractsPage.tsx` — header, dashboard widgets, tabs (Folders | Scan Queue | Review | Imported | Audit)
- `DriveFolderConnector.tsx` — reuses existing Picker (`openFolderPicker`) + `drive_connections` lookup; lists configured folders, "Scan now" / "Rescan" buttons
- `ScanQueueTable.tsx` — files with status chips, filters, bulk exclude
- `UploadContractDialog.tsx` — manual upload (PDF/DOCX), drops into `live-contracts` bucket
- `ReviewQueueList.tsx` + `ReviewContractDrawer.tsx` — side-by-side: PDF preview (signed URL) + extracted fields editor with confidence pills, source snippets, suggested customer matches, suggested invoice schedules, risk flags, critical dates. Approve / Edit / Reject / Re-scan / Mark Duplicate.
- `CustomerMatchPanel.tsx` — top suggested debtor matches with scores; "Link existing" or "Create new debtor" (writes to `debtors`).
- `InvoiceSchedulePreview.tsx` — table preview of generated schedule before commit
- `RiskFlagsList.tsx`, `CriticalDatesList.tsx`, `PocDetailsCard.tsx`
- `LiveContractsDashboardWidgets.tsx` — 9 widgets (scanned, needs review, imported, upcoming renewal notices, upcoming opt-outs, with invoice schedules, missing ARR/ACV, with risk flags, POCs expiring)
- `AuditTrailPanel.tsx`

Hooks (`src/hooks/`):
- `useLiveContractFolders.ts`
- `useLiveContractImports.ts`
- `useLiveContractReview.ts` (extraction + fields + matches + schedules + risks + dates)
- `useLiveContractDashboard.ts`

## Key Logic

**AI extraction prompt** uses Gemini 2.5 Flash with a single tool-call schema covering all required field groups. Each field returns `{value, confidence, snippet, page}`. Empty/unknown → null. Risk flags emitted as enum array. Invoice schedule emitted as array of `{date, period_start, period_end, amount, type, terms}`.

**Renewal date intelligence** computed in edge function from extracted `term_end_date` + `renewal_term` + `notice_period_days`:
- renewal_date, opt_out_deadline = renewal_date − notice_days, days_until_*
- Risk level: red <30d, amber <90d, else green

**Customer matching** scoring (0-100): legal name fuzzy (40), DBA (20), email domain (20), tax ID exact (20), address (10). Top 3 stored in `contract_customer_matches`.

**Duplicate detection**: hash of (file_id) OR (filename + size) within account, OR same extracted contract_name + debtor + effective_date.

## Out of Scope (explicit)

- No automatic invoice creation in Stripe/QuickBooks (only schedule records)
- No automatic email/outreach generation
- No changes to existing debtor/invoice/Collections logic
- No modifications to existing CLM workspace tables
- E-signature, redlining, template generation untouched

## File Inventory

Migration: 1 file (~14 tables + storage bucket + RLS + audit triggers)
Edge functions: 4 new (`live-contract-scan`, `live-contract-extract`, `live-contract-approve`, `live-contract-upload`)
Frontend: 1 page + ~12 components + 4 hooks + route registration in `App.tsx` + nav entry in CLM section

## Risk Mitigation

- All new tables prefixed `live_contract_*` / `contract_*` — no collisions
- Reuses existing `drive_connections` table read-only; does not modify rows used by `google-drive-scan`
- Storage bucket separate from any existing
- Gated behind same CLM entitlement (`useClmEntitlement`)
