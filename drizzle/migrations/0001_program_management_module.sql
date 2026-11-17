CREATE TABLE public.programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  ai_summary text,
  ai_summary_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.program_workstreams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name text NOT NULL,
  lead text,
  status text NOT NULL DEFAULT 'on_track',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.program_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  workstream_id uuid REFERENCES public.program_workstreams(id) ON DELETE SET NULL,
  item_type text NOT NULL CHECK (item_type IN ('risk','assumption','issue','dependency','raci','decision')),
  title text NOT NULL,
  description text,
  owner text,
  status text NOT NULL DEFAULT 'open',
  severity text,
  due_date date,
  responsible text, accountable text, consulted text, informed text,
  rationale text,
  source text NOT NULL DEFAULT 'manual',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.program_workstreams(program_id);
CREATE INDEX ON public.program_items(program_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.programs, public.program_workstreams, public.program_items TO authenticated;
GRANT ALL ON public.programs, public.program_workstreams, public.program_items TO service_role;

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_workstreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_program(p_program_id uuid, p_write boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM programs p WHERE p.id = p_program_id AND
    CASE WHEN p_write THEN public.can_write_as_account(auth.uid(), p.account_id)
         ELSE public.can_access_account_data(auth.uid(), p.account_id) END)
$$;

CREATE POLICY "team view programs" ON public.programs FOR SELECT TO authenticated USING (public.can_access_account_data(auth.uid(), account_id));
CREATE POLICY "team insert programs" ON public.programs FOR INSERT TO authenticated WITH CHECK (public.can_write_as_account(auth.uid(), account_id));
CREATE POLICY "team update programs" ON public.programs FOR UPDATE TO authenticated USING (public.can_write_as_account(auth.uid(), account_id)) WITH CHECK (public.can_write_as_account(auth.uid(), account_id));
CREATE POLICY "team delete programs" ON public.programs FOR DELETE TO authenticated USING (public.can_write_as_account(auth.uid(), account_id));

CREATE POLICY "view ws" ON public.program_workstreams FOR SELECT TO authenticated USING (public.can_access_program(program_id,false));
CREATE POLICY "insert ws" ON public.program_workstreams FOR INSERT TO authenticated WITH CHECK (public.can_access_program(program_id,true));
CREATE POLICY "update ws" ON public.program_workstreams FOR UPDATE TO authenticated USING (public.can_access_program(program_id,true)) WITH CHECK (public.can_access_program(program_id,true));
CREATE POLICY "delete ws" ON public.program_workstreams FOR DELETE TO authenticated USING (public.can_access_program(program_id,true));

CREATE POLICY "view items" ON public.program_items FOR SELECT TO authenticated USING (public.can_access_program(program_id,false));
CREATE POLICY "insert items" ON public.program_items FOR INSERT TO authenticated WITH CHECK (public.can_access_program(program_id,true));
CREATE POLICY "update items" ON public.program_items FOR UPDATE TO authenticated USING (public.can_access_program(program_id,true)) WITH CHECK (public.can_access_program(program_id,true));
CREATE POLICY "delete items" ON public.program_items FOR DELETE TO authenticated USING (public.can_access_program(program_id,true));