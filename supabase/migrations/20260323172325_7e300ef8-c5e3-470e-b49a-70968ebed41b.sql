
-- Debtors
CREATE INDEX IF NOT EXISTS idx_debtors_user_id ON public.debtors (user_id);
CREATE INDEX IF NOT EXISTS idx_debtors_org_id ON public.debtors (organization_id);

-- Collection activities
CREATE INDEX IF NOT EXISTS idx_collection_activities_debtor ON public.collection_activities (debtor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_activities_user_created ON public.collection_activities (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_activities_org ON public.collection_activities (organization_id, created_at DESC);

-- Collection tasks
CREATE INDEX IF NOT EXISTS idx_collection_tasks_user_status ON public.collection_tasks (user_id, status);
CREATE INDEX IF NOT EXISTS idx_collection_tasks_org_status ON public.collection_tasks (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_collection_tasks_debtor ON public.collection_tasks (debtor_id, status);
CREATE INDEX IF NOT EXISTS idx_collection_tasks_due_date ON public.collection_tasks (due_date) WHERE status IN ('pending', 'in_progress');

-- AI drafts
CREATE INDEX IF NOT EXISTS idx_ai_drafts_user_status ON public.ai_drafts (user_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_invoice ON public.ai_drafts (invoice_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_org ON public.ai_drafts (organization_id, status);

-- Outreach logs (has invoice_id per types.ts)
CREATE INDEX IF NOT EXISTS idx_outreach_logs_invoice ON public.outreach_logs (invoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_logs_user ON public.outreach_logs (user_id, created_at DESC);
