CREATE FUNCTION public.perf_weight_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF (TG_OP='INSERT' OR NEW.weight IS DISTINCT FROM OLD.weight OR NEW.perspective IS DISTINCT FROM OLD.perspective) AND (SELECT coalesce(sum(weight),0) FROM public.perf_kpis WHERE plan_id=NEW.plan_id AND perspective=NEW.perspective AND id<>NEW.id)+NEW.weight>25.000001 THEN RAISE EXCEPTION 'weight_limit'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER perf_weight_limit BEFORE INSERT OR UPDATE ON public.perf_kpis FOR EACH ROW EXECUTE FUNCTION public.perf_weight_guard();
CREATE FUNCTION public.reorder_perf_kpis(p_plan uuid,p_ids uuid[]) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE ids uuid[]; item uuid; p text; n integer; prefix text; old_code text; new_code text; tmp text;
BEGIN
 IF NOT (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'developer'::app_role)) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.perf_plans WHERE id=p_plan AND status='draft' FOR UPDATE) THEN RAISE EXCEPTION 'الخطة معتمدة — هذا الحقل مقفل'; END IF;
 SELECT abbr INTO prefix FROM public.organizations WHERE id=(SELECT org_id FROM public.perf_plans WHERE id=p_plan);
 IF cardinality(p_ids)<>(SELECT count(*) FROM public.perf_kpis WHERE plan_id=p_plan) OR (SELECT count(DISTINCT x) FROM unnest(p_ids) x)<>cardinality(p_ids) OR EXISTS(SELECT 1 FROM unnest(p_ids) x WHERE NOT EXISTS(SELECT 1 FROM public.perf_kpis WHERE id=x AND plan_id=p_plan)) THEN RAISE EXCEPTION 'invalid_order'; END IF;
 n:=1000;
 FOREACH item IN ARRAY p_ids LOOP
  SELECT code,perspective INTO old_code,p FROM public.perf_kpis WHERE id=item;
  tmp:=prefix||'-'||p||n;
  UPDATE public.perf_kpis SET seq=n WHERE id=item;
  UPDATE public.perf_activities SET kpi_code=tmp WHERE plan_id=p_plan AND kpi_code=old_code;
  n:=n+1;
 END LOOP;
 FOREACH p IN ARRAY ARRAY['S','P','L','F'] LOOP
  n:=1;
  FOREACH item IN ARRAY p_ids LOOP
   IF (SELECT perspective FROM public.perf_kpis WHERE id=item)=p THEN
    SELECT code INTO old_code FROM public.perf_kpis WHERE id=item;
    new_code:=prefix||'-'||p||n;
    UPDATE public.perf_kpis SET seq=n WHERE id=item;
    UPDATE public.perf_activities SET kpi_code=new_code WHERE plan_id=p_plan AND kpi_code=old_code;
    n:=n+1;
   END IF;
  END LOOP;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.reorder_perf_kpis(uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reorder_perf_kpis(uuid,uuid[]) TO authenticated;
CREATE FUNCTION public.perf_delete_reference() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 UPDATE public.perf_activities SET kpi_code=NULL WHERE plan_id=OLD.plan_id AND kpi_code=OLD.code;
 RETURN OLD;
END $$;
CREATE TRIGGER perf_delete_kpi_reference AFTER DELETE ON public.perf_kpis FOR EACH ROW EXECUTE FUNCTION public.perf_delete_reference();