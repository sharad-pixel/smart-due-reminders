-- Create marketing_snippets table for storing AI-generated industry-specific copy
CREATE TABLE public.marketing_snippets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  industry TEXT NOT NULL UNIQUE,
  problem_copy TEXT NOT NULL,
  solution_copy TEXT NOT NULL,
  results_copy TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketing_snippets ENABLE ROW LEVEL SECURITY;

-- Allow public read access for marketing content
CREATE POLICY "Marketing snippets are viewable by everyone"
ON public.marketing_snippets
FOR SELECT
USING (true);

-- Only authenticated users can insert/update (for admin purposes)
CREATE POLICY "Authenticated users can insert marketing snippets"
ON public.marketing_snippets
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update marketing snippets"
ON public.marketing_snippets
FOR UPDATE
TO authenticated
USING (true);

-- Add index for faster industry lookups
CREATE INDEX idx_marketing_snippets_industry ON public.marketing_snippets(industry);

-- Add trigger for updated_at
CREATE TRIGGER update_marketing_snippets_updated_at
BEFORE UPDATE ON public.marketing_snippets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();