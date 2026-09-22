CREATE TABLE public.financial_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  plan_year INTEGER NOT NULL DEFAULT 2026,
  quarter TEXT NOT NULL,
  fiscal_type TEXT DEFAULT 'calendar',
  approved_budget NUMERIC DEFAULT 0,
  actual_spending NUMERIC DEFAULT 0,
  surplus_deficit NUMERIC DEFAULT 0,
  revenues JSONB DEFAULT '[]'::jsonb,
  expenses JSONB DEFAULT '[]'::jsonb,
  challenges TEXT,
  actions TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, plan_year, quarter)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_reports TO authenticated;
GRANT ALL ON public.financial_reports TO service_role;

ALTER TABLE public.financial_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_financial_reports"
  ON public.financial_reports FOR SELECT TO authenticated USING (true);

CREATE POLICY "write_financial_reports"
  ON public.financial_reports FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'developer'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'developer'));

CREATE INDEX financial_reports_org_year_quarter_idx ON public.financial_reports (org_id, plan_year, quarter);

CREATE TRIGGER financial_reports_set_updated_at BEFORE UPDATE ON public.financial_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER financial_reports_set_created_by BEFORE INSERT ON public.financial_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();