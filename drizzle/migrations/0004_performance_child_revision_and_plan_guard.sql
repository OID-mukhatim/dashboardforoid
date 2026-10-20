CREATE OR REPLACE FUNCTION public.perf_kpi_definition_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE state text; old_state text; prefix text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
  SELECT status INTO old_state FROM public.perf_plans WHERE id=OLD.plan_id;
  IF old_state='matrix_approved' THEN RAISE EXCEPTION 'Approved KPI cannot move between plans'; END IF;
 END IF;
 SELECT p.status,o.abbr INTO state,prefix FROM public.perf_plans p JOIN public.organizations o ON o.id=p.org_id WHERE p.id=coalesce(NEW.plan_id,OLD.plan_id);
 IF state='matrix_approved' AND coalesce(current_setting('app.perf_definition_override',true),'false')<>'true' THEN
  IF TG_OP <> 'UPDATE' THEN RAISE EXCEPTION 'Approved matrix definitions are frozen'; END IF;
  IF (to_jsonb(NEW)-ARRAY['q1_actual','q2_actual','q3_actual','q4_actual']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['q1_actual','q2_actual','q3_actual','q4_actual']) THEN RAISE EXCEPTION 'Approved matrix definitions are frozen'; END IF;
 END IF;
 IF TG_OP <> 'DELETE' AND state <> 'matrix_approved' THEN NEW.code:=prefix||'-'||NEW.perspective||NEW.seq; END IF;
 RETURN coalesce(NEW,OLD);
END $$;
CREATE FUNCTION public.perf_child_revision() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 UPDATE public.perf_plans SET updated_at=clock_timestamp() WHERE id=coalesce(NEW.plan_id,OLD.plan_id);
 IF TG_OP='UPDATE' AND NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN UPDATE public.perf_plans SET updated_at=clock_timestamp() WHERE id=OLD.plan_id; END IF;
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER perf_kpis_revision AFTER INSERT OR UPDATE OR DELETE ON public.perf_kpis FOR EACH ROW EXECUTE FUNCTION public.perf_child_revision();
CREATE TRIGGER perf_activities_revision AFTER INSERT OR UPDATE OR DELETE ON public.perf_activities FOR EACH ROW EXECUTE FUNCTION public.perf_child_revision();
CREATE TRIGGER perf_reports_revision AFTER INSERT OR UPDATE OR DELETE ON public.perf_reports FOR EACH ROW EXECUTE FUNCTION public.perf_child_revision();