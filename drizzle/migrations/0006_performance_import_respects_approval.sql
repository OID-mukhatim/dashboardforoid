CREATE OR REPLACE FUNCTION public.commit_perf_import(p_org text,p_year integer,p_upload uuid,p_payload jsonb,p_allow_definitions boolean,p_revision text) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE plan public.perf_plans; item jsonb; k public.perf_kpis; a public.perf_activities; rep public.perf_reports; prefix text;
BEGIN
 IF NOT (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'developer'::app_role)) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.uploads WHERE id=p_upload AND data_type='قالب متابعة الأداء') THEN RAISE EXCEPTION 'invalid_upload'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_org),p_year);
 SELECT * INTO plan FROM public.perf_plans WHERE org_id=p_org AND plan_year=p_year FOR UPDATE;
 IF plan.id IS NOT NULL AND plan.updated_at IS DISTINCT FROM p_revision::timestamptz THEN RAISE EXCEPTION 'stale_preview'; END IF;
 IF plan.id IS NULL AND p_revision IS NOT NULL THEN RAISE EXCEPTION 'stale_preview'; END IF;
 SELECT abbr INTO prefix FROM public.organizations WHERE id=p_org AND status='active';
 IF prefix IS NULL THEN RAISE EXCEPTION 'unknown_organization'; END IF;
 IF plan.id IS NULL THEN INSERT INTO public.perf_plans(org_id,plan_year,fiscal_type) SELECT p_org,p_year,fiscal_type FROM public.organizations WHERE id=p_org RETURNING * INTO plan; END IF;
 IF plan.status='draft' THEN
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'kpis') x GROUP BY x->>'perspective' HAVING abs(sum((x->>'weight')::numeric)-25)>0.000001) OR (SELECT count(DISTINCT x->>'perspective') FROM jsonb_array_elements(p_payload->'kpis') x)<>4 THEN RAISE EXCEPTION 'matrix_incomplete'; END IF;
  DELETE FROM public.perf_activities WHERE plan_id=plan.id;
  DELETE FROM public.perf_kpis WHERE plan_id=plan.id;
  FOR item IN SELECT * FROM jsonb_array_elements(p_payload->'kpis') LOOP
   SELECT * INTO k FROM jsonb_populate_record(NULL::public.perf_kpis,item||jsonb_build_object('calc_formula_status','none'));
   INSERT INTO public.perf_kpis SELECT (jsonb_populate_record(NULL::public.perf_kpis,to_jsonb(k)||jsonb_build_object('id',gen_random_uuid(),'plan_id',plan.id,'code',prefix||'-'||k.perspective||k.seq))).*;
  END LOOP;
 ELSE
  FOR item IN SELECT * FROM jsonb_array_elements(p_payload->'kpis') LOOP
   IF plan.status='objectives_approved' THEN
    UPDATE public.perf_kpis SET objective=item->>'objective',name=item->>'name',perspective=item->>'perspective',seq=(item->>'seq')::integer,measurement=item->>'measurement',role=item->>'role',unit=item->>'unit',polarity=item->>'polarity',calc_method=item->>'calc_method',weight=(item->>'weight')::numeric,baseline=(item->>'baseline')::numeric,annual_target=(item->>'annual_target')::numeric,q1_plan=(item->>'q1_plan')::numeric,q2_plan=(item->>'q2_plan')::numeric,q3_plan=(item->>'q3_plan')::numeric,q4_plan=(item->>'q4_plan')::numeric,q1_actual=(item->>'q1_actual')::numeric,q2_actual=(item->>'q2_actual')::numeric,q3_actual=(item->>'q3_actual')::numeric,q4_actual=(item->>'q4_actual')::numeric WHERE plan_id=plan.id AND code=item->>'code';
   ELSE
    UPDATE public.perf_kpis SET q1_actual=(item->>'q1_actual')::numeric,q2_actual=(item->>'q2_actual')::numeric,q3_actual=(item->>'q3_actual')::numeric,q4_actual=(item->>'q4_actual')::numeric WHERE plan_id=plan.id AND code=item->>'code';
   END IF;
   IF NOT FOUND THEN RAISE EXCEPTION 'identity_missing'; END IF;
  END LOOP;
  IF plan.status='objectives_approved' AND (SELECT count(*) FROM public.perf_kpis WHERE plan_id=plan.id)<>jsonb_array_length(p_payload->'kpis') THEN RAISE EXCEPTION 'الخطة معتمدة — هذا الحقل مقفل'; END IF;
  DELETE FROM public.perf_activities WHERE plan_id=plan.id;
 END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_payload->'activities') LOOP
  SELECT * INTO a FROM jsonb_populate_record(NULL::public.perf_activities,item);
  INSERT INTO public.perf_activities SELECT (jsonb_populate_record(NULL::public.perf_activities,to_jsonb(a)||jsonb_build_object('id',gen_random_uuid(),'plan_id',plan.id))).*;
 END LOOP;
 SELECT * INTO rep FROM jsonb_populate_record(NULL::public.perf_reports,p_payload->'report');
 INSERT INTO public.perf_reports(id,plan_id,period,executive_summary,planned_beneficiaries,annual_stats,achievements,challenges,proposals) VALUES(gen_random_uuid(),plan.id,rep.period,rep.executive_summary,rep.planned_beneficiaries,rep.annual_stats,rep.achievements,rep.challenges,rep.proposals)
 ON CONFLICT(plan_id,period) DO UPDATE SET executive_summary=EXCLUDED.executive_summary,planned_beneficiaries=EXCLUDED.planned_beneficiaries,annual_stats=EXCLUDED.annual_stats,achievements=EXCLUDED.achievements,challenges=EXCLUDED.challenges,proposals=EXCLUDED.proposals;
 UPDATE public.perf_plans SET prepared_by=p_payload->>'prepared_by',approved_by=CASE WHEN status='draft' THEN p_payload->>'approved_by' ELSE approved_by END,source_upload_id=p_upload WHERE id=plan.id;
 UPDATE public.uploads SET status='processed',org_id=p_org,period=rep.period,rows_extracted=jsonb_array_length(p_payload->'kpis'),extracted_summary=jsonb_build_object('plan_id',plan.id,'year',p_year) WHERE id=p_upload;
 RETURN plan.id;
END $$;