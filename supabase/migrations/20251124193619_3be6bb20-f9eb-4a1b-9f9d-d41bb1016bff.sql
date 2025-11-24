-- Create enum for document categories
CREATE TYPE public.document_category AS ENUM (
  'ACH',
  'WIRE',
  'W9',
  'EIN',
  'PROOF_OF_BUSINESS',
  'CONTRACT',
  'BANKING_INFO',
  'TAX_DOCUMENT',
  'OTHER'
);

-- Create enum for document status
CREATE TYPE public.document_status AS ENUM (
  'uploaded',
  'pending_review',
  'verified',
  'expired',
  'rejected'
);

-- Create documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  debtor_id UUID REFERENCES public.debtors(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID NOT NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_size BIGINT,
  category public.document_category NOT NULL,
  status public.document_status NOT NULL DEFAULT 'uploaded',
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  verified_by_user_id UUID,
  verified_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT organization_or_debtor_required CHECK (
    (organization_id IS NOT NULL AND debtor_id IS NULL) OR
    (organization_id IS NULL AND debtor_id IS NOT NULL)
  )
);

-- Create document_versions table for version history
CREATE TABLE public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  version INTEGER NOT NULL,
  uploaded_by_user_id UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create document_access_log table for audit trail
CREATE TABLE public.document_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'view', 'download', 'upload', 'delete', 'verify', 'reject'
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_documents_organization ON public.documents(organization_id);
CREATE INDEX idx_documents_debtor ON public.documents(debtor_id);
CREATE INDEX idx_documents_category ON public.documents(category);
CREATE INDEX idx_documents_status ON public.documents(status);
CREATE INDEX idx_documents_created_at ON public.documents(created_at DESC);
CREATE INDEX idx_document_versions_document ON public.document_versions(document_id);
CREATE INDEX idx_document_access_log_document ON public.document_access_log(document_id);
CREATE INDEX idx_document_access_log_user ON public.document_access_log(user_id);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_access_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for documents
CREATE POLICY "Users can view documents of their organizations"
  ON public.documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = documents.organization_id
      AND owner_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.account_users
      WHERE account_id = documents.organization_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "Users can view documents of their debtors"
  ON public.documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.debtors
      WHERE id = documents.debtor_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Organization admins can insert documents"
  ON public.documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = documents.organization_id
      AND owner_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.account_users
      WHERE account_id = documents.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status = 'active'
    )
  );

CREATE POLICY "Users can insert documents for their debtors"
  ON public.documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.debtors
      WHERE id = documents.debtor_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Organization admins can update documents"
  ON public.documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = documents.organization_id
      AND owner_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.account_users
      WHERE account_id = documents.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status = 'active'
    )
  );

CREATE POLICY "Users can update documents for their debtors"
  ON public.documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.debtors
      WHERE id = documents.debtor_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Organization admins can delete documents"
  ON public.documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = documents.organization_id
      AND owner_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.account_users
      WHERE account_id = documents.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status = 'active'
    )
  );

CREATE POLICY "Users can delete documents for their debtors"
  ON public.documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.debtors
      WHERE id = documents.debtor_id
      AND user_id = auth.uid()
    )
  );

-- RLS Policies for document_versions
CREATE POLICY "Users can view document versions"
  ON public.document_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      LEFT JOIN public.organizations o ON d.organization_id = o.id
      LEFT JOIN public.account_users au ON au.account_id = o.id
      LEFT JOIN public.debtors deb ON d.debtor_id = deb.id
      WHERE d.id = document_versions.document_id
      AND (
        o.owner_user_id = auth.uid()
        OR (au.user_id = auth.uid() AND au.status = 'active')
        OR deb.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert document versions"
  ON public.document_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      LEFT JOIN public.organizations o ON d.organization_id = o.id
      LEFT JOIN public.account_users au ON au.account_id = o.id
      LEFT JOIN public.debtors deb ON d.debtor_id = deb.id
      WHERE d.id = document_versions.document_id
      AND (
        o.owner_user_id = auth.uid()
        OR (au.user_id = auth.uid() AND au.role IN ('owner', 'admin') AND au.status = 'active')
        OR deb.user_id = auth.uid()
      )
    )
  );

-- RLS Policies for document_access_log
CREATE POLICY "Admins can view all document access logs"
  ON public.document_access_log FOR SELECT
  USING (is_recouply_admin(auth.uid()));

CREATE POLICY "Users can view their own document access logs"
  ON public.document_access_log FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert document access logs"
  ON public.document_access_log FOR INSERT
  WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to log document access
CREATE OR REPLACE FUNCTION public.log_document_access(
  p_document_id UUID,
  p_action VARCHAR(50),
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.document_access_log (
    document_id,
    user_id,
    action,
    metadata
  ) VALUES (
    p_document_id,
    auth.uid(),
    p_action,
    p_metadata
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;