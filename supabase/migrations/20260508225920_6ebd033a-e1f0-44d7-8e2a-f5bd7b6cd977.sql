ALTER TABLE public.clm_instance_debtors
  ADD CONSTRAINT clm_instance_debtors_debtor_id_fkey
  FOREIGN KEY (debtor_id) REFERENCES public.debtors(id) ON DELETE CASCADE;