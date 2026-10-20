-- initiatives.org_ids
ALTER TABLE public.initiatives ADD COLUMN IF NOT EXISTS org_ids text[] NOT NULL DEFAULT '{}';
UPDATE public.initiatives i SET org_ids = coalesce((
  SELECT array_agg(DISTINCT o.id ORDER BY o.id) FROM unnest(i.orgs) t(v)
  JOIN public.organizations o ON (
    (btrim(t.v) = 'الجميع' AND o.status = 'active')
    OR lower(btrim(t.v)) IN (lower(o.id), lower(o.abbr), lower(o.name_ar), lower(o.name_en))
    OR EXISTS (SELECT 1 FROM unnest(o.aliases) a WHERE btrim(t.v) ~* replace(a, '\b', '\y'))
  )), '{}');

-- perf_reports
ALTER TABLE public.perf_reports DROP CONSTRAINT perf_reports_status_check;
ALTER TABLE public.perf_reports DROP CONSTRAINT perf_reports_period_check;
ALTER TABLE public.perf_reports ADD COLUMN IF NOT EXISTS approved_by uuid, ADD COLUMN IF NOT EXISTS approved_at timestamptz;
UPDATE public.perf_reports SET status = 'approved', approved_at = coalesce(submitted_at, now()) WHERE status = 'submitted';
ALTER TABLE public.perf_reports ADD CONSTRAINT perf_reports_status_check CHECK (status IN ('draft','approved'));
ALTER TABLE public.perf_reports ADD CONSTRAINT perf_reports_period_check CHECK (period IN ('Q1','Q2','Q3','Q4','annual'));

CREATE TABLE public.perf_report_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.perf_reports(id) ON DELETE CASCADE,
  from_status text NOT NULL, to_status text NOT NULL, reason text,
  previous_snapshot jsonb,
  changed_by uuid, changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
GRANT SELECT ON public.perf_report_events TO authenticated;
GRANT ALL ON public.perf_report_events TO service_role;
ALTER TABLE public.perf_report_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY perf_report_events_read ON public.perf_report_events FOR SELECT TO authenticated USING (true);
CREATE TRIGGER audit_perf_report_events AFTER INSERT OR UPDATE OR DELETE ON public.perf_report_events FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TABLE public.perf_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.perf_plans(id) ON DELETE CASCADE,
  period text NOT NULL, table_name text NOT NULL, record_id uuid, field text NOT NULL,
  old_value jsonb, new_value jsonb, reason text NOT NULL,
  changed_by uuid, changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
GRANT SELECT ON public.perf_corrections TO authenticated;
GRANT ALL ON public.perf_corrections TO service_role;
ALTER TABLE public.perf_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY perf_corrections_read ON public.perf_corrections FOR SELECT TO authenticated USING (true);
CREATE TRIGGER audit_perf_corrections AFTER INSERT OR UPDATE OR DELETE ON public.perf_corrections FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- is a quarter locked (its report approved, or the annual report approved)
CREATE OR REPLACE FUNCTION public.perf_quarter_locked(p_plan uuid, p_quarter text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM perf_reports WHERE plan_id = p_plan AND status = 'approved' AND period IN (p_quarter, 'annual'))
$$;

CREATE OR REPLACE FUNCTION public.perf_actuals_lock_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE q int;
BEGIN
  IF current_setting('perf.correction', true) = 'on' THEN RETURN NEW; END IF;
  FOR q IN 1..4 LOOP
    IF (to_jsonb(NEW) ->> ('q'||q||'_actual')) IS DISTINCT FROM (to_jsonb(OLD) ->> ('q'||q||'_actual'))
       AND perf_quarter_locked(NEW.plan_id, 'Q'||q) THEN
      RAISE EXCEPTION 'تقرير الربع Q% معتمد؛ التعديل يتم عبر التصحيح بسبب مكتوب', q USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER perf_actuals_lock BEFORE UPDATE ON public.perf_kpis FOR EACH ROW EXECUTE FUNCTION public.perf_actuals_lock_guard();

