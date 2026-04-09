
CREATE OR REPLACE FUNCTION public.update_invoice_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.invoice_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_address TEXT DEFAULT '',
  company_phone TEXT DEFAULT '',
  company_website TEXT DEFAULT '',
  show_logo BOOLEAN DEFAULT true,
  show_ship_to BOOLEAN DEFAULT true,
  show_po_number BOOLEAN DEFAULT true,
  show_sales_rep BOOLEAN DEFAULT false,
  show_tax BOOLEAN DEFAULT true,
  show_payment_instructions BOOLEAN DEFAULT true,
  header_color TEXT DEFAULT '#1a56db',
  payment_instructions_wire TEXT DEFAULT '',
  payment_instructions_check TEXT DEFAULT '',
  footer_note TEXT DEFAULT 'Thank you for your business.',
  font_style TEXT DEFAULT 'modern',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own invoice template"
ON public.invoice_templates FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own invoice template"
ON public.invoice_templates FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own invoice template"
ON public.invoice_templates FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own invoice template"
ON public.invoice_templates FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_invoice_templates_updated_at
BEFORE UPDATE ON public.invoice_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_invoice_templates_updated_at();
