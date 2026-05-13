
-- Extend contract_invoice_schedules with completion + reconciliation
ALTER TABLE public.contract_invoice_schedules
  ADD COLUMN IF NOT EXISTS completion_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid,
  ADD COLUMN IF NOT EXISTS completion_note text,
  ADD COLUMN IF NOT EXISTS reconciliation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reconciliation_candidates jsonb,
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;

-- Allow 'manual' attachment source
ALTER TABLE public.contract_invoice_schedules
  DROP CONSTRAINT IF EXISTS contract_invoice_schedules_attachment_source_check;
ALTER TABLE public.contract_invoice_schedules
  ADD CONSTRAINT contract_invoice_schedules_attachment_source_check
  CHECK (attachment_source IS NULL OR attachment_source IN ('generated','linked','ocr','manual'));

ALTER TABLE public.contract_invoice_schedules
  ADD CONSTRAINT contract_invoice_schedules_completion_status_check
  CHECK (completion_status IN ('pending','completed','skipped'));

ALTER TABLE public.contract_invoice_schedules
  ADD CONSTRAINT contract_invoice_schedules_reconciliation_status_check
  CHECK (reconciliation_status IN ('pending','matched','partial','missing','unclear','extra'));

-- Extend collection_tasks for contract-sourced tasks
ALTER TABLE public.collection_tasks
  ADD COLUMN IF NOT EXISTS task_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_ref jsonb;

-- Idempotent index for contract-sourced tasks
CREATE UNIQUE INDEX IF NOT EXISTS collection_tasks_contract_source_uniq
  ON public.collection_tasks (
    (source_ref->>'import_id'),
    COALESCE(source_ref->>'schedule_id', ''),
    COALESCE(source_ref->>'key_date_type', ''),
    COALESCE(source_ref->>'kind', '')
  )
  WHERE task_source = 'contract';
