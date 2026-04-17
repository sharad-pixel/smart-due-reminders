ALTER TABLE public.debtors
  ADD COLUMN IF NOT EXISTS sales_rep_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sales_rep_name text,
  ADD COLUMN IF NOT EXISTS sales_rep_email text,
  ADD COLUMN IF NOT EXISTS sales_rep_alerts_enabled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_debtors_sales_rep_user_id ON public.debtors(sales_rep_user_id);
CREATE INDEX IF NOT EXISTS idx_debtors_sales_rep_email ON public.debtors(lower(sales_rep_email)) WHERE sales_rep_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_debtors_sales_rep_alerts_enabled ON public.debtors(sales_rep_alerts_enabled) WHERE sales_rep_alerts_enabled = true;