# Add Contract Manually — surface entry points + document attachments

## Problem

1. `ManualContractDialog` only opens from `/ai-ingestion` (LiveContracts) via the "Enter manually" button. It is **not** available on:
   - `/contracts` (Contracts.tsx — Contract Intelligence / CLM page) — the page users naturally think of as "the Contracts page".
   - Debtor account page (`DebtorDetail.tsx`) — only the AI Smart Ingestion (upload) button is shown.
2. The manual contract dialog has no file attachment UI, so users can't upload supporting documents (signed PDF, addenda, order forms, etc.) alongside the manually entered data.

## Changes

### 1. Add "Add Contract Manually" entry points

**`src/pages/Contracts.tsx`** — In the Contract Intelligence header (around the existing `<Link to="/contracts/live">` button), add a second action: **"Add Contract Manually"** button (`FileSignature` icon, outline variant) that opens `ManualContractDialog`. Wire up local `manualOpen` state.

**`src/pages/DebtorDetail.tsx`** — Next to the existing `<ContractUploadButton ... />` (line 852), add a second outline button **"Add Manually"** that opens `ManualContractDialog` pre-scoped to this debtor (pass `debtorId` and `debtorName`). Wire up local `manualOpen` state.

**`src/components/contracts/ContractUploadDialog.tsx`** — Already exposes a manual-entry link in its footer; leave as is (it's the fallback inside the AI upload flow).

### 2. Allow document attachments on manually entered contracts

**`src/components/contracts/ManualContractDialog.tsx`** — Add an optional **"Supporting Documents"** section at the bottom of the form (above the action buttons):

- Drag-and-drop / click-to-browse zone (reuse the styling pattern from `ContractUploadDialog`: dashed border, primary hover, `Upload` icon).
- Accept `.pdf, .docx, .txt, .png, .jpg` up to 25MB each, multiple files.
- Render selected files via the existing `ContractFileRow` component with remove support.
- On submit, after the manual import row is created and `extracted_fields` are written, upload each attached file to the existing contract documents storage path used by `live-contract-upload` (re-use the same edge function with an `attach_to_import_id` parameter, OR upload directly to the `live-contract-imports` storage bucket under `{import_id}/attachments/{filename}` and insert a row into the contract documents table the project already uses — to be confirmed during implementation by reading the live-contract-upload function and the contracts storage schema).
- Show a small progress indicator while attachments upload; do not block the success toast if a single attachment fails — surface a non-blocking error toast per failed file.
- Update the dialog copy: "Optional — attach the signed contract, order form, or any supporting document. AI will not re-extract from these (your manual fields are the source of truth), but they'll be available on the contract detail page for reference."

### 3. Discovery / labeling

- On `/contracts` and `DebtorDetail`, place "Add Contract Manually" **alongside** (not hidden behind) the AI Smart Ingestion button so both paths are visible at first glance.
- Keep the "Enter manually" wording inside `LiveContracts` and `ContractUploadDialog` as is for consistency.

## Out of scope

- No new tables, no schema changes for standard or custom fields (already supported by existing `ManualContractDialog`).
- No changes to the AI extraction pipeline.
- No marketing-site changes.

## Technical notes

- Before wiring the attachment upload, read `supabase/functions/live-contract-upload/index.ts` and the contracts document storage code (`ContractSupportingDocsPanel.tsx`) to reuse the existing bucket + table conventions rather than introducing a new path.
- All new UI uses semantic tokens (no hard-coded colors).
- No business logic in the AI extractor changes; manual entries continue to mark `ai_response: { source: "manual_entry", ... }`.
