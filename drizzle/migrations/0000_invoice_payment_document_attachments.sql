CREATE TABLE public.invoice_document_attachments (
 invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
 document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(invoice_id, document_id)
);
GRANT SELECT, INSERT, DELETE ON public.invoice_document_attachments TO authenticated;
GRANT ALL ON public.invoice_document_attachments TO service_role;
ALTER TABLE public.invoice_document_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account readers view invoice attachments" ON public.invoice_document_attachments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id=invoice_id AND public.can_access_account_data(auth.uid(),i.user_id)));
CREATE POLICY "Account writers attach payment documents" ON public.invoice_document_attachments FOR INSERT TO authenticated WITH CHECK (created_by=auth.uid() AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.id=invoice_id AND public.can_write_as_account(auth.uid(),i.user_id)));
CREATE POLICY "Account writers detach payment documents" ON public.invoice_document_attachments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id=invoice_id AND public.can_write_as_account(auth.uid(),i.user_id)));
CREATE OR REPLACE FUNCTION public.validate_invoice_payment_document() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS (
 SELECT 1 FROM public.invoices i JOIN public.documents d ON d.id=NEW.document_id
 LEFT JOIN public.organizations o ON o.id=d.organization_id
 LEFT JOIN public.debtors deb ON deb.id=d.debtor_id
 WHERE i.id=NEW.invoice_id AND d.category IN ('WIRE','BANKING_INFO','ACH','OTHER')
 AND d.status NOT IN ('rejected','expired') AND (d.expires_at IS NULL OR d.expires_at>now())
 AND (d.uploaded_by_user_id=i.user_id OR o.owner_user_id=i.user_id OR deb.user_id=i.user_id
 OR (d.debtor_id=i.debtor_id AND public.can_write_as_account(d.uploaded_by_user_id,i.user_id)))
 ) THEN RAISE EXCEPTION 'Payment document must belong to the invoice account and cannot be rejected or expired'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_invoice_payment_document BEFORE INSERT OR UPDATE ON public.invoice_document_attachments FOR EACH ROW EXECUTE FUNCTION public.validate_invoice_payment_document();
CREATE POLICY "Uploaders read private document files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='documents' AND ((storage.foldername(name))[1]=auth.uid()::text OR EXISTS (SELECT 1 FROM public.documents d WHERE d.file_url=objects.name AND d.uploaded_by_user_id=auth.uid())));
CREATE POLICY "Uploaders remove private document files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='documents' AND ((storage.foldername(name))[1]=auth.uid()::text OR EXISTS (SELECT 1 FROM public.documents d WHERE d.file_url=objects.name AND d.uploaded_by_user_id=auth.uid())));