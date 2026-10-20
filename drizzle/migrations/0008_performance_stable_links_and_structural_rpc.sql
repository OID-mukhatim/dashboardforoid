CREATE TABLE private.perf_structure_context (backend integer NOT NULL, xid bigint NOT NULL, plan_id uuid NOT NULL, PRIMARY KEY(backend,xid,plan_id));
REVOKE ALL ON private.perf_structure_context FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.perf_structure_allowed(p_plan uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT EXISTS(SELECT 1 FROM private.perf_structure_context WHERE backend=pg_backend_pid() AND xid=txid_current() AND plan_id=p_plan) $$;
REVOKE ALL ON FUNCTION private.perf_structure_allowed(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.perf_structure_allowed(uuid) TO authenticated;
ALTER TABLE public.perf_activities ADD COLUMN kpi_id uuid REFERENCES public.perf_kpis(id) ON DELETE SET NULL;
CREATE INDEX perf_activities_kpi_id_idx ON public.perf_activities(plan_id,kpi_id);
UPDATE public.perf_activities a SET kpi_id=k.id FROM public.perf_kpis k WHERE k.plan_id=a.plan_id AND k.code=a.kpi_code;
UPDATE public.perf_reports r SET achievements=(SELECT coalesce(jsonb_agg(e.value||jsonb_build_object('kpi_id',k.id,'kpi_code',k.code) ORDER BY e.ordinality),'[]'::jsonb) FROM jsonb_array_elements(r.achievements) WITH ORDINALITY e(value,ordinality) LEFT JOIN public.perf_kpis k ON k.plan_id=r.plan_id AND k.code=e.value->>'kpi_code');
CREATE FUNCTION private.perf_resolve_link(p_plan uuid,p_link jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_id uuid:=nullif(p_link->>'kpi_id','')::uuid; v_code text:=nullif(btrim(p_link->>'kpi_code'),''); k public.perf_kpis;
BEGIN
 IF v_id IS NULL AND v_code IS NULL THEN RETURN p_link||jsonb_build_object('kpi_id',NULL,'kpi_code',NULL); END IF;
 SELECT * INTO k FROM public.perf_kpis WHERE plan_id=p_plan AND ((v_id IS NOT NULL AND id=v_id) OR (v_id IS NULL AND code=v_code));
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_kpi_link'; END IF;
 RETURN p_link||jsonb_build_object('kpi_id',k.id,'kpi_code',k.code);
END $$;
REVOKE ALL ON FUNCTION private.perf_resolve_link(uuid,jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.perf_activity_kpi_valid() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE link jsonb;
BEGIN
 PERFORM 1 FROM public.perf_plans WHERE id=NEW.plan_id FOR UPDATE;
 IF TG_OP='UPDATE' AND NEW.kpi_id IS DISTINCT FROM OLD.kpi_id AND NEW.kpi_id IS NULL THEN NEW.kpi_code:=NULL; END IF;
 link:=private.perf_resolve_link(NEW.plan_id,to_jsonb(NEW)); NEW.kpi_id:=(link->>'kpi_id')::uuid; NEW.kpi_code:=link->>'kpi_code'; RETURN NEW;
END $$;
CREATE FUNCTION public.perf_report_links_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE e jsonb; result jsonb:='[]';
BEGIN
 PERFORM 1 FROM public.perf_plans WHERE id=NEW.plan_id FOR UPDATE;
 IF jsonb_typeof(NEW.achievements) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_achievement_array'; END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(NEW.achievements) LOOP
  IF jsonb_typeof(e)<>'object' THEN RAISE EXCEPTION 'invalid_achievement'; END IF;
  result:=result||jsonb_build_array(private.perf_resolve_link(NEW.plan_id,e));
 END LOOP;
 NEW.achievements:=result; RETURN NEW;
END $$;
CREATE TRIGGER perf_report_links BEFORE INSERT OR UPDATE ON public.perf_reports FOR EACH ROW EXECUTE FUNCTION public.perf_report_links_guard();
CREATE OR REPLACE FUNCTION public.perf_delete_reference() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 UPDATE public.perf_activities SET kpi_id=NULL,kpi_code=NULL WHERE plan_id=OLD.plan_id AND (kpi_id=OLD.id OR kpi_code=OLD.code);
 UPDATE public.perf_reports r SET achievements=(SELECT coalesce(jsonb_agg(CASE WHEN e.value->>'kpi_id'=OLD.id::text THEN e.value||jsonb_build_object('kpi_id',NULL,'kpi_code',NULL) ELSE e.value END ORDER BY e.ordinality),'[]') FROM jsonb_array_elements(r.achievements) WITH ORDINALITY e(value,ordinality)) WHERE r.plan_id=OLD.plan_id;
 RETURN OLD;
END $$;
CREATE OR REPLACE FUNCTION public.perf_kpi_definition_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE state text; allowed text[]:=ARRAY['q1_actual','q2_actual','q3_actual','q4_actual','description','department','calculation_formula','calc_formula_status','calc_formula_approved_by','calc_formula_approved_at','data_sources','related_kpis','enablers','notes'];
BEGIN
 SELECT status INTO state FROM public.perf_plans WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.plan_id ELSE NEW.plan_id END FOR UPDATE;
 IF TG_OP='DELETE' AND state IS NULL THEN RETURN OLD; END IF;
 IF TG_OP='UPDATE' AND (NEW.id,NEW.plan_id) IS DISTINCT FROM (OLD.id,OLD.plan_id) THEN RAISE EXCEPTION 'kpi_identity_locked'; END IF;
 IF TG_OP<>'UPDATE' THEN
  IF state IS DISTINCT FROM 'draft' OR NOT private.perf_structure_allowed(CASE WHEN TG_OP='DELETE' THEN OLD.plan_id ELSE NEW.plan_id END) THEN RAISE EXCEPTION 'use_mutate_perf_kpis'; END IF;
 ELSIF (NEW.perspective,NEW.seq,NEW.code) IS DISTINCT FROM (OLD.perspective,OLD.seq,OLD.code) AND (state IS DISTINCT FROM 'draft' OR NOT private.perf_structure_allowed(NEW.plan_id)) THEN RAISE EXCEPTION 'use_mutate_perf_kpis'; END IF;
 IF state='objectives_approved' AND TG_OP='UPDATE' AND (NEW.perspective,NEW.objective,NEW.name,NEW.seq,NEW.code) IS DISTINCT FROM (OLD.perspective,OLD.objective,OLD.name,OLD.seq,OLD.code) THEN RAISE EXCEPTION 'الخطة معتمدة — هذا الحقل مقفل'; END IF;
 IF state='matrix_approved' AND TG_OP='UPDATE' AND (to_jsonb(NEW)-allowed) IS DISTINCT FROM (to_jsonb(OLD)-allowed) THEN RAISE EXCEPTION 'الخطة معتمدة — هذا الحقل مقفل'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE FUNCTION public.perf_formula_metadata_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE editor boolean:=coalesce(private.has_role(auth.uid(),'admin'::app_role),false) OR coalesce(private.has_role(auth.uid(),'developer'::app_role),false);
BEGIN
 IF TG_OP='INSERT' OR NEW.calculation_formula IS DISTINCT FROM OLD.calculation_formula THEN
  IF nullif(btrim(NEW.calculation_formula),'') IS NOT NULL AND NOT editor THEN RAISE EXCEPTION 'غير مصرح لك بتعديل أو اعتماد المؤشرات'; END IF;
  NEW.calc_formula_status:=CASE WHEN nullif(btrim(NEW.calculation_formula),'') IS NULL THEN 'none' ELSE 'suggested' END; NEW.calc_formula_approved_by:=NULL; NEW.calc_formula_approved_at:=NULL;
 ELSIF NEW.calc_formula_status IS DISTINCT FROM OLD.calc_formula_status THEN
  IF NOT editor THEN RAISE EXCEPTION 'غير مصرح لك بتعديل أو اعتماد المؤشرات'; END IF;
  IF NEW.calc_formula_status='approved' THEN
   IF nullif(btrim(NEW.calculation_formula),'') IS NULL THEN RAISE EXCEPTION 'formula_required'; END IF;
   NEW.calc_formula_approved_by:=auth.uid(); NEW.calc_formula_approved_at:=clock_timestamp();
  ELSE NEW.calc_formula_approved_by:=NULL; NEW.calc_formula_approved_at:=NULL; END IF;
 ELSE NEW.calc_formula_approved_by:=OLD.calc_formula_approved_by; NEW.calc_formula_approved_at:=OLD.calc_formula_approved_at;
 END IF;
 IF NEW.calc_formula_status<>'approved' THEN NEW.calc_formula_approved_by:=NULL; NEW.calc_formula_approved_at:=NULL; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER perf_kpi_formula BEFORE INSERT OR UPDATE ON public.perf_kpis FOR EACH ROW EXECUTE FUNCTION public.perf_formula_metadata_guard();
CREATE FUNCTION public.mutate_perf_kpis(p_plan uuid,p_revision text,p_rows jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE plan public.perf_plans; prefix text; e jsonb; k public.perf_kpis; desired jsonb:='[]'; ids uuid[]:=ARRAY[]::uuid[]; v_id uuid; counts jsonb:='{}'; n integer;
BEGIN
 IF NOT (coalesce(private.has_role(auth.uid(),'admin'::public.app_role),false) OR coalesce(private.has_role(auth.uid(),'developer'::public.app_role),false)) THEN RAISE EXCEPTION 'غير مصرح لك بتعديل أو اعتماد المؤشرات'; END IF;
 SELECT * INTO plan FROM public.perf_plans WHERE id=p_plan FOR UPDATE;
 IF NOT FOUND OR plan.status<>'draft' THEN RAISE EXCEPTION 'الخطة معتمدة — هذا الحقل مقفل'; END IF;
 IF plan.updated_at IS DISTINCT FROM p_revision::timestamptz THEN RAISE EXCEPTION 'stale_preview'; END IF;
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_rows'; END IF;
 SELECT abbr INTO prefix FROM public.organizations WHERE id=plan.org_id;
 IF nullif(prefix,'') IS NULL THEN RAISE EXCEPTION 'unknown_organization'; END IF;
 IF private.perf_structure_allowed(p_plan) THEN RAISE EXCEPTION 'nested_structure_mutation'; END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  v_id:=nullif(e->>'id','')::uuid;
  IF v_id IS NOT NULL THEN
   SELECT * INTO k FROM public.perf_kpis WHERE plan_id=p_plan AND id=v_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'identity_missing'; END IF;
  ELSE
   v_id:=gen_random_uuid(); SELECT * INTO k FROM jsonb_populate_record(NULL::public.perf_kpis,jsonb_build_object('objective','','name','','perspective','S','measurement','num','role','leading','unit','number','polarity','asc','calc_method','q_independent','weight',0,'calc_formula_status','none'));
  END IF;
  IF v_id=ANY(ids) THEN RAISE EXCEPTION 'duplicate_identity'; END IF;
  SELECT * INTO k FROM jsonb_populate_record(k,e-ARRAY['id','plan_id','seq','code','calc_formula_status','calc_formula_approved_by','calc_formula_approved_at']);
  k.id:=v_id; k.plan_id:=p_plan;
  IF k.perspective IS NULL OR k.perspective NOT IN ('S','P','L','F') THEN RAISE EXCEPTION 'invalid_perspective'; END IF;
  n:=coalesce((counts->>k.perspective)::integer,0)+1; counts:=counts||jsonb_build_object(k.perspective,n); k.seq:=n; k.code:=prefix||'-'||k.perspective||n;
  desired:=desired||jsonb_build_array(to_jsonb(k)); ids:=array_append(ids,v_id);
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(desired) x GROUP BY x->>'perspective' HAVING sum((x->>'weight')::numeric)>25.000001) THEN RAISE EXCEPTION 'weight_limit'; END IF;
 INSERT INTO private.perf_structure_context VALUES(pg_backend_pid(),txid_current(),p_plan);
 UPDATE public.perf_kpis SET weight=0 WHERE plan_id=p_plan;
 UPDATE public.perf_kpis SET code='__perf_tmp__:'||id::text WHERE plan_id=p_plan;
 DELETE FROM public.perf_kpis WHERE plan_id=p_plan AND NOT(id=ANY(ids));
 FOR e IN SELECT value FROM jsonb_array_elements(desired) LOOP
  SELECT * INTO k FROM jsonb_populate_record(NULL::public.perf_kpis,e);
  IF EXISTS(SELECT 1 FROM public.perf_kpis WHERE id=k.id AND plan_id=p_plan) THEN
   UPDATE public.perf_kpis t SET perspective=k.perspective,seq=k.seq,code=k.code,objective=k.objective,name=k.name,measurement=k.measurement,role=k.role,unit=k.unit,polarity=k.polarity,calc_method=k.calc_method,weight=k.weight,baseline=k.baseline,annual_target=k.annual_target,q1_plan=k.q1_plan,q1_actual=k.q1_actual,q2_plan=k.q2_plan,q2_actual=k.q2_actual,q3_plan=k.q3_plan,q3_actual=k.q3_actual,q4_plan=k.q4_plan,q4_actual=k.q4_actual,description=k.description,department=k.department,calculation_formula=k.calculation_formula,data_sources=k.data_sources,related_kpis=k.related_kpis,enablers=k.enablers,notes=k.notes WHERE t.id=k.id AND t.plan_id=p_plan;
  ELSE INSERT INTO public.perf_kpis SELECT k.*; END IF;
 END LOOP;
 UPDATE public.perf_activities a SET kpi_code=k.code FROM public.perf_kpis k WHERE a.plan_id=p_plan AND k.plan_id=p_plan AND a.kpi_id=k.id;
 UPDATE public.perf_reports r SET achievements=(SELECT coalesce(jsonb_agg(e.value||jsonb_build_object('kpi_code',k.code) ORDER BY e.ordinality),'[]'::jsonb) FROM jsonb_array_elements(r.achievements) WITH ORDINALITY e(value,ordinality) LEFT JOIN public.perf_kpis k ON k.plan_id=p_plan AND k.id::text=e.value->>'kpi_id') WHERE r.plan_id=p_plan;
 DELETE FROM private.perf_structure_context WHERE backend=pg_backend_pid() AND xid=txid_current() AND plan_id=p_plan;
 RETURN jsonb_build_object('rows',desired);
END $$;
REVOKE ALL ON FUNCTION public.mutate_perf_kpis(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_perf_kpis(uuid,text,jsonb) TO authenticated;
CREATE FUNCTION public.perf_plan_revision_timestamp() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN NEW.updated_at:=clock_timestamp(); RETURN NEW; END $$;
DROP TRIGGER perf_plans_updated ON public.perf_plans;
CREATE TRIGGER perf_plans_updated BEFORE UPDATE ON public.perf_plans FOR EACH ROW EXECUTE FUNCTION public.perf_plan_revision_timestamp();
CREATE OR REPLACE FUNCTION public.reorder_perf_kpis(p_plan uuid,p_ids uuid[]) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE rows jsonb; revision text;
BEGIN
 PERFORM 1 FROM public.perf_plans WHERE id=p_plan FOR UPDATE;
 IF p_ids IS NULL OR array_position(p_ids,NULL) IS NOT NULL OR cardinality(p_ids)<>(SELECT count(*) FROM public.perf_kpis WHERE plan_id=p_plan) OR (SELECT count(DISTINCT x) FROM unnest(p_ids) x)<>cardinality(p_ids) OR EXISTS(SELECT 1 FROM unnest(p_ids) x WHERE NOT EXISTS(SELECT 1 FROM public.perf_kpis WHERE plan_id=p_plan AND id=x)) THEN RAISE EXCEPTION 'invalid_order'; END IF;
 SELECT updated_at::text INTO revision FROM public.perf_plans WHERE id=p_plan;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id) ORDER BY x.ord),'[]') INTO rows FROM unnest(p_ids) WITH ORDINALITY x(id,ord);
 PERFORM public.mutate_perf_kpis(p_plan,revision,rows);
END $$;
CREATE OR REPLACE FUNCTION public.commit_perf_import(p_org text,p_year integer,p_upload uuid,p_payload jsonb,p_allow_definitions boolean,p_revision text) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE plan public.perf_plans; item jsonb; a public.perf_activities; rep public.perf_reports; rows jsonb:='[]'; existing_id uuid;
BEGIN
 IF NOT (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'developer'::app_role)) THEN RAISE EXCEPTION 'غير مصرح لك بتعديل أو اعتماد المؤشرات'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.uploads WHERE id=p_upload AND data_type='قالب متابعة الأداء') THEN RAISE EXCEPTION 'invalid_upload'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_org),p_year);
 SELECT * INTO plan FROM public.perf_plans WHERE org_id=p_org AND plan_year=p_year FOR UPDATE;
 IF (plan.id IS NOT NULL AND plan.updated_at IS DISTINCT FROM p_revision::timestamptz) OR (plan.id IS NULL AND p_revision IS NOT NULL) THEN RAISE EXCEPTION 'stale_preview'; END IF;
 IF plan.id IS NULL THEN INSERT INTO public.perf_plans(org_id,plan_year,fiscal_type) SELECT p_org,p_year,fiscal_type FROM public.organizations WHERE id=p_org AND status='active' RETURNING * INTO plan; END IF;
 IF plan.id IS NULL THEN RAISE EXCEPTION 'unknown_organization'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'kpis') x GROUP BY x->>'code' HAVING count(*)>1) THEN RAISE EXCEPTION 'duplicate_code'; END IF;
 IF plan.status='draft' THEN
  IF (SELECT count(DISTINCT x->>'perspective') FROM jsonb_array_elements(p_payload->'kpis') x)<>4 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'kpis') x GROUP BY x->>'perspective' HAVING abs(sum((x->>'weight')::numeric)-25)>0.000001) THEN RAISE EXCEPTION 'matrix_incomplete'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_payload->'kpis') LOOP
   SELECT id INTO existing_id FROM public.perf_kpis WHERE plan_id=plan.id AND code=item->>'code';
   rows:=rows||jsonb_build_array((item-'id')||jsonb_build_object('id',existing_id));
  END LOOP;
  DELETE FROM public.perf_activities WHERE plan_id=plan.id;
  SELECT * INTO plan FROM public.perf_plans WHERE id=plan.id;
  PERFORM public.mutate_perf_kpis(plan.id,plan.updated_at::text,rows);
 ELSE
  FOR item IN SELECT value FROM jsonb_array_elements(p_payload->'kpis') LOOP
   IF plan.status='objectives_approved' THEN
    IF NOT EXISTS(SELECT 1 FROM public.perf_kpis WHERE plan_id=plan.id AND code=item->>'code' AND objective=item->>'objective' AND name=item->>'name' AND perspective=item->>'perspective' AND seq=(item->>'seq')::integer) THEN RAISE EXCEPTION 'الخطة معتمدة — هذا الحقل مقفل'; END IF;
    UPDATE public.perf_kpis SET measurement=item->>'measurement',role=item->>'role',unit=item->>'unit',polarity=item->>'polarity',calc_method=item->>'calc_method',weight=(item->>'weight')::numeric,baseline=(item->>'baseline')::numeric,annual_target=(item->>'annual_target')::numeric,q1_plan=(item->>'q1_plan')::numeric,q2_plan=(item->>'q2_plan')::numeric,q3_plan=(item->>'q3_plan')::numeric,q4_plan=(item->>'q4_plan')::numeric,q1_actual=(item->>'q1_actual')::numeric,q2_actual=(item->>'q2_actual')::numeric,q3_actual=(item->>'q3_actual')::numeric,q4_actual=(item->>'q4_actual')::numeric WHERE plan_id=plan.id AND code=item->>'code';
   ELSE UPDATE public.perf_kpis SET q1_actual=(item->>'q1_actual')::numeric,q2_actual=(item->>'q2_actual')::numeric,q3_actual=(item->>'q3_actual')::numeric,q4_actual=(item->>'q4_actual')::numeric WHERE plan_id=plan.id AND code=item->>'code'; END IF;
   IF NOT FOUND THEN RAISE EXCEPTION 'identity_missing'; END IF;
  END LOOP;
  IF plan.status='objectives_approved' AND (SELECT count(*) FROM public.perf_kpis WHERE plan_id=plan.id)<>jsonb_array_length(p_payload->'kpis') THEN RAISE EXCEPTION 'الخطة معتمدة — هذا الحقل مقفل'; END IF;
  DELETE FROM public.perf_activities WHERE plan_id=plan.id;
 END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_payload->'activities') LOOP
  SELECT * INTO a FROM jsonb_populate_record(NULL::public.perf_activities,item||jsonb_build_object('id',gen_random_uuid(),'plan_id',plan.id,'kpi_id',NULL));
  INSERT INTO public.perf_activities SELECT a.*;
 END LOOP;
 SELECT * INTO rep FROM jsonb_populate_record(NULL::public.perf_reports,p_payload->'report');
 INSERT INTO public.perf_reports(id,plan_id,period,executive_summary,planned_beneficiaries,annual_stats,achievements,challenges,proposals) VALUES(gen_random_uuid(),plan.id,rep.period,rep.executive_summary,rep.planned_beneficiaries,rep.annual_stats,rep.achievements,rep.challenges,rep.proposals) ON CONFLICT(plan_id,period) DO UPDATE SET executive_summary=EXCLUDED.executive_summary,planned_beneficiaries=EXCLUDED.planned_beneficiaries,annual_stats=EXCLUDED.annual_stats,achievements=EXCLUDED.achievements,challenges=EXCLUDED.challenges,proposals=EXCLUDED.proposals;
 UPDATE public.perf_plans SET prepared_by=p_payload->>'prepared_by',approved_by=CASE WHEN status='draft' THEN p_payload->>'approved_by' ELSE approved_by END,source_upload_id=p_upload WHERE id=plan.id;
 UPDATE public.uploads SET status='processed',org_id=p_org,period=rep.period,rows_extracted=jsonb_array_length(p_payload->'kpis'),extracted_summary=jsonb_build_object('plan_id',plan.id,'year',p_year) WHERE id=p_upload;
 RETURN plan.id;
END $$;
REVOKE ALL ON FUNCTION public.perf_report_links_guard(),public.perf_formula_metadata_guard(),public.perf_plan_revision_timestamp() FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE public.kpis IS 'DEPRECATED: replaced by perf_kpis; empty and unused';
COMMENT ON TABLE public.kpi_goals IS 'DEPRECATED: replaced by perf_kpis objectives; empty and unused';
COMMENT ON TABLE public.kpi_perspectives IS 'DEPRECATED: replaced by perf_kpis perspective; empty and unused';