-- Add is_archived column to inbound_emails for archiving emails when invoice is closed/settled
ALTER TABLE public.inbound_emails 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS archived_reason TEXT;

-- Create index for filtering archived emails
CREATE INDEX IF NOT EXISTS idx_inbound_emails_is_archived ON public.inbound_emails(is_archived);

-- Create a function to automatically archive inbound emails when invoice is closed/paid
CREATE OR REPLACE FUNCTION public.archive_emails_on_invoice_close()
RETURNS TRIGGER AS $$
BEGIN
  -- If invoice status changed to Paid or Canceled, archive related inbound emails
  IF NEW.status IN ('Paid', 'Canceled') AND (OLD.status IS NULL OR OLD.status NOT IN ('Paid', 'Canceled')) THEN
    UPDATE public.inbound_emails
    SET 
      is_archived = true,
      archived_at = NOW(),
      archived_reason = 'Invoice ' || CASE WHEN NEW.status = 'Paid' THEN 'settled' ELSE 'canceled' END
    WHERE invoice_id = NEW.id
      AND is_archived = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-archive emails when invoice closes
DROP TRIGGER IF EXISTS trigger_archive_emails_on_invoice_close ON public.invoices;
CREATE TRIGGER trigger_archive_emails_on_invoice_close
  AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.archive_emails_on_invoice_close();