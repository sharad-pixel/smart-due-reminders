-- Create table for user-defined custom fields that can be saved per source
CREATE TABLE public.data_center_custom_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_id UUID REFERENCES public.data_center_sources(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  data_type TEXT NOT NULL DEFAULT 'string',
  grouping TEXT NOT NULL DEFAULT 'custom',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(source_id, key)
);

-- Enable RLS
ALTER TABLE public.data_center_custom_fields ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own custom fields"
  ON public.data_center_custom_fields FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own custom fields"
  ON public.data_center_custom_fields FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own custom fields"
  ON public.data_center_custom_fields FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom fields"
  ON public.data_center_custom_fields FOR DELETE
  USING (auth.uid() = user_id);