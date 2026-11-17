CREATE OR REPLACE FUNCTION public.has_program_hub_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_recouply_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.user_feature_overrides
    WHERE user_id = _user_id AND feature_key = 'program_hub' AND value = true)
$$;

CREATE OR REPLACE FUNCTION public.can_access_program(p_program_id uuid, p_write boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_program_hub_access(auth.uid()) AND EXISTS (SELECT 1 FROM programs p WHERE p.id = p_program_id AND
    CASE WHEN p_write THEN public.can_write_as_account(auth.uid(), p.account_id)
         ELSE public.can_access_account_data(auth.uid(), p.account_id) END)
$$;

DROP POLICY "team delete programs" ON public.programs;
DROP POLICY "team insert programs" ON public.programs;
DROP POLICY "team update programs" ON public.programs;
DROP POLICY "team view programs" ON public.programs;
CREATE POLICY "team view programs" ON public.programs FOR SELECT TO authenticated
  USING (public.has_program_hub_access(auth.uid()) AND public.can_access_account_data(auth.uid(), account_id));
CREATE POLICY "team insert programs" ON public.programs FOR INSERT TO authenticated
  WITH CHECK (public.has_program_hub_access(auth.uid()) AND public.can_write_as_account(auth.uid(), account_id));
CREATE POLICY "team update programs" ON public.programs FOR UPDATE TO authenticated
  USING (public.has_program_hub_access(auth.uid()) AND public.can_write_as_account(auth.uid(), account_id))
  WITH CHECK (public.has_program_hub_access(auth.uid()) AND public.can_write_as_account(auth.uid(), account_id));
CREATE POLICY "team delete programs" ON public.programs FOR DELETE TO authenticated
  USING (public.has_program_hub_access(auth.uid()) AND public.can_write_as_account(auth.uid(), account_id));