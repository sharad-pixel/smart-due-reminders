
ALTER TABLE public.live_contract_imports
  ADD COLUMN IF NOT EXISTS product_description text,
  ADD COLUMN IF NOT EXISTS contract_value numeric(18,2);

ALTER TABLE public.contract_invoice_schedules
  ADD COLUMN IF NOT EXISTS quantity numeric(18,4),
  ADD COLUMN IF NOT EXISTS unit_price numeric(18,2),
  ADD COLUMN IF NOT EXISTS product_description text;
