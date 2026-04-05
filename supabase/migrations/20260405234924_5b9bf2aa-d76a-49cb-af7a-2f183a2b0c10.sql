
CREATE OR REPLACE FUNCTION public.sync_debtor_email_to_primary_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only act when email is set/changed and is not null/empty
  IF NEW.email IS NOT NULL AND TRIM(NEW.email) != '' 
     AND (TG_OP = 'INSERT' OR NEW.email IS DISTINCT FROM OLD.email) THEN

    -- Check if a primary contact already exists
    IF EXISTS (
      SELECT 1 FROM debtor_contacts
      WHERE debtor_id = NEW.id AND is_primary = true
    ) THEN
      -- Update the existing primary contact's email
      UPDATE debtor_contacts
      SET email = TRIM(NEW.email),
          updated_at = now()
      WHERE debtor_id = NEW.id AND is_primary = true;
    ELSE
      -- Create a new primary contact from debtor record
      INSERT INTO debtor_contacts (
        debtor_id, user_id, organization_id, name, email, phone,
        is_primary, outreach_enabled, source
      ) VALUES (
        NEW.id,
        NEW.user_id,
        (SELECT id FROM organizations WHERE owner_user_id = NEW.user_id LIMIT 1),
        COALESCE(NEW.company_name, NEW.name, 'Primary Contact'),
        TRIM(NEW.email),
        NEW.phone,
        true,
        true,
        'auto_sync'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger for INSERT and UPDATE on debtors
CREATE TRIGGER trg_sync_debtor_email_to_primary_contact
  AFTER INSERT OR UPDATE OF email ON public.debtors
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_debtor_email_to_primary_contact();
