-- Drop and recreate the generate_invite_token function with correct schema reference
DROP FUNCTION IF EXISTS public.generate_invite_token();

CREATE OR REPLACE FUNCTION public.generate_invite_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT encode(extensions.gen_random_bytes(32), 'hex');
$$;