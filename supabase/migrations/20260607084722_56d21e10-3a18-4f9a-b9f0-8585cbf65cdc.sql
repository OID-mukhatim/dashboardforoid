
CREATE TABLE public.kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid REFERENCES public.uploads(id) ON DELETE SET NULL,
  entity_code text NOT NULL,
  entity_name text,
  sector text,
  objective text,
  kpi_code text NOT NULL,
  kpi_name text,
  kpi_type text,
  weight numeric,
  baseline numeric,
  annual_target numeric,
  q1_planned numeric, q2_planned numeric, q3_planned numeric, q4_planned numeric,
  total_planned numeric,
  q1_actual numeric, q2_actual numeric, q3_actual numeric, q4_actual numeric,
  total_actual numeric,
  achievement_pct numeric,
  overall_pct numeric,
  final_output text,
  period text NOT NULL DEFAULT 'all',
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_code, kpi_code, period)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpis TO authenticated, anon;
GRANT ALL ON public.kpis TO service_role;

ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_select_kpis" ON public.kpis FOR SELECT USING (true);
CREATE POLICY "open_insert_kpis" ON public.kpis FOR INSERT WITH CHECK (true);
CREATE POLICY "open_update_kpis" ON public.kpis FOR UPDATE USING (true);
CREATE POLICY "open_delete_kpis" ON public.kpis FOR DELETE USING (true);

CREATE INDEX kpis_entity_period_idx ON public.kpis (entity_code, period);
CREATE INDEX kpis_upload_idx ON public.kpis (upload_id);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER kpis_set_updated_at BEFORE UPDATE ON public.kpis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
