-- Require explicit assignment for support member impersonation
CREATE OR REPLACE FUNCTION public.is_support_with_access(p_user_id uuid, p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Recouply admins always have access if a grant is active
    (public.is_recouply_admin(p_user_id) AND public.has_active_support_access(p_account_id))
    OR
    -- Support users only when explicitly assigned to this account's grant
    public.is_assigned_support_for_account(p_user_id, p_account_id);
$$;

-- Suppress new-signup notifications for support team accounts
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_key text;
  v_is_support boolean;
BEGIN
  v_is_support := COALESCE((NEW.raw_user_meta_data ->> 'support_user')::boolean, false);

  INSERT INTO public.profiles (id, email, name, is_support_user)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    v_is_support
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        is_support_user = public.profiles.is_support_user OR EXCLUDED.is_support_user;

  -- Skip signup notifications for support team auto-provisioned users
  IF v_is_support THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
    v_supabase_url := 'https://kguurazunazhhrhasahd.supabase.co';

    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/notify-new-signup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
      ),
      body := jsonb_build_object(
        'userId', NEW.id::text,
        'email', NEW.email,
        'name', COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name'),
        'provider', COALESCE(NEW.raw_app_meta_data ->> 'provider', 'email'),
        'createdAt', NEW.created_at::text
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to invoke notify-new-signup: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;