## Goal

Let users building invoices in Recouply quickly add line items as simple "products" (Description, Unit Type, Unit Cost, Quantity) and save any line item to a reusable Product Catalog they can pull from on future invoices.

Existing `revenue_library_items` is ASC-606 oriented and too heavy for this use case. We'll add a lightweight `product_catalog` table dedicated to invoice line items.

## What the user sees

In `CreateInvoiceModal` → Line Items section:

1. **"Add from catalog"** button next to **"Add Line"**. Opens a searchable popover listing saved products. Selecting one inserts a pre-filled line (description, unit type, unit cost, quantity defaults to 1).
2. Each line row gains a **Unit Type** field (e.g. "each", "hour", "license", "month" — free text with common suggestions) between Description and Qty.
3. Each line row gets a small **bookmark icon button** ("Save to catalog"). If the line isn't yet saved, clicking it saves Description + Unit Type + Unit Cost to the catalog and turns the icon filled/green. Disabled until Description and Unit Cost are filled. Shows a toast on success and dedupes by `(user_id, lower(description), unit_type)`.
4. Empty-state hint in the catalog popover: "No saved products yet — save any line item to reuse it later."

Result: zero context-switch. Build once, reuse forever, all from the same modal.

## Technical details

### New table `public.product_catalog`

```text
id              uuid pk
user_id         uuid not null              -- owner (auth.uid)
account_id      uuid                        -- effective account scoping
description     text not null
unit_type       text not null default 'each'
unit_cost       numeric(14,2) not null      -- decimal per financial-precision rule
currency        text not null default 'USD'
times_used      integer not null default 0
last_used_at    timestamptz
created_at      timestamptz default now()
updated_at      timestamptz default now()

unique (user_id, lower(description), unit_type)   -- via expression unique index
```

- GRANT SELECT/INSERT/UPDATE/DELETE to `authenticated`; ALL to `service_role`.
- RLS: owner-only (`user_id = auth.uid()`) for select/insert/update/delete.
- `updated_at` trigger.

### Frontend

- `src/hooks/useProductCatalog.tsx` — `list`, `saveProduct({description, unit_type, unit_cost, currency})` (upsert on unique key, increments `times_used` on reuse), `remove`.
- `src/components/invoices/ProductCatalogPicker.tsx` — Popover + Command search; calls `onSelect(item)`.
- `src/components/invoices/LineItemsTable.tsx`:
  - Extend `LineItem` with `unit_type: string` (default `"each"`).
  - Add Unit Type `<Input list="unit-type-suggestions">` column with a `<datalist>` of common units (each, hour, day, month, license, user, project, unit).
  - Add bookmark icon button per row → calls `saveProduct`; tracks saved state in local component state by row index.
  - Add "Add from catalog" button in the toolbar that opens `ProductCatalogPicker`; selection appends a new line.
- `CreateInvoiceModal` continues to pass `lineItems` through unchanged; `unit_type` is stored on the new `invoice_line_items.unit_type` column (added below) and falls back to existing behavior if missing.

### Schema touch-up

Add `unit_type text` (nullable) to `invoice_line_items` so saved line context round-trips. Backfill not required.

### Out of scope

- Editing the catalog from a dedicated page (future enhancement). Users can still manage entries via the picker's delete action.
- Tax line items remain unchanged (only "item" rows show the save-to-catalog button).
- No changes to AI invoice creation flow (`ai-create-records`); can adopt later.

## Files to create / change

- migration: create `product_catalog` + grants + RLS + add `invoice_line_items.unit_type`
- create `src/hooks/useProductCatalog.tsx`
- create `src/components/invoices/ProductCatalogPicker.tsx`
- edit `src/components/invoices/LineItemsTable.tsx`
- edit `src/components/invoices/CreateInvoiceModal.tsx` (persist `unit_type` on insert)
