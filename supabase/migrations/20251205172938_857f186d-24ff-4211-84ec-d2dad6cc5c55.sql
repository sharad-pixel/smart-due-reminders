-- Create image moderation logs table
CREATE TABLE public.image_moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL,
  user_id uuid NULL,
  image_purpose text NOT NULL,
  storage_path text NULL,
  moderation_status text NOT NULL CHECK (moderation_status IN ('accepted', 'rejected')),
  categories jsonb DEFAULT '{}'::jsonb,
  rejection_reason text NULL,
  file_name text NULL,
  file_size integer NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.image_moderation_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own moderation logs
CREATE POLICY "Users can view own moderation logs"
ON public.image_moderation_logs
FOR SELECT
USING (auth.uid() = user_id);

-- System can insert moderation logs
CREATE POLICY "System can insert moderation logs"
ON public.image_moderation_logs
FOR INSERT
WITH CHECK (true);

-- Admins can view all moderation logs
CREATE POLICY "Admins can view all moderation logs"
ON public.image_moderation_logs
FOR SELECT
USING (is_recouply_admin(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_image_moderation_logs_user_id ON public.image_moderation_logs(user_id);
CREATE INDEX idx_image_moderation_logs_status ON public.image_moderation_logs(moderation_status);
CREATE INDEX idx_image_moderation_logs_created_at ON public.image_moderation_logs(created_at DESC);