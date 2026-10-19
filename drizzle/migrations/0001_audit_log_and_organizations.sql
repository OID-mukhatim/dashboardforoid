CREATE TABLE public.organizations (
  id text PRIMARY KEY,
  name_ar text NOT NULL,
  name_en text NOT NULL DEFAULT '',
  abbr text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#64748b',
  fiscal_type text NOT NULL DEFAULT 'calendar' CHECK (fiscal_type IN ('calendar','academic')),
  aliases text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_organizations ON public.organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY admin_insert_organizations ON public.organizations FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY admin_update_organizations ON public.organizations FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER organizations_set_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.organizations (id, name_ar, name_en, abbr, color, fiscal_type, aliases, sort_order) VALUES
('ZF','مؤسسة زمزم','Zamzam Foundation','ZF','#d97706','calendar', ARRAY['(?:مؤسسة|شركة)\s*زمزم','زمزم\s*للتنمية','\bZamzam\s+Foundation\b','\bZF\b','^زمزم$'],1),
('ZUST','جامعة زمزم للعلوم والتكنولوجيا','ZUST','ZU','#1d4ed8','academic', ARRAY['جامعة\s*زمزم','\bZamzam\s+University\b','\bZUST\b'],2),
('ZAD','زاد للتنمية','Zad for Development','ZD','#ea580c','calendar', ARRAY['(?:مؤسسة|شركة)\s*زاد','زاد\s*للتنمية','\bZad\s+for\s+Development\b','\bZAD\b'],3),
('TAYO','تيو للتعليم','Tayo for Education','TY','#2563eb','academic', ARRAY['(?:مؤسسة|شركة|مدارس)\s*تيو','تيو\s*للتعليم','تيو\s*للتنمية','\bTayo\s+for\s+Education\b','\bTAYO\b'],4),
('KAFI','كافي للتنمية','Kafi for Development','KF','#15803d','calendar', ARRAY['(?:مؤسسة|شركة)\s*كافي','كافي\s*للتنمية','\bKafi\s+for\s+Development\b','\bKAFI\b'],5),
('HAMDI','منظمة حمدي للتنمية','Hamdi Organization','HM','#94a3b8','academic', ARRAY['(?:منظمة|مؤسسة|شركة)\s*حمد[يى]','حمد[يى]\s*لل(?:رعاية|تنمية)','\bHamdi\s+Organization\b','\bHAMDI\b'],6);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text,
  org_id text,
  action text NOT NULL CHECK (action IN ('insert','update','delete')),
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  old_data jsonb,
  new_data jsonb,
  changed_fields text[]
);
CREATE INDEX audit_log_changed_at_idx ON public.audit_log (changed_at DESC);
CREATE INDEX audit_log_filters_idx ON public.audit_log (table_name, org_id, changed_by);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_read_audit ON public.audit_log FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.audit_log_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'audit_log is append-only'; END; $$;
CREATE TRIGGER audit_log_no_change BEFORE UPDATE OR DELETE ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.audit_log_immutable();

CREATE OR REPLACE FUNCTION public.audit_row_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o jsonb; n jsonb; r jsonb; fields text[];
BEGIN
  IF TG_OP = 'INSERT' THEN n := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN o := to_jsonb(OLD); n := to_jsonb(NEW);
  ELSE o := to_jsonb(OLD); END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT coalesce(array_agg(k ORDER BY k), '{}') INTO fields
      FROM jsonb_object_keys(n) k WHERE (n -> k) IS DISTINCT FROM (o -> k) AND k <> 'updated_at';
    IF cardinality(fields) = 0 THEN RETURN NEW; END IF;
  END IF;
  r := coalesce(n, o);
  INSERT INTO public.audit_log (table_name, record_id, org_id, action, changed_by, old_data, new_data, changed_fields)
  VALUES (
    TG_TABLE_NAME,
    coalesce(r ->> 'id', r ->> 'org_id'),
    CASE WHEN TG_TABLE_NAME IN ('institutions','organizations') THEN r ->> 'id' ELSE coalesce(r ->> 'org_id', r ->> 'entity_code') END,
    lower(TG_OP), auth.uid(), o, n, fields
  );
  RETURN coalesce(NEW, OLD);
END; $$;
REVOKE EXECUTE ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['kpis','kpi_perspectives','kpi_goals','gap_scores','governance_policies','quarterly_reports','financial_reports','advisor_snapshots','timeline_entries','org_active_years','institutions','organizations','partnerships','initiatives','office_tasks','meetings','meeting_decisions','visits','visit_gaps','office_plans','plan_activities','uploads','terminology'] LOOP
    EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t);
  END LOOP;
END $$;