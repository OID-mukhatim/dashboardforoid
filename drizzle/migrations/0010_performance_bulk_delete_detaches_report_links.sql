CREATE OR REPLACE FUNCTION public.perf_delete_reference() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 UPDATE public.perf_activities SET kpi_id=NULL,kpi_code=NULL WHERE plan_id=OLD.plan_id AND (kpi_id=OLD.id OR kpi_code=OLD.code);
 UPDATE public.perf_reports r SET achievements=(SELECT coalesce(jsonb_agg(CASE WHEN e.value->>'kpi_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.perf_kpis linked WHERE linked.plan_id=r.plan_id AND linked.id::text=e.value->>'kpi_id') THEN e.value||jsonb_build_object('kpi_id',NULL,'kpi_code',NULL) ELSE e.value END ORDER BY e.ordinality),'[]') FROM jsonb_array_elements(r.achievements) WITH ORDINALITY e(value,ordinality)) WHERE r.plan_id=OLD.plan_id;
 RETURN OLD;
END $$;