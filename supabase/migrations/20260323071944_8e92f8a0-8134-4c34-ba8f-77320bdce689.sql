-- Deactivate duplicate ai_workflow records, keeping only the newest per invoice
WITH ranked AS (
  SELECT id, invoice_id,
    ROW_NUMBER() OVER (PARTITION BY invoice_id ORDER BY created_at DESC) as rn
  FROM ai_workflows
  WHERE is_active = true
)
UPDATE ai_workflows
SET is_active = false
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);