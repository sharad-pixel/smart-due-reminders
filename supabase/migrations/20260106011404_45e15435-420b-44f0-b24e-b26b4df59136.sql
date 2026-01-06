-- ============================================
-- Fix QuickBooks contact misalignment
-- Ensure outreach always has a Primary Contact
-- ============================================

-- 1) Add unique constraint to prevent duplicate contacts (user_id, debtor_id, email)
CREATE UNIQUE INDEX IF NOT EXISTS idx_debtor_contacts_unique_email
ON public.debtor_contacts (user_id, debtor_id, email)
WHERE email IS NOT NULL AND email != '';

-- 2) Add partial unique index to enforce single primary contact per debtor
CREATE UNIQUE INDEX IF NOT EXISTS idx_debtor_contacts_single_primary
ON public.debtor_contacts (user_id, debtor_id)
WHERE is_primary = true;

-- 3) Add source column to debtor_contacts to track origin
ALTER TABLE public.debtor_contacts
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

-- 4) Add external_contact_id for QB sync deduplication
ALTER TABLE public.debtor_contacts
ADD COLUMN IF NOT EXISTS external_contact_id text;

-- 5) Unique index on external_contact_id for QB sync
CREATE UNIQUE INDEX IF NOT EXISTS idx_debtor_contacts_external_id
ON public.debtor_contacts (user_id, debtor_id, external_contact_id)
WHERE external_contact_id IS NOT NULL;

-- 6) Backfill: Copy contacts from QB 'contacts' table to 'debtor_contacts' if not exists
INSERT INTO public.debtor_contacts (
  user_id,
  debtor_id,
  name,
  email,
  phone,
  title,
  is_primary,
  outreach_enabled,
  source,
  external_contact_id,
  created_at,
  updated_at
)
SELECT
  c.user_id,
  c.debtor_id,
  COALESCE(c.name, c.first_name || ' ' || c.last_name, 'Primary Contact'),
  c.email,
  c.phone,
  c.title,
  COALESCE(c.is_primary, false),
  true, -- outreach_enabled by default
  'quickbooks',
  c.external_contact_id,
  c.created_at,
  c.updated_at
FROM public.contacts c
WHERE c.external_contact_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM public.debtor_contacts dc
  WHERE dc.user_id = c.user_id
    AND dc.debtor_id = c.debtor_id
    AND dc.external_contact_id = c.external_contact_id
)
ON CONFLICT DO NOTHING;

-- 7) Backfill: Create primary contacts for debtors that have email but no contacts
INSERT INTO public.debtor_contacts (
  user_id,
  debtor_id,
  name,
  email,
  phone,
  is_primary,
  outreach_enabled,
  source
)
SELECT
  d.user_id,
  d.id,
  COALESCE(d.company_name, d.name, 'Primary Contact'),
  d.email,
  d.phone,
  true, -- is_primary
  true, -- outreach_enabled
  'auto_generated'
FROM public.debtors d
WHERE d.email IS NOT NULL
  AND d.email != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.debtor_contacts dc
    WHERE dc.debtor_id = d.id
  )
ON CONFLICT DO NOTHING;

-- 8) Fix debtors that have contacts but none marked primary: set oldest as primary
-- First unset any is_primary (in case of duplicates from partial index)
-- Then set the oldest contact as primary for each debtor
WITH debtors_without_primary AS (
  SELECT DISTINCT dc.debtor_id
  FROM public.debtor_contacts dc
  WHERE NOT EXISTS (
    SELECT 1 FROM public.debtor_contacts dc2
    WHERE dc2.debtor_id = dc.debtor_id
      AND dc2.is_primary = true
  )
),
oldest_contacts AS (
  SELECT DISTINCT ON (dc.debtor_id) dc.id
  FROM public.debtor_contacts dc
  JOIN debtors_without_primary dwp ON dc.debtor_id = dwp.debtor_id
  ORDER BY dc.debtor_id, dc.created_at ASC
)
UPDATE public.debtor_contacts
SET is_primary = true
WHERE id IN (SELECT id FROM oldest_contacts);