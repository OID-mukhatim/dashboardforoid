ALTER TABLE public.kpis
  ADD COLUMN IF NOT EXISTS plan_year INTEGER,
  ADD COLUMN IF NOT EXISTS is_baseline BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fiscal_type TEXT DEFAULT 'calendar';

UPDATE public.kpis
  SET plan_year = 2026,
      is_baseline = true,
      fiscal_type = CASE WHEN entity_code IN ('ZUST','TAYO','HAMDI') THEN 'academic' ELSE 'calendar' END
  WHERE plan_year IS NULL;

UPDATE public.kpis
  SET kpi_code = kpi_code || '-2026'
  WHERE plan_year = 2026
    AND kpi_code NOT LIKE '%-2026'
    AND kpi_code NOT LIKE '%-2027';

ALTER TABLE public.quarterly_reports
  ADD COLUMN IF NOT EXISTS plan_year INTEGER,
  ADD COLUMN IF NOT EXISTS is_baseline BOOLEAN DEFAULT false;

UPDATE public.quarterly_reports
  SET plan_year = COALESCE(year, 2026), is_baseline = true
  WHERE plan_year IS NULL;

CREATE TABLE IF NOT EXISTS public.org_active_years (
  org_id TEXT PRIMARY KEY,
  active_year INTEGER NOT NULL,
  fiscal_type TEXT NOT NULL DEFAULT 'calendar',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_active_years TO authenticated;
GRANT ALL ON public.org_active_years TO service_role;

ALTER TABLE public.org_active_years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_active_years" ON public.org_active_years;
CREATE POLICY "read_active_years" ON public.org_active_years
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "write_active_years" ON public.org_active_years;
CREATE POLICY "write_active_years" ON public.org_active_years
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'developer'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'developer'::app_role));

INSERT INTO public.org_active_years (org_id, active_year, fiscal_type) VALUES
  ('ZF', 2026, 'calendar'),
  ('ZAD', 2026, 'calendar'),
  ('KAFI', 2026, 'calendar'),
  ('ZUST', 2026, 'academic'),
  ('TAYO', 2026, 'academic'),
  ('HAMDI', 2027, 'academic')
ON CONFLICT (org_id) DO UPDATE SET active_year = EXCLUDED.active_year, fiscal_type = EXCLUDED.fiscal_type, updated_at = now();

CREATE INDEX IF NOT EXISTS idx_kpis_plan_year ON public.kpis (entity_code, plan_year);
CREATE INDEX IF NOT EXISTS idx_quarterly_plan_year ON public.quarterly_reports (org_id, plan_year);