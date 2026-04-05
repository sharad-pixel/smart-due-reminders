CREATE OR REPLACE FUNCTION public.claim_inbound_emails_for_processing(batch_limit integer DEFAULT 50)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE inbound_emails
  SET status = 'processing'
  WHERE inbound_emails.id IN (
    SELECT ie.id
    FROM inbound_emails ie
    WHERE ie.ai_summary IS NULL
      AND ie.status IN ('received', 'linked')
    ORDER BY ie.created_at ASC
    LIMIT batch_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING inbound_emails.id;
END;
$$;