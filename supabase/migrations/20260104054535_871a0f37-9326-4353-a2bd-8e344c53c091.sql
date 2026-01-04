-- Migration: Remove legacy contact fields from debtors table
-- Step 1: Migrate any legacy contact data to debtor_contacts table

-- Insert contacts from legacy fields where no contact exists yet
INSERT INTO debtor_contacts (debtor_id, user_id, organization_id, name, email, phone, is_primary, outreach_enabled, created_at, updated_at)
SELECT 
  d.id as debtor_id,
  d.user_id,
  d.organization_id,
  COALESCE(
    NULLIF(d.primary_contact_name, ''),
    NULLIF(d.ar_contact_name, ''),
    NULLIF(d.contact_name, ''),
    d.company_name
  ) as name,
  COALESCE(
    NULLIF(d.primary_email, ''),
    NULLIF(d.ar_contact_email, ''),
    NULLIF(d.email, '')
  ) as email,
  COALESCE(
    NULLIF(d.primary_phone, ''),
    NULLIF(d.ar_contact_phone, ''),
    NULLIF(d.phone, '')
  ) as phone,
  true as is_primary,
  true as outreach_enabled,
  NOW() as created_at,
  NOW() as updated_at
FROM debtors d
WHERE NOT EXISTS (
  SELECT 1 FROM debtor_contacts dc WHERE dc.debtor_id = d.id
)
AND (
  d.email IS NOT NULL AND d.email != ''
  OR d.primary_email IS NOT NULL AND d.primary_email != ''
  OR d.ar_contact_email IS NOT NULL AND d.ar_contact_email != ''
);

-- Step 2: Drop the legacy contact columns from debtors table
ALTER TABLE debtors DROP COLUMN IF EXISTS contact_name;
ALTER TABLE debtors DROP COLUMN IF EXISTS primary_contact_name;
ALTER TABLE debtors DROP COLUMN IF EXISTS primary_email;
ALTER TABLE debtors DROP COLUMN IF EXISTS primary_phone;
ALTER TABLE debtors DROP COLUMN IF EXISTS ar_contact_name;
ALTER TABLE debtors DROP COLUMN IF EXISTS ar_contact_email;
ALTER TABLE debtors DROP COLUMN IF EXISTS ar_contact_phone;