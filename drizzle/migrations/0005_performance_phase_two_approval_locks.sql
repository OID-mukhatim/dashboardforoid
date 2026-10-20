ALTER TABLE public.perf_kpis ADD COLUMN calc_formula_status text NOT NULL DEFAULT 'none' CHECK (calc_formula_status IN ('none','suggested','approved')), ADD COLUMN calc_formula_approved_by uuid, ADD COLUMN calc_formula_approved_at timestamptz;
ALTER TABLE public.perf_plans ADD COLUMN objectives_approved_by uuid, ADD COLUMN matrix_approved_by uuid;
CREATE TABLE public.perf_plan_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL REFERENCES public.perf_plans(id) ON DELETE CASCADE, from_status text NOT NULL, to_status text NOT NULL, reason text, changed_by uuid, changed_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.perf_plan_events TO authenticated;
GRANT ALL ON public.perf_plan_events TO service_role;
ALTER TABLE public.perf_plan_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY perf_events_read ON public.perf_plan_events FOR SELECT TO authenticated USING (true);
CREATE TRIGGER audit_perf_plan_events AFTER INSERT OR UPDATE OR DELETE ON public.perf_plan_events FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE OR REPLACE FUNCTION public.perf_kpi_definition_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE state text; prefix text; allowed text[]:=ARRAY['q1_actual','q2_actual','q3_actual','q4_actual','description','department','calculation_formula','calc_formula_status','calc_formula_approved_by','calc_formula_approved_at','data_sources','related_kpis','enablers','notes'];
BEGIN
 SELECT p.status,o.abbr INTO state,prefix FROM public.perf_plans p JOIN public.organizations o ON o.id=p.org_id WHERE p.id=coalesce(NEW.plan_id,OLD.plan_id) FOR UPDATE OF p;
 IF TG_OP='UPDATE' AND NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN RAISE EXCEPTION 'الخطة معتمدة — هذا الحقل مقفل'; END IF;
 IF state<>'draft' THEN
  IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'الخطة معتمدة — هذا الحقل مقفل'; END IF;
  IF state='objectives_approved' AND (NEW.perspective,NEW.objective,NEW.name,NEW.seq,NEW.code) IS DISTINCT FROM (OLD.perspective,OLD.objective,OLD.name,OLD.seq,OLD.code) THEN RAISE EXCEPTION 'الخطة معتمدة — هذا الحقل مقفل'; END IF;
  IF state='matrix_approved' AND (to_jsonb(NEW)-allowed) IS DISTINCT FROM (to_jsonb(OLD)-allowed) THEN RAISE EXCEPTION 'الخطة معتمدة — هذا الحقل مقفل'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF state='draft' THEN NEW.code:=prefix||'-'||NEW.perspective||NEW.seq; END IF;
 IF TG_OP='INSERT' OR NEW.calculation_formula IS DISTINCT FROM OLD.calculation_formula THEN
  NEW.calc_formula_status:=CASE WHEN nullif(trim(NEW.calculation_formula),'') IS NULL THEN 'none' ELSE 'suggested' END;
  NEW.calc_formula_approved_by:=NULL; NEW.calc_formula_approved_at:=NULL;
 ELSIF NEW.calc_formula_status='approved' AND OLD.calc_formula_status<>'approved' THEN
  IF nullif(trim(NEW.calculation_formula),'') IS NULL THEN RAISE EXCEPTION 'formula_required'; END IF;
  NEW.calc_formula_approved_by:=auth.uid(); NEW.calc_formula_approved_at:=now();
 ELSE
  NEW.calc_formula_approved_by:=OLD.calc_formula_approved_by; NEW.calc_formula_approved_at:=OLD.calc_formula_approved_at;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION public.perf_plan_status_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE reason text:=nullif(trim(current_setting('app.perf_reopen_reason',true)),'');
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'draft' THEN RAISE EXCEPTION 'invalid_transition'; END IF;
  NEW.objectives_approved_by:=NULL; NEW.matrix_approved_by:=NULL; NEW.objectives_approved_at:=NULL; NEW.matrix_approved_at:=NULL; RETURN NEW;
 END IF;
 IF NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.plan_year IS DISTINCT FROM OLD.plan_year OR NEW.fiscal_type IS DISTINCT FROM OLD.fiscal_type THEN RAISE EXCEPTION 'plan_identity_locked'; END IF;
 NEW.objectives_approved_by:=OLD.objectives_approved_by; NEW.matrix_approved_by:=OLD.matrix_approved_by;
 NEW.objectives_approved_at:=OLD.objectives_approved_at; NEW.matrix_approved_at:=OLD.matrix_approved_at;
 IF NEW.status=OLD.status THEN RETURN NEW; END IF;
 IF NOT (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'developer'::app_role)) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF (OLD.status='draft' AND NEW.status='objectives_approved') THEN
  IF (SELECT count(DISTINCT perspective) FROM public.perf_kpis WHERE plan_id=OLD.id)<>4 OR EXISTS(SELECT 1 FROM public.perf_kpis WHERE plan_id=OLD.id AND (trim(objective)='' OR trim(name)='')) THEN RAISE EXCEPTION 'objectives_incomplete'; END IF;
  NEW.objectives_approved_by:=auth.uid(); NEW.objectives_approved_at:=now(); NEW.approved_by:=auth.uid()::text;
 ELSIF OLD.status='objectives_approved' AND NEW.status='matrix_approved' THEN
  IF (SELECT count(DISTINCT perspective) FROM public.perf_kpis WHERE plan_id=OLD.id)<>4 OR EXISTS(SELECT 1 FROM public.perf_kpis WHERE plan_id=OLD.id GROUP BY perspective HAVING abs(sum(weight)-25)>0.000001) OR EXISTS(SELECT 1 FROM public.perf_kpis WHERE plan_id=OLD.id AND (annual_target IS NULL OR trim(name)='' OR trim(objective)='' OR measurement='' OR role='' OR unit='' OR polarity='' OR calc_method='')) THEN RAISE EXCEPTION 'matrix_incomplete'; END IF;
  NEW.matrix_approved_by:=auth.uid(); NEW.matrix_approved_at:=now(); NEW.approved_by:=auth.uid()::text;
 ELSIF (OLD.status='matrix_approved' AND NEW.status='objectives_approved') OR (OLD.status='objectives_approved' AND NEW.status='draft') THEN
  IF NOT private.has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF reason IS NULL OR char_length(reason)<10 THEN RAISE EXCEPTION 'reason_required'; END IF;
 ELSE RAISE EXCEPTION 'invalid_transition'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER perf_plan_status_check BEFORE INSERT OR UPDATE ON public.perf_plans FOR EACH ROW EXECUTE FUNCTION public.perf_plan_status_guard();
