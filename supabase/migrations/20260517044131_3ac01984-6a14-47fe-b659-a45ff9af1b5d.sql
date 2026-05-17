
REVOKE EXECUTE ON FUNCTION public.consume_platform_credits(uuid, numeric, text, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_platform_credits(uuid, numeric, text, uuid, uuid, text) TO authenticated, service_role;
