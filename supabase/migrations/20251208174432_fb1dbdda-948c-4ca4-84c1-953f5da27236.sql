-- Drop the check constraint that requires organization_id or debtor_id
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS organization_or_debtor_required;