CREATE OR REPLACE FUNCTION public.perf_activities_lock_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('perf.correction', true) = 'on' THEN RETURN coalesce(NEW, OLD); END IF;
  IF TG_OP IN ('UPDATE','DELETE') AND perf_quarter_locked(OLD.plan_id, OLD.quarter) THEN
    RAISE EXCEPTION 'تقرير الربع % معتمد؛ التعديل يتم عبر التصحيح بسبب مكتوب', OLD.quarter USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND perf_quarter_locked(NEW.plan_id, NEW.quarter) THEN
    RAISE EXCEPTION 'تقرير الربع % معتمد؛ التعديل يتم عبر التصحيح بسبب مكتوب', NEW.quarter USING ERRCODE = 'P0001';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER perf_activities_lock BEFORE INSERT OR UPDATE OR DELETE ON public.perf_activities FOR EACH ROW EXECUTE FUNCTION public.perf_activities_lock_guard();

-- reports: status/snapshot only through RPCs; narrative frozen while approved
CREATE OR REPLACE FUNCTION public.perf_report_status_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('perf.report_tx', true) = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' OR NEW.snapshot IS NOT NULL THEN RAISE EXCEPTION 'التقرير الجديد يبدأ مسودة'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RAISE EXCEPTION 'تغيير حالة التقرير يتم عبر الاعتماد أو إعادة الفتح فقط';
  END IF;
  IF OLD.status = 'approved' THEN RAISE EXCEPTION 'التقرير معتمد؛ أعد فتحه للتعديل'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER perf_report_status BEFORE INSERT OR UPDATE ON public.perf_reports FOR EACH ROW EXECUTE FUNCTION public.perf_report_status_guard();

