-- Create table for logging Nicolas escalations
CREATE TABLE public.nicolas_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL,
  organization_id UUID NULL,
  page_route TEXT,
  question TEXT NOT NULL,
  confidence_score NUMERIC,
  escalation_reason TEXT,
  transcript_excerpt TEXT,
  email_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nicolas_escalations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own escalations
CREATE POLICY "Users can insert their own escalations"
ON public.nicolas_escalations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow anonymous users to insert escalations (for marketing pages)
CREATE POLICY "Anonymous users can insert escalations"
ON public.nicolas_escalations
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

-- Allow system to select all escalations (for edge functions)
CREATE POLICY "System can select all escalations"
ON public.nicolas_escalations
FOR SELECT
TO service_role
USING (true);

-- Create index for analytics queries
CREATE INDEX idx_nicolas_escalations_created_at ON public.nicolas_escalations(created_at DESC);
CREATE INDEX idx_nicolas_escalations_user_id ON public.nicolas_escalations(user_id);