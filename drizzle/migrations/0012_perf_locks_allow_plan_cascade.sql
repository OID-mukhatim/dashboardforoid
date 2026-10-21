CREATE OR REPLACE FUNCTION public.perf_activities_lock_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('perf.correction', true) = 'on' THEN RETURN coalesce(NEW, OLD); END IF;
  -- deleting the whole plan cascades; allow it
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM perf_plans WHERE id = OLD.plan_id) THEN RETURN OLD; END IF;
  IF TG_OP IN ('UPDATE','DELETE') AND perf_quarter_locked(OLD.plan_id, OLD.quarter) THEN
    RAISE EXCEPTION 'تقرير الربع % معتمد؛ التعديل يتم عبر التصحيح بسبب مكتوب', OLD.quarter USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND perf_quarter_locked(NEW.plan_id, NEW.quarter) THEN
    RAISE EXCEPTION 'تقرير الربع % معتمد؛ التعديل يتم عبر التصحيح بسبب مكتوب', NEW.quarter USING ERRCODE = 'P0001';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION public.perf_report_status_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('perf.report_tx', true) = 'on' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM perf_plans WHERE id = NEW.plan_id) THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' OR NEW.snapshot IS NOT NULL THEN RAISE EXCEPTION 'التقرير الجديد يبدأ مسودة'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RAISE EXCEPTION 'تغيير حالة التقرير يتم عبر الاعتماد أو إعادة الفتح فقط';
  END IF;
  -- reference cleanup (KPI deleted) may touch links only; narrative stays frozen
  IF OLD.status = 'approved' AND (NEW.executive_summary IS DISTINCT FROM OLD.executive_summary
     OR NEW.planned_beneficiaries IS DISTINCT FROM OLD.planned_beneficiaries OR NEW.annual_stats IS DISTINCT FROM OLD.annual_stats
     OR NEW.challenges IS DISTINCT FROM OLD.challenges OR NEW.proposals IS DISTINCT FROM OLD.proposals
     OR pg_trigger_depth() = 1 AND NEW.achievements IS DISTINCT FROM OLD.achievements) THEN
    RAISE EXCEPTION 'التقرير معتمد؛ أعد فتحه للتعديل';
  END IF;
  RETURN NEW;
END $$;