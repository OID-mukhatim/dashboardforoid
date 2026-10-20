CREATE OR REPLACE FUNCTION public.mutate_perf_kpis(p_plan uuid,p_revision text,p_rows jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
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
  IF v_id IS NOT NULL THEN SELECT * INTO k FROM public.perf_kpis WHERE plan_id=p_plan AND id=v_id; IF NOT FOUND THEN RAISE EXCEPTION 'identity_missing'; END IF;
  ELSE v_id:=gen_random_uuid(); SELECT * INTO k FROM jsonb_populate_record(NULL::public.perf_kpis,jsonb_build_object('objective','','name','','perspective','S','measurement','num','role','leading','unit','number','polarity','asc','calc_method','q_independent','weight',0,'calc_formula_status','none')); END IF;
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
 UPDATE public.perf_activities a SET kpi_code=linked.code FROM public.perf_kpis linked WHERE a.plan_id=p_plan AND linked.plan_id=p_plan AND a.kpi_id=linked.id;
 UPDATE public.perf_reports r SET achievements=(SELECT coalesce(jsonb_agg(e.value||jsonb_build_object('kpi_code',linked.code) ORDER BY e.ordinality),'[]'::jsonb) FROM jsonb_array_elements(r.achievements) WITH ORDINALITY e(value,ordinality) LEFT JOIN public.perf_kpis linked ON linked.plan_id=p_plan AND linked.id::text=e.value->>'kpi_id') WHERE r.plan_id=p_plan;
 DELETE FROM private.perf_structure_context WHERE backend=pg_backend_pid() AND xid=txid_current() AND plan_id=p_plan;
 RETURN jsonb_build_object('rows',desired);
END $$;