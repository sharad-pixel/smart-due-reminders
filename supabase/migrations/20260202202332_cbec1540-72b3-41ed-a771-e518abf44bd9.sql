-- Fix quickbooks_payments.amount_applied column type to support decimal amounts
-- QuickBooks returns amounts like 629.1, 78.6, etc. which fail with integer type

ALTER TABLE public.quickbooks_payments 
ALTER COLUMN amount_applied TYPE numeric USING amount_applied::numeric;