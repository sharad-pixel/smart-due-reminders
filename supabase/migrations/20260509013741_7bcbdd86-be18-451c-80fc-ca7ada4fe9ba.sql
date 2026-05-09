-- Add version_number for per-section sequential numbering
ALTER TABLE public.clm_section_revisions
  ADD COLUMN IF NOT EXISTS version_number INTEGER;

CREATE OR REPLACE FUNCTION public.set_clm_revision_version_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.version_number IS NULL THEN
    SELECT COALESCE(MAX(version_number), 0) + 1
      INTO NEW.version_number
      FROM public.clm_section_revisions
     WHERE instance_id = NEW.instance_id
       AND section_id  = NEW.section_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clm_revisions_version_number ON public.clm_section_revisions;
CREATE TRIGGER trg_clm_revisions_version_number
  BEFORE INSERT ON public.clm_section_revisions
  FOR EACH ROW EXECUTE FUNCTION public.set_clm_revision_version_number();

-- Backfill existing rows in chronological order per (instance, section)
WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY instance_id, section_id ORDER BY created_at) AS rn
    FROM public.clm_section_revisions
)
UPDATE public.clm_section_revisions r
   SET version_number = n.rn
  FROM numbered n
 WHERE r.id = n.id
   AND (r.version_number IS NULL OR r.version_number <> n.rn);

CREATE INDEX IF NOT EXISTS idx_clm_revisions_section_version
  ON public.clm_section_revisions (instance_id, section_id, version_number DESC);