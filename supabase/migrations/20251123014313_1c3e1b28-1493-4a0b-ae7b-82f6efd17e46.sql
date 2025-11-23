-- Create ai_command_logs table for tracking persona command usage
CREATE TABLE IF NOT EXISTS public.ai_command_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  command_text TEXT NOT NULL,
  persona_name TEXT,
  invoice_id UUID,
  draft_id UUID,
  context_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_command_logs ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own command logs
CREATE POLICY "Users can view own command logs"
  ON public.ai_command_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert their own command logs
CREATE POLICY "Users can insert own command logs"
  ON public.ai_command_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_ai_command_logs_user_id ON public.ai_command_logs(user_id);
CREATE INDEX idx_ai_command_logs_created_at ON public.ai_command_logs(created_at DESC);