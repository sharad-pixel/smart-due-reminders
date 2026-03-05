
-- Fix 1: Restrict system-level policies from 'authenticated' to 'service_role'
-- These policies are intended for backend/service operations only

-- audit_logs
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs FOR INSERT TO service_role WITH CHECK (true);

-- security_events
DROP POLICY IF EXISTS "System can insert security events" ON public.security_events;
CREATE POLICY "Service role can insert security events"
ON public.security_events FOR INSERT TO service_role WITH CHECK (true);

-- user_sessions: users need to manage their own sessions, service_role for system ops
DROP POLICY IF EXISTS "System can insert sessions" ON public.user_sessions;
CREATE POLICY "Users can insert own sessions"
ON public.user_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role can insert sessions"
ON public.user_sessions FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "System can update sessions" ON public.user_sessions;
CREATE POLICY "Users can update own sessions"
ON public.user_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role can update sessions"
ON public.user_sessions FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- inbound_emails
DROP POLICY IF EXISTS "System can insert inbound emails" ON public.inbound_emails;
CREATE POLICY "Service role can insert inbound emails"
ON public.inbound_emails FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "System can update inbound emails" ON public.inbound_emails;
CREATE POLICY "Service role can update inbound emails"
ON public.inbound_emails FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- daily_digests
DROP POLICY IF EXISTS "System can insert digests" ON public.daily_digests;
CREATE POLICY "Service role can insert digests"
ON public.daily_digests FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "System can update digests" ON public.daily_digests;
CREATE POLICY "Service role can update digests"
ON public.daily_digests FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- document_access_log
DROP POLICY IF EXISTS "System can insert document access logs" ON public.document_access_log;
CREATE POLICY "Service role can insert document access logs"
ON public.document_access_log FOR INSERT TO service_role WITH CHECK (true);

-- image_moderation_logs
DROP POLICY IF EXISTS "System can insert moderation logs" ON public.image_moderation_logs;
CREATE POLICY "Service role can insert moderation logs"
ON public.image_moderation_logs FOR INSERT TO service_role WITH CHECK (true);

-- score_change_logs
DROP POLICY IF EXISTS "System can insert score change logs" ON public.score_change_logs;
CREATE POLICY "Service role can insert score change logs"
ON public.score_change_logs FOR INSERT TO service_role WITH CHECK (true);

-- user_notifications
DROP POLICY IF EXISTS "System can insert notifications" ON public.user_notifications;
CREATE POLICY "Service role can insert notifications"
ON public.user_notifications FOR INSERT TO service_role WITH CHECK (true);

-- invoice_import_errors
DROP POLICY IF EXISTS "System can insert import errors" ON public.invoice_import_errors;
CREATE POLICY "Service role can insert import errors"
ON public.invoice_import_errors FOR INSERT TO service_role WITH CHECK (true);

-- invoice_status_update_errors
DROP POLICY IF EXISTS "System can insert status update errors" ON public.invoice_status_update_errors;
CREATE POLICY "Service role can insert status update errors"
ON public.invoice_status_update_errors FOR INSERT TO service_role WITH CHECK (true);
