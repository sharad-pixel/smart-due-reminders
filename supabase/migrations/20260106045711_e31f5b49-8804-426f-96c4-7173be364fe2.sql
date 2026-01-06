-- Fix search_path security warnings for the new functions
ALTER FUNCTION create_default_outreach_templates(UUID) SET search_path = public;
ALTER FUNCTION handle_invoice_status_change_outreach() SET search_path = public;
ALTER FUNCTION auto_create_outreach_templates() SET search_path = public;