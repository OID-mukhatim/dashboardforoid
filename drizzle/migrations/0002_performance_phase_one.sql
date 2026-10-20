CREATE TABLE public.perf_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id text NOT NULL REFERENCES public.organizations(id), plan_year integer NOT NULL,
 fiscal_type text NOT NULL CHECK (fiscal_type IN ('calendar','academic')), status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','objectives_approved','matrix_approved')),
 prepared_by text, approved_by text, objectives_approved_at timestamptz, matrix_approved_at timestamptz,
 source_upload_id uuid REFERENCES public.uploads(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(org_id,plan_year)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.perf_plans TO authenticated;
GRANT ALL ON public.perf_plans TO service_role;
ALTER TABLE public.perf_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY perf_plans_read ON public.perf_plans FOR SELECT TO authenticated USING(true);
CREATE POLICY perf_plans_write ON public.perf_plans FOR ALL TO authenticated USING(private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'developer'::app_role)) WITH CHECK(private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'developer'::app_role));
CREATE TABLE public.perf_kpis (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL REFERENCES public.perf_plans(id) ON DELETE CASCADE,
 perspective text NOT NULL CHECK(perspective IN ('S','P','L','F')), seq integer NOT NULL, code text NOT NULL, objective text NOT NULL DEFAULT '', name text NOT NULL,
 measurement text NOT NULL CHECK(measurement IN ('pct','num','qual')), role text NOT NULL CHECK(role IN ('leading','lagging')),
 unit text NOT NULL CHECK(unit IN ('number','percent','amount','days','likert')), polarity text NOT NULL CHECK(polarity IN ('asc','desc')),
 calc_method text NOT NULL CHECK(calc_method IN ('q_independent','q_cumulative','q_average','h_independent','h_cumulative','h_average','annual')),
 weight numeric NOT NULL, baseline numeric, annual_target numeric,
 q1_plan numeric,q1_actual numeric,q2_plan numeric,q2_actual numeric,q3_plan numeric,q3_actual numeric,q4_plan numeric,q4_actual numeric,
 description text,department text,calculation_formula text,data_sources text,related_kpis text,enablers text,notes text,
 UNIQUE(plan_id,code), CHECK(weight >= 0), CHECK(seq > 0),
 CHECK((measurement='pct' AND unit='percent') OR (measurement='num' AND unit IN ('number','amount','days')) OR (measurement='qual' AND unit='likert')),
 CHECK(NOT (measurement='qual' OR unit='likert') OR calc_method IN ('q_average','h_average','annual'))
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.perf_kpis TO authenticated;
GRANT ALL ON public.perf_kpis TO service_role;
ALTER TABLE public.perf_kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY perf_kpis_read ON public.perf_kpis FOR SELECT TO authenticated USING(true);
CREATE POLICY perf_kpis_write ON public.perf_kpis FOR ALL TO authenticated USING(private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'developer'::app_role)) WITH CHECK(private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'developer'::app_role));
CREATE TABLE public.perf_activities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),plan_id uuid NOT NULL REFERENCES public.perf_plans(id) ON DELETE CASCADE,
 quarter text NOT NULL CHECK(quarter IN ('Q1','Q2','Q3','Q4')),activity_type text NOT NULL CHECK(activity_type IN ('program','event','training')),
 title text NOT NULL,target_group text,implementer text,beneficiaries numeric,planned numeric,achieved numeric,kpi_code text,notes text
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.perf_activities TO authenticated;
GRANT ALL ON public.perf_activities TO service_role;
ALTER TABLE public.perf_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY perf_activities_read ON public.perf_activities FOR SELECT TO authenticated USING(true);
CREATE POLICY perf_activities_write ON public.perf_activities FOR ALL TO authenticated USING(private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'developer'::app_role)) WITH CHECK(private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'developer'::app_role));
CREATE TABLE public.perf_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),plan_id uuid NOT NULL REFERENCES public.perf_plans(id) ON DELETE CASCADE,
 period text NOT NULL CHECK(period IN ('Q1','Q2','Q3','Q4')),executive_summary text,planned_beneficiaries numeric,
 annual_stats jsonb NOT NULL DEFAULT '[]',achievements jsonb NOT NULL DEFAULT '[]',challenges jsonb NOT NULL DEFAULT '[]',proposals jsonb NOT NULL DEFAULT '[]',
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted')),submitted_at timestamptz,snapshot jsonb,UNIQUE(plan_id,period)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.perf_reports TO authenticated;
GRANT ALL ON public.perf_reports TO service_role;
ALTER TABLE public.perf_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY perf_reports_read ON public.perf_reports FOR SELECT TO authenticated USING(true);
CREATE POLICY perf_reports_write ON public.perf_reports FOR ALL TO authenticated USING(private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'developer'::app_role)) WITH CHECK(private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'developer'::app_role));
CREATE TRIGGER perf_plans_updated BEFORE UPDATE ON public.perf_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER audit_perf_plans AFTER INSERT OR UPDATE OR DELETE ON public.perf_plans FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_perf_kpis AFTER INSERT OR UPDATE OR DELETE ON public.perf_kpis FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_perf_activities AFTER INSERT OR UPDATE OR DELETE ON public.perf_activities FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_perf_reports AFTER INSERT OR UPDATE OR DELETE ON public.perf_reports FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE FUNCTION public.perf_activity_kpi_valid() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.kpi_code IS NOT NULL AND NEW.kpi_code<>'' AND NOT EXISTS(SELECT 1 FROM public.perf_kpis WHERE plan_id=NEW.plan_id AND code=NEW.kpi_code) THEN RAISE EXCEPTION 'Unknown KPI code for activity'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER perf_activity_code_check BEFORE INSERT OR UPDATE ON public.perf_activities FOR EACH ROW EXECUTE FUNCTION public.perf_activity_kpi_valid();
CREATE FUNCTION public.commit_perf_import(p_org text,p_year integer,p_upload uuid,p_payload jsonb,p_allow_definitions boolean,p_revision text) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE plan public.perf_plans; item jsonb; k public.perf_kpis; a public.perf_activities; rep public.perf_reports; prefix text; approved boolean;
BEGIN
 IF NOT (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'developer'::app_role)) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_org),p_year);
 SELECT * INTO plan FROM public.perf_plans WHERE org_id=p_org AND plan_year=p_year FOR UPDATE;
 IF plan.id IS NOT NULL AND plan.updated_at::text IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Plan changed; preview again'; END IF;
 IF plan.id IS NULL AND p_revision IS NOT NULL THEN RAISE EXCEPTION 'Plan changed; preview again'; END IF;
 SELECT abbr INTO prefix FROM public.organizations WHERE id=p_org AND status='active';
 IF prefix IS NULL THEN RAISE EXCEPTION 'Unknown organization'; END IF;
 IF plan.id IS NULL THEN
  INSERT INTO public.perf_plans(org_id,plan_year,fiscal_type) SELECT p_org,p_year,fiscal_type FROM public.organizations WHERE id=p_org RETURNING * INTO plan;
 END IF;
 approved:=plan.status='matrix_approved';
 IF NOT approved OR p_allow_definitions THEN
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'kpis') x GROUP BY x->>'perspective' HAVING abs(sum((x->>'weight')::numeric)-25)>0.000001) OR (SELECT count(DISTINCT x->>'perspective') FROM jsonb_array_elements(p_payload->'kpis') x)<>4 THEN RAISE EXCEPTION 'Invalid perspective weights'; END IF;
  DELETE FROM public.perf_activities WHERE plan_id=plan.id;
  IF NOT approved THEN DELETE FROM public.perf_kpis WHERE plan_id=plan.id;
  ELSE
   DELETE FROM public.perf_kpis WHERE plan_id=plan.id AND code NOT IN(SELECT x->>'code' FROM jsonb_array_elements(p_payload->'kpis') x);
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(p_payload->'kpis') LOOP
   SELECT * INTO k FROM jsonb_populate_record(NULL::public.perf_kpis,item);
   IF NOT approved THEN k.code:=prefix||'-'||k.perspective||k.seq; END IF;
   INSERT INTO public.perf_kpis SELECT (jsonb_populate_record(NULL::public.perf_kpis,to_jsonb(k)||jsonb_build_object('id',gen_random_uuid(),'plan_id',plan.id))).*
   ON CONFLICT(plan_id,code) DO UPDATE SET perspective=EXCLUDED.perspective,seq=EXCLUDED.seq,objective=EXCLUDED.objective,name=EXCLUDED.name,measurement=EXCLUDED.measurement,role=EXCLUDED.role,unit=EXCLUDED.unit,polarity=EXCLUDED.polarity,calc_method=EXCLUDED.calc_method,weight=EXCLUDED.weight,baseline=EXCLUDED.baseline,annual_target=EXCLUDED.annual_target,q1_plan=EXCLUDED.q1_plan,q2_plan=EXCLUDED.q2_plan,q3_plan=EXCLUDED.q3_plan,q4_plan=EXCLUDED.q4_plan,q1_actual=EXCLUDED.q1_actual,q2_actual=EXCLUDED.q2_actual,q3_actual=EXCLUDED.q3_actual,q4_actual=EXCLUDED.q4_actual;
  END LOOP;
  FOR item IN SELECT * FROM jsonb_array_elements(p_payload->'activities') LOOP
   SELECT * INTO a FROM jsonb_populate_record(NULL::public.perf_activities,item);
   INSERT INTO public.perf_activities SELECT (jsonb_populate_record(NULL::public.perf_activities,to_jsonb(a)||jsonb_build_object('id',gen_random_uuid(),'plan_id',plan.id))).*;
  END LOOP;
 ELSE
  FOR item IN SELECT * FROM jsonb_array_elements(p_payload->'kpis') LOOP
   UPDATE public.perf_kpis SET q1_actual=(item->>'q1_actual')::numeric,q2_actual=(item->>'q2_actual')::numeric,q3_actual=(item->>'q3_actual')::numeric,q4_actual=(item->>'q4_actual')::numeric WHERE plan_id=plan.id AND code=item->>'code';
  END LOOP;
 END IF;
 SELECT * INTO rep FROM jsonb_populate_record(NULL::public.perf_reports,p_payload->'report');
 INSERT INTO public.perf_reports(id,plan_id,period,executive_summary,planned_beneficiaries,annual_stats,achievements,challenges,proposals)
 VALUES(gen_random_uuid(),plan.id,rep.period,rep.executive_summary,rep.planned_beneficiaries,rep.annual_stats,rep.achievements,rep.challenges,rep.proposals)
 ON CONFLICT(plan_id,period) DO UPDATE SET executive_summary=EXCLUDED.executive_summary,planned_beneficiaries=EXCLUDED.planned_beneficiaries,annual_stats=EXCLUDED.annual_stats,achievements=EXCLUDED.achievements,challenges=EXCLUDED.challenges,proposals=EXCLUDED.proposals;
 UPDATE public.perf_plans SET prepared_by=p_payload->>'prepared_by',approved_by=p_payload->>'approved_by',source_upload_id=p_upload WHERE id=plan.id;
 UPDATE public.uploads SET status='processed',org_id=p_org,period=rep.period,rows_extracted=jsonb_array_length(p_payload->'kpis'),extracted_summary=jsonb_build_object('plan_id',plan.id,'year',p_year) WHERE id=p_upload;
 RETURN plan.id;
END $$;
REVOKE ALL ON FUNCTION public.commit_perf_import(text,integer,uuid,jsonb,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.commit_perf_import(text,integer,uuid,jsonb,boolean,text) TO authenticated;