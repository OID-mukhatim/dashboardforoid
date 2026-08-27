CREATE TABLE public.office_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  org_id      TEXT,
  section_ref TEXT,
  priority    TEXT NOT NULL DEFAULT 'medium',
  status      TEXT NOT NULL DEFAULT 'open',
  due_date    DATE,
  created_by  UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.office_tasks TO authenticated;
GRANT ALL ON public.office_tasks TO service_role;

ALTER TABLE public.office_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tasks" ON public.office_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_tasks" ON public.office_tasks FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR created_by = auth.uid())
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) OR created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.set_created_by()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by = auth.uid(); END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.set_created_by() FROM anon, authenticated, public;

CREATE TRIGGER office_tasks_set_created_by
  BEFORE INSERT ON public.office_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

CREATE TRIGGER office_tasks_set_updated_at
  BEFORE UPDATE ON public.office_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();