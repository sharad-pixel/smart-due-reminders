## Goal

When a contract is ingested via OCR: (1) AI suggests customer matches with confidence scores, (2) if no match, user can pick or create a new customer prefilled from OCR (company + address, contacts, payment terms/currency), (3) line items are prompted per‑row against product catalog, (4) invoices are generated and optionally pushed to Stripe. Also restructure the contract detail page into clean tabs.

## 1. AI customer matching (fuzzy w/ confidence)

**Backend:** `contract_customer_matches` already exists and `live-contract-extract` scores matches. Enhance the scorer in `supabase/functions/live-contract-extract/index.ts` to also compare **email domain**, **billing address city/postal**, and **phone**, not just name — and store a `confidence_band` (high ≥ 85, medium 60‑84, low <60) in `match_reasons`.

**Extract payload:** widen the AI extraction prompt to capture customer `billing_address {line1, line2, city, region, postal_code, country}`, `contacts [{name,email,phone,role}]`, and `payment_terms`, `currency` at the customer level. Persist to a new JSON column `extracted_customer_jsonb` on `live_contract_imports` (migration).

**UI — new component** `src/components/contracts/CustomerMatchReviewCard.tsx`:
- Shows top 3 candidates with % confidence, match reasons chips (name/email/domain/address), and a "Link" button per candidate.
- Buttons: "Override — pick another", "Create new customer from contract".
- Auto-hides once `debtor_id` is set on the import.

**Create-new flow:** replace the minimal form inside `AssignContractDebtor.tsx` create dialog with a richer version prefilled from `extracted_customer_jsonb` — company name, billing address, primary + billing contacts, payment terms, currency. Insert `debtors` + `debtor_contacts` rows and link.

## 2. Product auto-match per line item

**Backend function (new):** `supabase/functions/contract-product-match/index.ts`
- Input: `import_id`.
- For each `contract_revenue_items` row: fuzzy match by `description`/`product_name` + unit price against `product_catalog` (active only). Return per-line: `{ item_id, best_match:{product_id, confidence}, alternates:[…] }`. No auto-write — user confirms.

**UI — new component** `src/components/contracts/ContractProductMatchPanel.tsx`:
- Lists each revenue item with a suggested catalog match (confidence badge), a `ProductCatalogPicker` for override, and a "Create new product" button that opens the existing catalog create form prefilled from the line.
- Save writes `product_id` (+ related fields: `product_description`, `pricing_model`, `billing_period`, `tax_behavior`, `tax_category`, `lookup_key`, `stripe_price_id`) onto `contract_revenue_items` and mirrors down to `contract_invoice_schedules` rows tied to that item.

Renders inside the Invoicing tab, above the existing invoice schedule.

## 3. Invoice generation with Stripe sync

Reuse existing `GenerateInvoicesDialog` + `push-invoice-to-stripe`. Enhancements:
- Precondition banner: "Customer linked ✓ | 5/6 products matched" — block generation when unresolved lines exist (allow "generate anyway" with warning).
- Toggle in the dialog: **"Sync to Stripe on generation"** (default ON when Stripe connected). Wires to existing edge function per generated invoice.
- Success toast links to Stripe invoice URL when present.

## 4. Contract detail page — tabbed layout

Refactor `src/pages/LiveContractDetail.tsx`. Keep the top: back link, `ClmBrandedHeader`, `ContractDetailSubHeader`, `ContractStatusStepper`, `ContractAgreementFamily`. Below that, replace the long scroll with a `Tabs` component:

```text
Overview  |  Parties  |  Commercial Terms  |  Revenue (ASC 606)  |  Risk  |  Invoicing  |  Documents
```

Mapping (no logic changes — just move existing panels into tabs):
- **Overview:** Financial Summary, ContractTermGauge, ContractValueByYearCard, KeyDatesNotificationsPanel.
- **Parties:** CustomerMatchReviewCard, AssignContractDebtor, Contacts (from POC/extracted), ContractPOC details.
- **Commercial Terms:** EditableFinancialTermsCard, ContractExtractedFieldsEditor (financial fields), ContractBillingRequirements, ContractPerformanceObligations.
- **Revenue (ASC 606):** ContractRevRecASC606, ContractRevenueItemsPanel, Asc606ChatPanel/AssessmentPanel, ContractScheduleLines.
- **Risk:** ContractRiskFlagsEditor, ContractComplianceChecklist, InvoiceDataAuditPanel, ContractCustomTriggersPanel.
- **Invoicing:** ContractProductMatchPanel (new), ContractStagingPanel, ContractInvoiceBacklog, ContractInvoiceRecapture, ContractStripeBillingSync.
- **Documents:** ContractDocumentViewer, ContractSupportingDocsPanel, ContractLinksPanel, ComplianceDocsManager.

Persist active tab in URL (`?tab=parties`) so deep links from notifications land in context. Retain `ContractPageNav` as fallback anchors inside each tab where useful.

## Files

**New**
- `supabase/functions/contract-product-match/index.ts`
- `src/components/contracts/CustomerMatchReviewCard.tsx`
- `src/components/contracts/ContractProductMatchPanel.tsx`
- `src/components/contracts/CreateCustomerFromOcrDialog.tsx` (rich prefilled form)

**Migrations**
- Add `extracted_customer_jsonb jsonb` on `live_contract_imports`.
- Add `stripe_price_id`, `pricing_model`, `billing_period`, `tax_behavior`, `tax_category`, `lookup_key`, `product_description` on `contract_revenue_items` if not present (mirror catalog).
- No new tables; reuse `contract_customer_matches` and `product_catalog`.

**Edits**
- `supabase/functions/live-contract-extract/index.ts` — widen extraction schema, richer scoring, confidence band.
- `src/components/contracts/AssignContractDebtor.tsx` — swap in new rich create dialog.
- `src/components/clm/GenerateInvoicesDialog.tsx` — Stripe sync toggle + gate.
- `src/pages/LiveContractDetail.tsx` — tab shell.

## Non-goals
- No auto-push of catalog products to Stripe (deferred — user paused this earlier).
- No changes to non-OCR / manual contract flow beyond the tab UI.
