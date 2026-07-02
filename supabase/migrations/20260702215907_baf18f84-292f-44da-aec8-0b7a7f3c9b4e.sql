
ALTER TABLE public.product_catalog
  ADD COLUMN IF NOT EXISTS product_description text,
  ADD COLUMN IF NOT EXISTS status_effective_date timestamptz;

-- Enforce 50-char limit on product_description
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_catalog_product_description_len_chk'
  ) THEN
    ALTER TABLE public.product_catalog
      ADD CONSTRAINT product_catalog_product_description_len_chk
      CHECK (product_description IS NULL OR char_length(product_description) <= 50);
  END IF;
END $$;
