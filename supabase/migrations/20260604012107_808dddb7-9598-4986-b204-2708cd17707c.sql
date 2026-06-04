
DROP VIEW IF EXISTS public.drive_connections_safe;

CREATE VIEW public.drive_connections_safe
WITH (security_invoker = true) AS
SELECT id, user_id, organization_id, provider, folder_id, folder_name,
       (refresh_token IS NOT NULL) AS has_refresh_token,
       token_expires_at, last_sync_at, sync_frequency, is_active,
       created_at, updated_at
FROM public.drive_connections
WHERE user_id = auth.uid();

GRANT SELECT ON public.drive_connections_safe TO authenticated;