CREATE OR REPLACE FUNCTION public.approve_perf_report(p_plan uuid, p_period text, p_snapshot jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r perf_reports; v_id uuid;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'الاعتماد للمسؤول فقط'; END IF;
  IF p_period NOT IN ('Q1','Q2','Q3','Q4','annual') THEN RAISE EXCEPTION 'فترة غير صالحة'; END IF;
  IF NOT EXISTS (SELECT 1 FROM perf_plans WHERE id = p_plan AND status = 'matrix_approved') THEN
    RAISE EXCEPTION 'يجب اعتماد مصفوفة الخطة قبل اعتماد التقرير'; END IF;
  IF p_period = 'annual' AND NOT EXISTS (SELECT 1 FROM perf_reports WHERE plan_id = p_plan AND period = 'Q4' AND status = 'approved') THEN
    RAISE EXCEPTION 'لا يُعتمد التقرير السنوي قبل اعتماد تقرير Q4'; END IF;
  IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' THEN RAISE EXCEPTION 'النسخة المجمّدة مطلوبة'; END IF;
  PERFORM set_config('perf.report_tx', 'on', true);
  SELECT * INTO r FROM perf_reports WHERE plan_id = p_plan AND period = p_period FOR UPDATE;
  IF r.id IS NULL THEN
    INSERT INTO perf_reports(plan_id, period, annual_stats, achievements, challenges, proposals)
    VALUES (p_plan, p_period, '[]', '[]', '[]', '[]') RETURNING * INTO r;
  END IF;
  IF r.status = 'approved' THEN RAISE EXCEPTION 'التقرير معتمد مسبقاً'; END IF;
  UPDATE perf_reports SET status = 'approved', approved_by = auth.uid(), approved_at = clock_timestamp(),
    snapshot = p_snapshot || jsonb_build_object('approved_at', clock_timestamp(), 'approved_by', auth.uid())
  WHERE id = r.id RETURNING id INTO v_id;
  INSERT INTO perf_report_events(report_id, from_status, to_status, changed_by) VALUES (v_id, 'draft', 'approved', auth.uid());
  PERFORM set_config('perf.report_tx', 'off', true);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.reopen_perf_report(p_report uuid, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r perf_reports;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'إعادة الفتح للمسؤول فقط'; END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 10 THEN RAISE EXCEPTION 'سبب إعادة الفتح مطلوب (10 أحرف على الأقل)'; END IF;
  SELECT * INTO r FROM perf_reports WHERE id = p_report FOR UPDATE;
  IF r.id IS NULL OR r.status <> 'approved' THEN RAISE EXCEPTION 'التقرير غير معتمد'; END IF;
  PERFORM set_config('perf.report_tx', 'on', true);
  INSERT INTO perf_report_events(report_id, from_status, to_status, reason, previous_snapshot, changed_by)
  VALUES (r.id, 'approved', 'draft', btrim(p_reason), r.snapshot, auth.uid());
  UPDATE perf_reports SET status = 'draft', snapshot = NULL, approved_by = NULL, approved_at = NULL WHERE id = r.id;
  PERFORM set_config('perf.report_tx', 'off', true);
END $$;

-- p_table: 'perf_kpis' (field q1_actual..q4_actual) or 'perf_activities' (action insert/update/delete with p_value row json)
CREATE OR REPLACE FUNCTION public.perf_correct(p_plan uuid, p_period text, p_table text, p_record uuid, p_field text, p_value jsonb, p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old jsonb; v_id uuid := p_record; a perf_activities;
BEGIN
  IF NOT (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'developer')) THEN RAISE EXCEPTION 'صلاحيات غير كافية'; END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 10 THEN RAISE EXCEPTION 'سبب التصحيح مطلوب (10 أحرف على الأقل)'; END IF;
  PERFORM set_config('perf.correction', 'on', true);
  IF p_table = 'perf_kpis' THEN
    IF p_field NOT IN ('q1_actual','q2_actual','q3_actual','q4_actual') THEN RAISE EXCEPTION 'حقل غير مسموح'; END IF;
    SELECT to_jsonb(k) -> p_field INTO v_old FROM perf_kpis k WHERE id = p_record AND plan_id = p_plan;
    IF NOT FOUND THEN RAISE EXCEPTION 'المؤشر غير موجود'; END IF;
    EXECUTE format('UPDATE perf_kpis SET %I = $1 WHERE id = $2', p_field)
      USING CASE WHEN p_value IS NULL OR jsonb_typeof(p_value) = 'null' THEN NULL ELSE (p_value #>> '{}')::numeric END, p_record;
  ELSIF p_table = 'perf_activities' THEN
    IF p_field = 'delete' THEN
      DELETE FROM perf_activities WHERE id = p_record AND plan_id = p_plan RETURNING to_jsonb(perf_activities.*) INTO v_old;
    ELSIF p_field = 'insert' THEN
      a := jsonb_populate_record(NULL::perf_activities, p_value || jsonb_build_object('plan_id', p_plan, 'id', gen_random_uuid()));
      INSERT INTO perf_activities SELECT a.* RETURNING id INTO v_id;
    ELSIF p_field = 'update' THEN
      SELECT to_jsonb(x) INTO v_old FROM perf_activities x WHERE id = p_record AND plan_id = p_plan;
      IF v_old IS NULL THEN RAISE EXCEPTION 'النشاط غير موجود'; END IF;
      a := jsonb_populate_record(NULL::perf_activities, v_old || (p_value - 'id' - 'plan_id'));
      UPDATE perf_activities SET quarter=a.quarter, activity_type=a.activity_type, title=a.title, target_group=a.target_group,
        implementer=a.implementer, beneficiaries=a.beneficiaries, planned=a.planned, achieved=a.achieved,
        kpi_id=a.kpi_id, kpi_code=a.kpi_code, notes=a.notes WHERE id = p_record;
    ELSE RAISE EXCEPTION 'إجراء غير مسموح'; END IF;
  ELSE RAISE EXCEPTION 'جدول غير مسموح'; END IF;
  INSERT INTO perf_corrections(plan_id, period, table_name, record_id, field, old_value, new_value, reason, changed_by)
  VALUES (p_plan, p_period, p_table, v_id, p_field, v_old, p_value, btrim(p_reason), auth.uid());
  PERFORM set_config('perf.correction', 'off', true);
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.approve_perf_report(uuid,text,jsonb), public.reopen_perf_report(uuid,text),
  public.perf_correct(uuid,text,text,uuid,text,jsonb,text), public.perf_quarter_locked(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_perf_report(uuid,text,jsonb), public.reopen_perf_report(uuid,text),
  public.perf_correct(uuid,text,text,uuid,text,jsonb,text), public.perf_quarter_locked(uuid,text) TO authenticated;

COMMENT ON TABLE public.quarterly_reports IS 'DEPRECATED: replaced by perf_reports (phase 3a)';
COMMENT ON COLUMN public.initiatives.orgs IS 'DEPRECATED: replaced by org_ids';