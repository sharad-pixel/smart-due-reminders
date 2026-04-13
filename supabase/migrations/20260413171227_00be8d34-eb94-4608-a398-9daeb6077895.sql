ALTER TABLE public.invoice_line_items ADD COLUMN IF NOT EXISTS line_type text NOT NULL DEFAULT 'item';

-- Add a check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_line_items_line_type_check'
  ) THEN
    ALTER TABLE public.invoice_line_items ADD CONSTRAINT invoice_line_items_line_type_check CHECK (line_type IN ('item', 'tax'));
  END IF;
END $$;