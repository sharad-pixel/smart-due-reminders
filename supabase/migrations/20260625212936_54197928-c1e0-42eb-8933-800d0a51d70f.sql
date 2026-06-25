-- 1. Drop storage policies for clm-templates bucket
DROP POLICY IF EXISTS "Account members read CLM template files" ON storage.objects;
DROP POLICY IF EXISTS "Account writers upload CLM template files" ON storage.objects;
DROP POLICY IF EXISTS "Account writers update CLM template files" ON storage.objects;
DROP POLICY IF EXISTS "Account writers delete CLM template files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own CLM templates" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own CLM templates" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own CLM templates" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own CLM templates" ON storage.objects;

-- 2. Drop helper function (references soon-to-be-dropped tables)
DROP FUNCTION IF EXISTS public.has_clm_access(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.has_clm_access(uuid) CASCADE;

-- 3. Drop all CLM authoring tables (CASCADE handles FKs between them)
DROP TABLE IF EXISTS public.clm_kurt_chat_messages CASCADE;
DROP TABLE IF EXISTS public.clm_kurt_landing_messages CASCADE;
DROP TABLE IF EXISTS public.clm_kurt_recommendations CASCADE;
DROP TABLE IF EXISTS public.clm_revision_comments CASCADE;
DROP TABLE IF EXISTS public.clm_section_comments CASCADE;
DROP TABLE IF EXISTS public.clm_section_revisions CASCADE;
DROP TABLE IF EXISTS public.clm_instance_sections CASCADE;
DROP TABLE IF EXISTS public.clm_instance_contacts CASCADE;
DROP TABLE IF EXISTS public.clm_instance_debtors CASCADE;
DROP TABLE IF EXISTS public.clm_instance_extra_templates CASCADE;
DROP TABLE IF EXISTS public.clm_instance_finalization CASCADE;
DROP TABLE IF EXISTS public.clm_uploaded_redlines CASCADE;
DROP TABLE IF EXISTS public.clm_document_versions CASCADE;
DROP TABLE IF EXISTS public.clm_signature_packages CASCADE;
DROP TABLE IF EXISTS public.clm_approval_requests CASCADE;
DROP TABLE IF EXISTS public.clm_approval_rules CASCADE;
DROP TABLE IF EXISTS public.clm_review_batches CASCADE;
DROP TABLE IF EXISTS public.clm_external_access CASCADE;
DROP TABLE IF EXISTS public.clm_notification_queue CASCADE;
DROP TABLE IF EXISTS public.clm_audit_log CASCADE;
DROP TABLE IF EXISTS public.clm_engagement_profiles CASCADE;
DROP TABLE IF EXISTS public.clm_workspace_approval_routing CASCADE;
DROP TABLE IF EXISTS public.clm_workspace_compliance_requirements CASCADE;
DROP TABLE IF EXISTS public.clm_workspace_required_documents CASCADE;
DROP TABLE IF EXISTS public.clm_template_instances CASCADE;
DROP TABLE IF EXISTS public.clm_template_sections CASCADE;
DROP TABLE IF EXISTS public.clm_templates CASCADE;