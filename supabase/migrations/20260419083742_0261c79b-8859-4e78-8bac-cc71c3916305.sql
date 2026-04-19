-- Update handle_new_user to use the public anon key (the notify-new-signup function is verify_jwt=false)
-- This removes the vault dependency and ensures the trigger always fires successfully

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url text := 'https://kguurazunazhhrhasahd.supabase.co';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVyYXp1bmF6aGhyaGFzYWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NjQyNzMsImV4cCI6MjA3OTM0MDI3M30.9pSbWiSKOwO5YkoRwtE2-pgjtxXSBhD59RwxA1fYsMY';
  v_payload jsonb;
BEGIN
  -- Insert profile (existing behavior)
  INSERT INTO profiles (id, email, name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name')
  ON CONFLICT (id) DO NOTHING;

  -- Build notification payload
  v_payload := jsonb_build_object(
    'userId', NEW.id,
    'email', NEW.email,
    'name', NEW.raw_user_meta_data->>'name',
    'companyName', NEW.raw_user_meta_data->>'business_name',
    'provider', COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
    'createdAt', NEW.created_at
  );

  -- Fire async HTTP call to notify-new-signup edge function (non-blocking)
  BEGIN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/notify-new-signup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key,
        'apikey', v_anon_key
      ),
      body := v_payload,
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never let notification failure block signup
    RAISE WARNING 'Failed to invoke notify-new-signup: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;