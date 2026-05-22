UPDATE public.live_contract_imports
SET status = 'failed',
    error = 'Previous OCR run timed out — retry from the AI Ingestion page.'
WHERE id = 'ef0f6a5b-5684-4aba-8f91-609e2f8c31e4'
  AND status IN ('ocr_processing','ai_extracting','scanning');