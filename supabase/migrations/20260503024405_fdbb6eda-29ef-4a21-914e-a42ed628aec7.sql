REVOKE EXECUTE ON FUNCTION public.is_active_support_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_active_support_write_access(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_support_with_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_support_with_write_access(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_active_support_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_support_write_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_support_with_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_support_with_write_access(uuid, uuid) TO authenticated;