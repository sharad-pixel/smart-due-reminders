-- Allow scoping a workspace collaborator to a specific template within the workspace.
-- Nullable: existing collaborators stay workspace-wide.
ALTER TABLE public.clm_instance_contacts
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.clm_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clm_instance_contacts_template
  ON public.clm_instance_contacts(template_id);

-- Drop the old unique that prevented adding the same contact under multiple templates
ALTER TABLE public.clm_instance_contacts
  DROP CONSTRAINT IF EXISTS clm_instance_contacts_instance_id_contact_id_key;

-- Re-create unique: (instance, contact, template). NULL template_id is treated as "all templates"
CREATE UNIQUE INDEX IF NOT EXISTS clm_instance_contacts_inst_contact_tpl_key
  ON public.clm_instance_contacts (instance_id, contact_id, COALESCE(template_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE contact_id IS NOT NULL;
