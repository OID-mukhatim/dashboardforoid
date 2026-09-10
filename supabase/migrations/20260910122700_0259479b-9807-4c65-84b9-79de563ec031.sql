CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  duration TEXT,
  location TEXT,
  meeting_type TEXT NOT NULL DEFAULT 'internal',
  org_id TEXT,
  objective TEXT,
  minutes TEXT,
  outputs TEXT,
  attendees JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.meeting_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  decision TEXT NOT NULL,
  assigned_to TEXT,
  due_date DATE,
  task_id UUID REFERENCES public.office_tasks(id) ON DELETE SET NULL,
  converted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  date DATE NOT NULL,
  objective TEXT,
  visit_type TEXT NOT NULL DEFAULT 'scheduled',
  oid_delegate TEXT,
  org_delegate TEXT,
  visual_identity TEXT,
  discipline TEXT,
  readiness TEXT,
  prev_followups TEXT,
  best_practices TEXT,
  general_work TEXT,
  outputs TEXT,
  challenges TEXT,
  performance TEXT NOT NULL DEFAULT 'good',
  guidance TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.visit_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  gap TEXT NOT NULL,
  action TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  due_date DATE,
  task_id UUID REFERENCES public.office_tasks(id) ON DELETE SET NULL,
  converted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.office_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  year INTEGER NOT NULL DEFAULT 2026,
  quarter TEXT,
  objective TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.plan_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.office_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open',
  task_id UUID REFERENCES public.office_tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['meetings','meeting_decisions','visits','visit_gaps','office_plans','plan_activities'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY "read_%s" ON public.%I FOR SELECT TO authenticated USING (true);', t, t);
    EXECUTE format('CREATE POLICY "write_%s" ON public.%I FOR ALL TO authenticated USING (private.has_role(auth.uid(),''admin''::app_role) OR private.has_role(auth.uid(),''developer''::app_role)) WITH CHECK (private.has_role(auth.uid(),''admin''::app_role) OR private.has_role(auth.uid(),''developer''::app_role));', t, t);
    EXECUTE format('CREATE TRIGGER set_updated_at_%s BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t, t);
  END LOOP;
END $$;

CREATE INDEX idx_meetings_date ON public.meetings (date DESC);
CREATE INDEX idx_meetings_org ON public.meetings (org_id);
CREATE INDEX idx_meeting_decisions_meeting ON public.meeting_decisions (meeting_id);
CREATE INDEX idx_visits_org_date ON public.visits (org_id, date DESC);
CREATE INDEX idx_visit_gaps_visit ON public.visit_gaps (visit_id);
CREATE INDEX idx_office_plans_year ON public.office_plans (year, quarter);
CREATE INDEX idx_plan_activities_plan ON public.plan_activities (plan_id);

CREATE TRIGGER set_created_by_meetings BEFORE INSERT ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.set_created_by();
CREATE TRIGGER set_created_by_visits BEFORE INSERT ON public.visits FOR EACH ROW EXECUTE FUNCTION public.set_created_by();
CREATE TRIGGER set_created_by_office_plans BEFORE INSERT ON public.office_plans FOR EACH ROW EXECUTE FUNCTION public.set_created_by();