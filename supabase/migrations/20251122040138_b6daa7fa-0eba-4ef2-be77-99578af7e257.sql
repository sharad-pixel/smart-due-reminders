-- Add reference_id columns to debtors and invoices tables
ALTER TABLE public.debtors
ADD COLUMN reference_id TEXT UNIQUE;

ALTER TABLE public.invoices
ADD COLUMN reference_id TEXT UNIQUE;

-- Create indexes for faster searching
CREATE INDEX idx_debtors_reference_id ON public.debtors(reference_id);
CREATE INDEX idx_invoices_reference_id ON public.invoices(reference_id);

-- Create function to generate unique reference IDs
CREATE OR REPLACE FUNCTION public.generate_reference_id(prefix TEXT, target_table TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id TEXT;
  id_exists BOOLEAN;
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  random_part TEXT;
  attempt_count INT := 0;
  max_attempts INT := 100;
BEGIN
  LOOP
    -- Generate random 5-character alphanumeric string
    random_part := '';
    FOR i IN 1..5 LOOP
      random_part := random_part || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    new_id := prefix || '-' || random_part;
    
    -- Check if ID exists in target table
    IF target_table = 'debtors' THEN
      SELECT EXISTS(SELECT 1 FROM public.debtors WHERE reference_id = new_id) INTO id_exists;
    ELSIF target_table = 'invoices' THEN
      SELECT EXISTS(SELECT 1 FROM public.invoices WHERE reference_id = new_id) INTO id_exists;
    ELSE
      RAISE EXCEPTION 'Invalid target table: %', target_table;
    END IF;
    
    -- If ID is unique, return it
    IF NOT id_exists THEN
      RETURN new_id;
    END IF;
    
    -- Prevent infinite loops
    attempt_count := attempt_count + 1;
    IF attempt_count >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique reference ID after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$;

-- Create trigger function for debtors
CREATE OR REPLACE FUNCTION public.set_debtor_reference_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reference_id IS NULL OR NEW.reference_id = '' THEN
    NEW.reference_id := public.generate_reference_id('DEB', 'debtors');
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger function for invoices
CREATE OR REPLACE FUNCTION public.set_invoice_reference_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reference_id IS NULL OR NEW.reference_id = '' THEN
    NEW.reference_id := public.generate_reference_id('INV', 'invoices');
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER trigger_set_debtor_reference_id
BEFORE INSERT ON public.debtors
FOR EACH ROW
EXECUTE FUNCTION public.set_debtor_reference_id();

CREATE TRIGGER trigger_set_invoice_reference_id
BEFORE INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.set_invoice_reference_id();

-- Generate reference IDs for existing records
UPDATE public.debtors
SET reference_id = public.generate_reference_id('DEB', 'debtors')
WHERE reference_id IS NULL;

UPDATE public.invoices
SET reference_id = public.generate_reference_id('INV', 'invoices')
WHERE reference_id IS NULL;

-- Make columns NOT NULL after populating existing records
ALTER TABLE public.debtors
ALTER COLUMN reference_id SET NOT NULL;

ALTER TABLE public.invoices
ALTER COLUMN reference_id SET NOT NULL;