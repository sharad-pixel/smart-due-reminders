-- Remove duplicate debtors, keeping the oldest row per (user_id, quickbooks_customer_id)
DELETE FROM public.debtors
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, quickbooks_customer_id
             ORDER BY created_at ASC, id ASC
           ) AS rn
    FROM public.debtors
    WHERE quickbooks_customer_id IS NOT NULL
  ) sub
  WHERE rn > 1
);

-- Remove duplicate invoices, keeping the oldest row per (user_id, quickbooks_invoice_id)
DELETE FROM public.invoices
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, quickbooks_invoice_id
             ORDER BY created_at ASC, id ASC
           ) AS rn
    FROM public.invoices
    WHERE quickbooks_invoice_id IS NOT NULL
  ) sub
  WHERE rn > 1
);

-- Add unique constraint on debtors(user_id, quickbooks_customer_id)
ALTER TABLE public.debtors
ADD CONSTRAINT debtors_user_qb_customer_unique UNIQUE (user_id, quickbooks_customer_id);

-- Add unique constraint on invoices(user_id, quickbooks_invoice_id)
ALTER TABLE public.invoices
ADD CONSTRAINT invoices_user_qb_invoice_unique UNIQUE (user_id, quickbooks_invoice_id);