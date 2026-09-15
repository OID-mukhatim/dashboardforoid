CREATE TABLE IF NOT EXISTS public.kpi_perspectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  plan_year INTEGER NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT,
  weight NUMERIC NOT NULL DEFAULT 25,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, plan_year, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_perspectives TO authenticated;
GRANT ALL ON public.kpi_perspectives TO service_role;
ALTER TABLE public.kpi_perspectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_kpi_perspectives" ON public.kpi_perspectives FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_kpi_perspectives" ON public.kpi_perspectives FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'developer'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'developer'::app_role));

CREATE TABLE IF NOT EXISTS public.kpi_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perspective_id UUID NOT NULL REFERENCES public.kpi_perspectives(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL,
  plan_year INTEGER NOT NULL,
  name TEXT NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (perspective_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_goals TO authenticated;
GRANT ALL ON public.kpi_goals TO service_role;
ALTER TABLE public.kpi_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_kpi_goals" ON public.kpi_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_kpi_goals" ON public.kpi_goals FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'developer'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'developer'::app_role));

ALTER TABLE public.kpis
  ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.kpi_goals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS card_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS related_goal TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS indicator_type TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS polarity TEXT,
  ADD COLUMN IF NOT EXISTS calculation TEXT,
  ADD COLUMN IF NOT EXISTS data_sources TEXT,
  ADD COLUMN IF NOT EXISTS frequency TEXT,
  ADD COLUMN IF NOT EXISTS related_kpis TEXT,
  ADD COLUMN IF NOT EXISTS enablers TEXT,
  ADD COLUMN IF NOT EXISTS threshold_red TEXT,
  ADD COLUMN IF NOT EXISTS threshold_yellow TEXT,
  ADD COLUMN IF NOT EXISTS threshold_green TEXT;

CREATE INDEX IF NOT EXISTS idx_kpis_card_completed ON public.kpis (card_completed);
CREATE INDEX IF NOT EXISTS idx_kpis_goal_id ON public.kpis (goal_id);
CREATE INDEX IF NOT EXISTS idx_kpi_goals_perspective ON public.kpi_goals (perspective_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kpis_unique_plan
  ON public.kpis (entity_code, kpi_code, plan_year);