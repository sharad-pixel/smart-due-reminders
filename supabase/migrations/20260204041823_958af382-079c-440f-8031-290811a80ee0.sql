-- Add public access policies for payment plan viewing via public_token
-- This allows debtors to view their payment plans without logging in

-- Policy: Anyone can view payment plans by public_token (for debtor portal)
CREATE POLICY "Public can view payment plans by token" 
ON public.payment_plans 
FOR SELECT 
USING (public_token IS NOT NULL);

-- Policy: Anyone can view installments for publicly accessible payment plans
CREATE POLICY "Public can view installments for public payment plans" 
ON public.payment_plan_installments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.payment_plans pp 
    WHERE pp.id = payment_plan_installments.payment_plan_id 
    AND pp.public_token IS NOT NULL
  )
);

-- Policy: Anyone can view debtor info for publicly accessible payment plans
CREATE POLICY "Public can view debtors for public payment plans" 
ON public.debtors 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.payment_plans pp 
    WHERE pp.debtor_id = debtors.id 
    AND pp.public_token IS NOT NULL
  )
);

-- Policy: Anyone can view branding for publicly accessible payment plans
CREATE POLICY "Public can view branding for public payment plans" 
ON public.branding_settings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.payment_plans pp
    JOIN public.debtors d ON d.id = pp.debtor_id
    WHERE d.user_id = branding_settings.user_id 
    AND pp.public_token IS NOT NULL
  )
);