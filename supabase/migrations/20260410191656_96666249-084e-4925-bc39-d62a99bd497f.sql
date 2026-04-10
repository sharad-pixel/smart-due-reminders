-- Add retry_count column to track processing attempts
ALTER TABLE public.inbound_emails 
ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

-- Update the claim function to include error'd emails with retry_count < 3
CREATE OR REPLACE FUNCTION public.claim_inbound_emails_for_processing(batch_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  UPDATE inbound_emails
  SET status = 'processing',
      retry_count = inbound_emails.retry_count + 1
  WHERE inbound_emails.id IN (
    SELECT ie.id
    FROM inbound_emails ie
    WHERE ie.ai_summary IS NULL
      AND (
        ie.status IN ('received', 'linked')
        OR (ie.status = 'error' AND ie.retry_count < 3)
      )
    ORDER BY 
      CASE WHEN ie.status = 'error' THEN 1 ELSE 0 END,
      ie.created_at ASC
    LIMIT batch_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING inbound_emails.id;
END;
$function$;