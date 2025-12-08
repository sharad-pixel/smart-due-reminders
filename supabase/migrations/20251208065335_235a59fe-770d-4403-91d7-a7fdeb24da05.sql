-- Drop the old restrictive INSERT policy that conflicts with team member access
DROP POLICY IF EXISTS "Users can create own invoices" ON public.invoices;