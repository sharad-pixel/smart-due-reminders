-- Add database trigger to automatically notify admins and send welcome email on every new signup
-- This covers email signups, Google OAuth, and invite acceptances

-- Store the service role key in vault for trigger use (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'notify_signup_service_key') THEN
    PERFORM vault.create_secret(
      current_setting('app.settings.service_role_key', true),
      'notify_signup_service_key',
      'Service role key used by handle_new_user trigger to call notify-new-signup'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- vault may not be writable from migrations in all environments; ignore
  NULL;
END $$;

-- Update handle_new_user trigger to also fire HTTP call to notify-new-signup edge function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_service_key text;
  v_supabase_url text := 'https://kguurazunazhhrhasahd.supabase.co';
  v_payload jsonb;
BEGIN
  -- Insert profile (existing behavior)
  INSERT INTO profiles (id, email, name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name')
  ON CONFLICT (id) DO NOTHING;

  -- Try to fetch service role key from vault
  BEGIN
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
    WHERE name = 'notify_signup_service_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service_key := NULL;
  END;

  -- Fire async HTTP call to notify-new-signup edge function (non-blocking)
  IF v_service_key IS NOT NULL THEN
    v_payload := jsonb_build_object(
      'userId', NEW.id,
      'email', NEW.email,
      'name', NEW.raw_user_meta_data->>'name',
      'companyName', NEW.raw_user_meta_data->>'business_name',
      'provider', COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
      'createdAt', NEW.created_at
    );

    BEGIN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/notify-new-signup',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_key
        ),
        body := v_payload,
        timeout_milliseconds := 5000
      );
    EXCEPTION WHEN OTHERS THEN
      -- Never let notification failure block signup
      RAISE WARNING 'Failed to invoke notify-new-signup: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;