CREATE FUNCTION public.perf_record_transition() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status THEN INSERT INTO public.perf_plan_events(plan_id,from_status,to_status,reason,changed_by) VALUES(NEW.id,OLD.status,NEW.status,nullif(trim(current_setting('app.perf_reopen_reason',true)),''),auth.uid()); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER perf_plan_transition AFTER UPDATE ON public.perf_plans FOR EACH ROW EXECUTE FUNCTION public.perf_record_transition();
CREATE FUNCTION public.transition_perf_plan(p_plan uuid,p_status text,p_reason text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 PERFORM set_config('app.perf_reopen_reason',coalesce(p_reason,''),true);
 UPDATE public.perf_plans SET status=p_status WHERE id=p_plan;
 IF NOT FOUND THEN RAISE EXCEPTION 'Forbidden'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.transition_perf_plan(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transition_perf_plan(uuid,text,text) TO authenticated;
CREATE FUNCTION public.save_perf_actuals(p_plan uuid,p_quarter integer,p_rows jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE item jsonb;
BEGIN
 IF p_quarter NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION 'invalid_quarter'; END IF;
 PERFORM 1 FROM public.perf_plans WHERE id=p_plan FOR UPDATE;
 FOR item IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
  EXECUTE format('UPDATE public.perf_kpis SET q%s_actual=$1 WHERE id=$2 AND plan_id=$3',p_quarter) USING (item->>'actual')::numeric,(item->>'id')::uuid,p_plan;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_kpi'; END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.save_perf_actuals(uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_perf_actuals(uuid,integer,jsonb) TO authenticated;