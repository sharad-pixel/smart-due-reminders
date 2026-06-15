-- 1. Rescope clm_notification_queue policy to service_role
DROP POLICY IF EXISTS "Service role manages clm notification queue" ON public.clm_notification_queue;
CREATE POLICY "Service role manages clm notification queue"
ON public.clm_notification_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2. Add missing SELECT policy on email_sending_profiles
DROP POLICY IF EXISTS "Users can view own email profiles" ON public.email_sending_profiles;
CREATE POLICY "Users can view own email profiles"
ON public.email_sending_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);