DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.commit_perf_import(text,integer,uuid,jsonb,boolean,text)'::regprocedure) INTO definition;
 definition := replace(definition, 'plan.updated_at::text IS DISTINCT FROM p_revision', 'plan.updated_at IS DISTINCT FROM p_revision::timestamptz');
 definition := replace(definition, 'approved:=plan.status=''matrix_approved'';', 'approved:=plan.status=''matrix_approved''; PERFORM set_config(''app.perf_definition_override'', CASE WHEN p_allow_definitions THEN ''true'' ELSE ''false'' END, true);');
 EXECUTE definition;
END $$;
CREATE FUNCTION public.perf_kpi_definition_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE state text; prefix text;
BEGIN
 SELECT p.status,o.abbr INTO state,prefix FROM public.perf_plans p JOIN public.organizations o ON o.id=p.org_id WHERE p.id=coalesce(NEW.plan_id,OLD.plan_id);
 IF state='matrix_approved' AND coalesce(current_setting('app.perf_definition_override',true),'false')<>'true' THEN
  IF TG_OP <> 'UPDATE' THEN RAISE EXCEPTION 'Approved matrix definitions are frozen'; END IF;
  IF (to_jsonb(NEW)-ARRAY['q1_actual','q2_actual','q3_actual','q4_actual']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['q1_actual','q2_actual','q3_actual','q4_actual']) THEN RAISE EXCEPTION 'Approved matrix definitions are frozen'; END IF;
 END IF;
 IF TG_OP <> 'DELETE' AND state <> 'matrix_approved' THEN NEW.code:=prefix||'-'||NEW.perspective||NEW.seq; END IF;
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER perf_kpi_definitions BEFORE INSERT OR UPDATE OR DELETE ON public.perf_kpis FOR EACH ROW EXECUTE FUNCTION public.perf_kpi_definition_guard();